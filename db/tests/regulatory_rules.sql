-- Scenario tests for the regulatory rules implemented in the database
-- (docs/compliance/REGULATORY_REGISTER.md). Run against a database built from
-- db/baseline + db/migrations (see db/README.md). Everything runs in one transaction that rolls back.
\set ON_ERROR_STOP on

begin;

create function pg_temp.eq(p_label text, p_actual anyelement, p_expected anyelement) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL %: expected %, got %', p_label, p_expected, p_actual;
  end if;
  raise notice 'ok   %', p_label;
end $$;

create function pg_temp.due(p_company uuid, p_rule_key text) returns date language sql as $$
  select due_date from public.compliance_obligations where company_id = p_company and rule_key = p_rule_key
$$;

create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end $$;

grant execute on all functions in schema pg_temp to authenticated;

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-00000000000a', 'owner-a@example.test', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-00000000000b', 'owner-b@example.test', 'authenticated', 'authenticated');

create temporary table ids (k text primary key, v uuid);
grant all on ids to authenticated;

-- ---------------------------------------------------------------------------
-- Fixtures: companies created through the application RPC
-- ---------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
insert into ids values
  ('sas',  public.create_company_workspace_v2('Test SAS', 'test-sas', 'SAS', 'B000001', 'LU11111111', 'Luxembourg', true, null, '{"street":"1 rue Test","postal_code":"L-1111","city":"Luxembourg","country":"LU"}')),
  ('sarl', public.create_company_workspace_v2('Test SARL', 'test-sarl', 'SARL', 'B000002', 'LU22222222', 'Luxembourg', true, null, '{"street":"2 rue Test","postal_code":"L-1111","city":"Luxembourg","country":"LU"}')),
  ('other', public.create_company_workspace_v2('Test Other', 'test-other', 'OTHER', null, null, 'Luxembourg', false, null, '{"street":"3 rue Test","postal_code":"L-1111","city":"Luxembourg","country":"LU"}'));
reset role;

update public.companies set vat_filing_frequency = 'monthly', tax_advances_assessed = true where id = (select v from ids where k = 'sas');

-- ---------------------------------------------------------------------------
-- E3 / E4 / A3 / A4 / E7: SAS, monthly VAT, ACD advances
-- ---------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select public.sync_core_compliance_calendar((select v from ids where k = 'sas'), 2026);
select public.sync_core_compliance_calendar((select v from ids where k = 'sarl'), 2026);
select public.sync_core_compliance_calendar((select v from ids where k = 'other'), 2026);
reset role;

select pg_temp.eq('SAS annual accounts approval (6 months)', pg_temp.due((select v from ids where k='sas'), 'annual_accounts_approval'), date '2027-06-30');
select pg_temp.eq('SAS annual accounts filing (7 months)', pg_temp.due((select v from ids where k='sas'), 'annual_accounts_filing'), date '2027-07-31');
select pg_temp.eq('SAS Model 500 (31 Dec N+1)', pg_temp.due((select v from ids where k='sas'), 'model_500'), date '2027-12-31');
select pg_temp.eq('Monthly VAT January: before 15 Feb', pg_temp.due((select v from ids where k='sas'), 'vat_month_01'), date '2026-02-14');
select pg_temp.eq('Monthly VAT December: before 15 Jan', pg_temp.due((select v from ids where k='sas'), 'vat_month_12'), date '2027-01-14');
select pg_temp.eq('Annual VAT for monthly filer: before 1 May', pg_temp.due((select v from ids where k='sas'), 'vat_annual'), date '2027-04-30');
select pg_temp.eq('IRC advance Q1: 10 March', pg_temp.due((select v from ids where k='sas'), 'tax_advances_income_q1'), date '2026-03-10');
select pg_temp.eq('ICC advance Q1: 10 February', pg_temp.due((select v from ids where k='sas'), 'tax_advances_business_q1'), date '2026-02-10');
select pg_temp.eq('IF advance Q4: 10 November', pg_temp.due((select v from ids where k='sas'), 'tax_advances_wealth_q4'), date '2026-11-10');
select pg_temp.eq('French label stored', (select metadata->>'label_fr' from public.compliance_obligations where company_id=(select v from ids where k='sas') and rule_key='vat_month_01'), 'Déclaration TVA mensuelle');

select pg_temp.eq('Annual VAT filer: before 1 March', pg_temp.due((select v from ids where k='sarl'), 'vat_annual'), date '2027-02-28');
select pg_temp.eq('No advances unless assessed', (select count(*) from public.compliance_obligations where company_id=(select v from ids where k='sarl') and rule_key like 'tax_advances%'), 0::bigint);
select pg_temp.eq('OTHER legal form: no annual accounts rule', pg_temp.due((select v from ids where k='other'), 'annual_accounts_approval'), null::date);
select pg_temp.eq('Not VAT registered: no VAT returns', (select count(*) from public.compliance_obligations where company_id=(select v from ids where k='other') and rule_key like 'vat%'), 0::bigint);

-- ---------------------------------------------------------------------------
-- A5: EU recapitulative statement generated for a month with an EU B2B supply
-- ---------------------------------------------------------------------------
insert into public.sales_invoices (organization_id, company_id, status, invoice_number, issue_date, service_date, due_date, vat_treatment, subtotal, vat_total, total)
select organization_id, id, 'issued', 'INV-TEST-1', date '2026-03-20', date '2026-03-18', date '2026-04-20', 'eu_b2b_reverse_charge', 1000, 0, 1000
from public.companies where id = (select v from ids where k = 'sas');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select public.sync_core_compliance_calendar((select v from ids where k = 'sas'), 2026);
reset role;
select pg_temp.eq('EU recap March: before 25 April', pg_temp.due((select v from ids where k='sas'), 'eu_recap_03'), date '2026-04-24');
select pg_temp.eq('No EU recap without EU supplies', pg_temp.due((select v from ids where k='sas'), 'eu_recap_04'), null::date);

-- ---------------------------------------------------------------------------
-- E6: independents (Model 100, advances, annual accounts above EUR 100,000)
-- ---------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set local role authenticated;
insert into ids values ('ind', public.create_independent_workspace_v1(
  'Jane Test', 'Jane Test Consulting', 'jane-test', 'Retail shop', 'commercial', date '2026-01-01', date '2026-01-01',
  'Luxembourg', false, null, null, true, 'A000001'));
insert into ids values ('lib', public.create_independent_workspace_v1(
  'John Test', 'John Test Architect', 'john-test', 'Architecture', 'liberal_profession', date '2026-01-01', date '2026-01-01'));
reset role;
update public.companies set tax_advances_assessed = true where id in ((select v from ids where k = 'ind'), (select v from ids where k = 'lib'));

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set local role authenticated;
select public.sync_core_compliance_calendar((select v from ids where k = 'ind'), 2026);
select public.sync_core_compliance_calendar((select v from ids where k = 'lib'), 2026);
reset role;

select pg_temp.eq('Independent Model 100 (31 Dec N+1)', pg_temp.due((select v from ids where k='ind'), 'model_100'), date '2027-12-31');
select pg_temp.eq('Independent has no Model 500', pg_temp.due((select v from ids where k='ind'), 'model_500'), null::date);
select pg_temp.eq('Independent income tax advance Q2: 10 June', pg_temp.due((select v from ids where k='ind'), 'tax_advances_income_q2'), date '2026-06-10');
select pg_temp.eq('Commercial independent pays ICC advances', pg_temp.due((select v from ids where k='ind'), 'tax_advances_business_q1'), date '2026-02-10');
select pg_temp.eq('Liberal profession: no ICC advances', pg_temp.due((select v from ids where k='lib'), 'tax_advances_business_q1'), null::date);
select pg_temp.eq('Independent: no net wealth tax advances', pg_temp.due((select v from ids where k='ind'), 'tax_advances_wealth_q1'), null::date);
select pg_temp.eq('RCS independent below EUR 100,000: no annual accounts', pg_temp.due((select v from ids where k='ind'), 'annual_accounts_approval'), null::date);

-- ---------------------------------------------------------------------------
-- A1: VAT rates depend on the date of the supply
-- ---------------------------------------------------------------------------
select pg_temp.eq('17 % valid in 2026', public.lu_vat_rate_allowed(17, date '2026-05-01'), true);
select pg_temp.eq('16 % valid in 2023', public.lu_vat_rate_allowed(16, date '2023-06-01'), true);
select pg_temp.eq('17 % not valid in 2023', public.lu_vat_rate_allowed(17, date '2023-06-01'), false);
select pg_temp.eq('13 % not valid in 2024', public.lu_vat_rate_allowed(13, date '2024-01-01'), false);
select pg_temp.eq('7 % valid on 31 Dec 2023', public.lu_vat_rate_allowed(7, date '2023-12-31'), true);
select pg_temp.eq('3 % valid in 2023', public.lu_vat_rate_allowed(3, date '2023-03-01'), true);

-- ---------------------------------------------------------------------------
-- A9 / A12: input VAT deduction (full, pro-rata, none) and reverse charge
-- ---------------------------------------------------------------------------
create function pg_temp.tx(p_company uuid, p_on date, p_direction text, p_gross numeric, p_net numeric, p_vat numeric, p_rate numeric, p_treatment text) returns uuid language plpgsql as $$
declare v uuid;
begin
  -- usage metering checks membership of the acting user
  perform pg_temp.as_user((select o.owner_id from public.organizations o join public.companies c on c.organization_id = o.id where c.id = p_company));
  insert into public.source_transactions (organization_id, company_id, occurred_on, direction, amount_gross, amount_net, vat_amount, vat_rate, vat_treatment, currency, source_type, classification_status, description)
  select organization_id, id, p_on, p_direction, p_gross, p_net, p_vat, p_rate, p_treatment, 'EUR', 'manual', 'unclassified', 'test'
  from public.companies where id = p_company
  returning id into v;
  return v;
end $$;
create function pg_temp.line(p_entry uuid, p_code text) returns numeric language sql as $$
  select coalesce(sum(jl.debit - jl.credit), 0) from public.journal_lines jl
  join public.company_accounts ca on ca.id = jl.company_account_id
  where jl.journal_entry_id = p_entry and ca.code = p_code
$$;
create function pg_temp.post(p_tx uuid, p_code text) returns uuid language plpgsql as $$
declare v uuid;
begin
  perform pg_temp.as_user((select o.owner_id from public.organizations o join public.source_transactions s on s.organization_id = o.id where s.id = p_tx));
  execute 'set local role authenticated';
  v := public.classify_and_post_source_transaction(p_tx, p_code);
  execute 'reset role';
  return v;
end $$;

insert into ids values ('e_full', pg_temp.post(pg_temp.tx((select v from ids where k='sas'), date '2026-04-02', 'expense', 117, 100, 17, 17, 'domestic'), '6132'));
select pg_temp.eq('Full deduction: expense 100', pg_temp.line((select v from ids where k='e_full'), '6132'), 100.00);
select pg_temp.eq('Full deduction: input VAT 17', pg_temp.line((select v from ids where k='e_full'), '421611'), 17.00);
select pg_temp.eq('Full deduction: bank -117', pg_temp.line((select v from ids where k='e_full'), '5131'), -117.00);

update public.companies set vat_deduction_mode = 'partial', vat_deduction_ratio = 60 where id = (select v from ids where k='sarl');
insert into ids values ('e_part', pg_temp.post(pg_temp.tx((select v from ids where k='sarl'), date '2026-04-02', 'expense', 117, 100, 17, 17, 'domestic'), '6132'));
select pg_temp.eq('Pro-rata 60 %: input VAT 10.20', pg_temp.line((select v from ids where k='e_part'), '421611'), 10.20);
select pg_temp.eq('Pro-rata 60 %: expense 106.80', pg_temp.line((select v from ids where k='e_part'), '6132'), 106.80);

insert into ids values ('e_rc', pg_temp.post(pg_temp.tx((select v from ids where k='sarl'), date '2026-04-03', 'expense', 1000, null, 170, 17, 'eu_b2b_reverse_charge'), '6132'));
select pg_temp.eq('Reverse charge pro-rata: expense 1068', pg_temp.line((select v from ids where k='e_rc'), '6132'), 1068.00);
select pg_temp.eq('Reverse charge pro-rata: input VAT 102', pg_temp.line((select v from ids where k='e_rc'), '421611'), 102.00);
select pg_temp.eq('Reverse charge: output VAT 170', pg_temp.line((select v from ids where k='e_rc'), '461411'), -170.00);
select pg_temp.eq('Reverse charge: bank -1000', pg_temp.line((select v from ids where k='e_rc'), '5131'), -1000.00);

insert into ids values ('e_none', pg_temp.post(pg_temp.tx((select v from ids where k='other'), date '2026-04-02', 'expense', 117, 100, 17, 17, 'domestic'), '6132'));
select pg_temp.eq('Not VAT registered: VAT is part of the cost', pg_temp.line((select v from ids where k='e_none'), '6132'), 117.00);
select pg_temp.eq('Not VAT registered: no input VAT', pg_temp.line((select v from ids where k='e_none'), '421611'), 0::numeric);

do $$ begin
  perform pg_temp.post(pg_temp.tx((select v from ids where k='other'), date '2026-04-02', 'income', 117, 100, 17, 17, 'domestic'), '7033');
  raise exception 'FAIL non-registered company charged VAT';
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok   Non-registered company cannot charge VAT';
end $$;
reset role;

do $$ begin
  perform pg_temp.tx((select v from ids where k='sas'), date '2026-04-02', 'expense', 116, 100, 16, 16, 'domestic');
  raise exception 'FAIL 16 %% accepted in 2026';
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok   16 %% rejected for a 2026 transaction';
end $$;
insert into ids values ('tx2023', pg_temp.tx((select v from ids where k='sas'), date '2023-06-02', 'expense', 116, 100, 16, 16, 'domestic'));
select pg_temp.eq('16 % accepted for a 2023 transaction', (select vat_rate from public.source_transactions where id = (select v from ids where k='tx2023')), 16.00);

-- ---------------------------------------------------------------------------
-- A9 / A13 / A14: which VAT is deducted, self-assessment, and corrections
-- ---------------------------------------------------------------------------
create function pg_temp.expect_error(p_label text, p_sql text, p_message_like text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    execute 'reset role';
    if sqlerrm not like p_message_like then raise exception 'FAIL %: unexpected error %', p_label, sqlerrm; end if;
    raise notice 'ok   %', p_label;
    return;
  end;
  execute 'reset role';
  raise exception 'FAIL %: no error', p_label;
end $$;
create function pg_temp.correct(p_tx uuid, p_gross numeric, p_net numeric, p_vat numeric, p_rate numeric, p_treatment text, p_direction text default 'expense') returns void language plpgsql as $$
begin
  perform pg_temp.as_user((select o.owner_id from public.organizations o join public.source_transactions s on s.organization_id = o.id where s.id = p_tx));
  execute 'set local role authenticated';
  perform public.correct_source_transaction(p_tx, (select occurred_on from public.source_transactions where id = p_tx), p_direction,
    p_gross, p_net, p_vat, p_rate, p_treatment, 'Supplier', 'corrected', 'LU');
  execute 'reset role';
end $$;
create function pg_temp.entry(p_tx uuid) returns uuid language sql as $$
  select posted_journal_entry_id from public.source_transactions where id = p_tx
$$;
grant execute on all functions in schema pg_temp to authenticated;

-- Foreign VAT (recorded under a non-Luxembourg treatment) is never deducted: it is part of the cost.
insert into ids values ('e_foreign', pg_temp.post(pg_temp.tx((select v from ids where k='sas'), date '2026-04-05', 'expense', 120, 100, 20, null, 'non_eu'), '6132'));
select pg_temp.eq('Foreign VAT: whole amount is the cost', pg_temp.line((select v from ids where k='e_foreign'), '6132'), 120.00);
select pg_temp.eq('Foreign VAT: no input VAT', pg_temp.line((select v from ids where k='e_foreign'), '421611'), 0::numeric);

-- VAT with an unconfirmed treatment, and an EU purchase without self-assessed VAT, are not posted.
insert into ids values ('e_unknown', pg_temp.tx((select v from ids where k='sas'), date '2026-04-05', 'expense', 117, 100, 17, 17, 'unknown'));
select pg_temp.expect_error('VAT with an unconfirmed treatment is not posted',
  format('select public.classify_and_post_source_transaction(%L, %L)', (select v from ids where k='e_unknown'), '6132'), '%Confirm the VAT situation%');
insert into ids values ('e_rc0', pg_temp.tx((select v from ids where k='sas'), date '2026-04-05', 'expense', 500, 500, 0, 0, 'eu_b2b_reverse_charge'));
select pg_temp.expect_error('EU purchase without self-assessed VAT is not posted',
  format('select public.classify_and_post_source_transaction(%L, %L)', (select v from ids where k='e_rc0'), '6132'), '%self-assess%');

-- An intra-Community acquisition of goods is self-assessed like a reverse-charge service.
insert into ids values ('e_acq', pg_temp.post(pg_temp.tx((select v from ids where k='sas'), date '2026-04-06', 'expense', 200, null, 34, 17, 'eu_acquisition'), '6132'));
select pg_temp.eq('Intra-Community acquisition: output VAT 34', pg_temp.line((select v from ids where k='e_acq'), '461411'), -34.00);
select pg_temp.eq('Intra-Community acquisition: input VAT 34', pg_temp.line((select v from ids where k='e_acq'), '421611'), 34.00);
select pg_temp.eq('Intra-Community acquisition: bank -200', pg_temp.line((select v from ids where k='e_acq'), '5131'), -200.00);

-- Correcting a posted purchase from 17 % to 8 % reverses the entry and posts the corrected VAT.
insert into ids values ('t_corr', pg_temp.tx((select v from ids where k='sas'), date '2026-04-02', 'expense', 117, 100, 17, 17, 'domestic'));
insert into ids values ('t_corr_entry', pg_temp.post((select v from ids where k='t_corr'), '6132'));
select pg_temp.correct((select v from ids where k='t_corr'), 108, 100, 8, 8, 'domestic');
select pg_temp.eq('Correction: transaction posted again', (select classification_status from public.source_transactions where id = (select v from ids where k='t_corr')), 'posted');
select pg_temp.eq('Correction: new rate stored', (select vat_rate from public.source_transactions where id = (select v from ids where k='t_corr')), 8.00);
select pg_temp.eq('Correction: input VAT 8', pg_temp.line(pg_temp.entry((select v from ids where k='t_corr')), '421611'), 8.00);
select pg_temp.eq('Correction: original entry reversed', (select count(*) from public.journal_entries where reversal_of = (select v from ids where k='t_corr_entry') and status = 'posted'), 1::bigint);

-- Correcting a posted purchase to an EU reverse charge self-assesses the VAT on the amount paid.
select pg_temp.correct((select v from ids where k='t_corr'), 1000, 1000, 170, 17, 'eu_b2b_reverse_charge');
select pg_temp.eq('Correction to reverse charge: no separate net amount', (select amount_net from public.source_transactions where id = (select v from ids where k='t_corr')), null::numeric);
select pg_temp.eq('Correction to reverse charge: expense 1000', pg_temp.line(pg_temp.entry((select v from ids where k='t_corr')), '6132'), 1000.00);
select pg_temp.eq('Correction to reverse charge: output VAT 170', pg_temp.line(pg_temp.entry((select v from ids where k='t_corr')), '461411'), -170.00);
select pg_temp.eq('Correction to reverse charge: input VAT 170', pg_temp.line(pg_temp.entry((select v from ids where k='t_corr')), '421611'), 170.00);

-- The older correction function keeps the stored treatment.
do $$ begin
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
  set local role authenticated;
  perform public.update_source_transaction_safe((select v from ids where k='t_corr'), date '2026-04-02', 'expense', 2000, 340, 'Supplier', 'legacy');
  reset role;
end $$;
select pg_temp.eq('Legacy correction keeps reverse charge', (select vat_treatment || ' ' || coalesce(amount_net::text, 'no net') from public.source_transactions where id = (select v from ids where k='t_corr')), 'eu_b2b_reverse_charge no net');
select pg_temp.eq('Legacy correction: output VAT 340', pg_temp.line(pg_temp.entry((select v from ids where k='t_corr')), '461411'), -340.00);

-- A sale to an EU business customer carries no Luxembourg VAT.
insert into ids values ('i_eu', pg_temp.tx((select v from ids where k='sas'), date '2026-04-07', 'income', 1000, 1000, 0, 0, 'domestic'));
select pg_temp.expect_error('Correction refuses Luxembourg VAT on an EU B2B sale',
  format('select pg_temp.correct(%L, 1170, 1000, 170, 17, %L, %L)', (select v from ids where k='i_eu'), 'eu_b2b_reverse_charge', 'income'), '%carries no Luxembourg VAT%');
select pg_temp.expect_error('Correction refuses VAT with an unconfirmed treatment',
  format('select pg_temp.correct(%L, 117, 100, 17, 17, %L)', (select v from ids where k='e_unknown'), 'unknown'), '%Choose Luxembourg VAT%');

-- Document intake: rates by date, foreign VAT flagged, the bank amount kept.
create function pg_temp.doc(p_company uuid, p_data jsonb) returns uuid language sql as $$
  insert into public.documents (organization_id, company_id, type, storage_path, file_name, extraction_status, extracted_data)
  select organization_id, id, 'purchase_invoice', 'test/' || gen_random_uuid(), 'invoice.pdf', 'needs_review', p_data
  from public.companies where id = p_company
  returning id
$$;
create function pg_temp.from_doc(p_doc uuid) returns uuid language plpgsql as $$
declare v uuid;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
  execute 'set local role authenticated';
  v := (public.create_source_transaction_from_document(p_doc)->>'transaction_id')::uuid;
  execute 'reset role';
  return v;
end $$;
grant execute on all functions in schema pg_temp to authenticated;

insert into ids values ('d_2023', pg_temp.from_doc(pg_temp.doc((select v from ids where k='sas'),
  '{"document_kind":"purchase_invoice","total":116,"subtotal":100,"vat_amount":16,"vat_rate":16,"document_date":"2023-05-10","currency":"EUR","issuer_name":"Fournisseur SA","issuer_country":"LU","suggested_vat_treatment":"domestic","transaction_direction":"expense"}')));
select pg_temp.eq('Document from 2023 keeps its 16 % rate', (select vat_rate from public.source_transactions where id = (select v from ids where k='d_2023')), 16.00);

insert into ids values ('d_foreign', pg_temp.from_doc(pg_temp.doc((select v from ids where k='sas'),
  '{"document_kind":"purchase_invoice","total":119,"subtotal":100,"vat_amount":19,"vat_rate":19,"document_date":"2026-05-10","currency":"EUR","issuer_name":"Hotel GmbH","issuer_country":"DE","suggested_vat_treatment":"domestic","transaction_direction":"expense"}')));
select pg_temp.eq('Foreign VAT on a document is flagged for review', (select vat_treatment || ' ' || coalesce(vat_rate::text, 'no rate') from public.source_transactions where id = (select v from ids where k='d_foreign')), 'unknown no rate');

-- A document matched to a bank movement does not change the amount paid.
insert into ids values ('bank_tx', pg_temp.tx((select v from ids where k='sas'), date '2026-05-12', 'expense', 117, null, null, null, 'unknown'));
update public.source_transactions set source_type = 'bank' where id = (select v from ids where k='bank_tx');
insert into ids values ('d_bank', pg_temp.doc((select v from ids where k='sas'),
  '{"document_kind":"purchase_invoice","total":117.01,"subtotal":100,"vat_amount":17,"vat_rate":17,"document_date":"2026-05-12","currency":"EUR","issuer_name":"Fournisseur SA","issuer_country":"LU","suggested_vat_treatment":"domestic"}'));
insert into public.document_transaction_links (organization_id, company_id, document_id, source_transaction_id, match_score, status, match_reason, created_by)
select organization_id, company_id, (select v from ids where k='d_bank'), id, 0.95, 'suggested', 'test', '00000000-0000-0000-0000-00000000000a'
from public.source_transactions where id = (select v from ids where k='bank_tx');
do $$ begin
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
  set local role authenticated;
  perform public.apply_document_facts_to_transaction((select id from public.document_transaction_links where document_id = (select v from ids where k='d_bank')));
  reset role;
end $$;
select pg_temp.eq('Bank amount kept, document VAT applied', (select amount_gross || ' ' || vat_amount || ' ' || amount_net || ' ' || vat_treatment from public.source_transactions where id = (select v from ids where k='bank_tx')), '117.00 17.00 100.00 domestic');

-- ---------------------------------------------------------------------------
-- A7 / A8: VAT mention fixed on issued invoices
-- ---------------------------------------------------------------------------
create function pg_temp.issue(p_company uuid, p_treatment text, p_country text, p_customer_vat text, p_rate numeric) returns uuid language plpgsql as $$
declare v uuid;
begin
  perform pg_temp.as_user((select o.owner_id from public.organizations o join public.companies c on c.organization_id = o.id where c.id = p_company));
  execute 'set local role authenticated';
  v := public.save_service_invoice_draft(p_company, null, 'Client SA', 'client@example.test', p_country, p_customer_vat,
        '{"street":"1 rue Client","postal_code":"1111","city":"Ville","country":"LU"}'::jsonb, date '2026-05-01', date '2026-05-01', date '2026-05-31',
        'EUR', null, p_treatment, jsonb_build_array(jsonb_build_object('description','Consulting','quantity',1,'unit_price',1000,'vat_rate',p_rate)), null);
  perform public.issue_service_invoice_draft(v);
  execute 'reset role';
  return v;
end $$;

insert into ids values ('inv1', pg_temp.issue((select v from ids where k='other'), 'domestic', 'LU', null, 0));
select pg_temp.eq('Franchise invoice mentions art. 57bis', (select vat_exemption_mention from public.sales_invoices where id = (select v from ids where k='inv1')), 'TVA non applicable – Article 57bis de la loi modifiée du 12 février 1979');
insert into ids values ('inv2', pg_temp.issue((select v from ids where k='sas'), 'eu_b2b_reverse_charge', 'DE', 'DE123456789', 0));
select pg_temp.eq('Reverse-charge invoice mentions autoliquidation', (select vat_exemption_mention from public.sales_invoices where id = (select v from ids where k='inv2')), 'Autoliquidation');
insert into ids values ('inv3', pg_temp.issue((select v from ids where k='sas'), 'domestic', 'LU', null, 17));
select pg_temp.eq('Standard VAT invoice has no exemption mention', (select vat_exemption_mention from public.sales_invoices where id = (select v from ids where k='inv3')), null::text);
update public.companies set vat_exemption_basis = 'exempt_activity', vat_deduction_mode = 'none', vat_deduction_ratio = null where id = (select v from ids where k='sarl');
insert into ids values ('inv4', pg_temp.issue((select v from ids where k='sarl'), 'domestic', 'LU', null, 0));
select pg_temp.eq('Exempt-activity invoice mentions art. 44', (select vat_exemption_mention from public.sales_invoices where id = (select v from ids where k='inv4')), 'Exonération de TVA – article 44 de la loi modifiée du 12 février 1979');

do $$ begin
  update public.sales_invoices set vat_exemption_mention = 'changed' where invoice_number is not null and company_id = (select v from ids where k='other');
  raise exception 'FAIL issued invoice mention was changed';
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok   Mention on an issued invoice is immutable';
end $$;

-- ---------------------------------------------------------------------------
-- H1: retention — issued invoices and ended years cannot be wiped by a reset
-- ---------------------------------------------------------------------------
do $$ begin
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
  set local role authenticated;
  perform public.reset_financial_year((select v from ids where k='sas'), 2026, 'RESET 2026');
  raise exception 'FAIL reset deleted issued invoices';
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok   Reset refused when issued invoices exist (%)', sqlerrm;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- E3: RCS-registered independent with turnover above EUR 100,000 files annual accounts
-- ---------------------------------------------------------------------------
select pg_temp.post(pg_temp.tx((select v from ids where k='ind'), date '2026-06-30', 'income', 120000, 120000, 0, 0, 'domestic'), '7033');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set local role authenticated;
select public.sync_core_compliance_calendar((select v from ids where k = 'ind'), 2026);
reset role;
select pg_temp.eq('RCS independent above EUR 100,000: annual accounts filing', pg_temp.due((select v from ids where k='ind'), 'annual_accounts_filing'), date '2027-07-31');

-- ---------------------------------------------------------------------------
-- G5: the establishment-authorisation barcode is frozen into the issued invoice
-- ---------------------------------------------------------------------------
update public.companies set establishment_barcode_path = 'org/company/barcode/test.png' where id = (select v from ids where k='lib');
insert into ids values ('inv_barcode', pg_temp.issue((select v from ids where k='lib'), 'domestic', 'LU', null, 0));
update public.companies set establishment_barcode_path = 'org/company/barcode/changed.png' where id = (select v from ids where k='lib');
select pg_temp.eq('Barcode frozen in the issuer snapshot', (select issuer_snapshot->>'establishment_barcode_path' from public.sales_invoices where id = (select v from ids where k='inv_barcode')), 'org/company/barcode/test.png');

rollback;
