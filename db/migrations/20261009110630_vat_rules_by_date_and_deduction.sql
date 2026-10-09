-- VAT rules by date, input VAT deduction rights and invoice exemption mentions
-- (regulatory register A1, A6, A7, A8, A9, A12)
--
-- * public.vat_rate_periods: Luxembourg VAT rates with their validity dates, including the
--   temporary 2023 rates (16 / 13 / 7 %). Rates are validated against the date of the supply.
-- * companies.vat_exemption_basis / vat_deduction_mode / vat_deduction_ratio: whether the
--   business is under the small-business franchise (LTVA art. 57bis) or carries on exempt
--   activities (LTVA art. 44), and how much input VAT it may deduct (full, none, pro-rata).
-- * Posting a purchase now splits VAT into a deductible part (421611) and a non-deductible
--   part that is added to the cost. Non-VAT-registered businesses can record VAT on purchases.
-- * Issued invoices store the legally required exemption / reverse-charge mention.
--
-- The updated save_service_invoice_draft and protect_issued_sales_invoice functions are in
-- 20261009120000_requires_approval_bundle.sql (the connector asks for approval for SQL with row removals).

-- ---------------------------------------------------------------------------
-- VAT rates by date
-- ---------------------------------------------------------------------------
create table if not exists public.vat_rate_periods (
  rate numeric(5,2) not null,
  rate_kind text not null check (rate_kind in ('standard','intermediate','reduced','super_reduced','zero')),
  effective_from date not null,
  effective_to date,
  source_url text not null,
  primary key (rate, effective_from),
  check (effective_to is null or effective_to >= effective_from)
);
comment on table public.vat_rate_periods is 'Luxembourg VAT rates and their validity periods (LTVA art. 39-40). Source of truth for rate validation.';

alter table public.vat_rate_periods enable row level security;
do $$ begin
  create policy vat_rate_periods_read on public.vat_rate_periods for select to authenticated using (true);
exception when duplicate_object then null; end $$;
revoke all on table public.vat_rate_periods from public, anon, authenticated;
grant select on table public.vat_rate_periods to authenticated;
grant all on table public.vat_rate_periods to service_role;

insert into public.vat_rate_periods (rate, rate_kind, effective_from, effective_to, source_url) values
  (0,  'zero',          '2015-01-01', null,         'https://legilux.public.lu/eli/etat/leg/loi/1979/02/12/n1/jo'),
  (3,  'super_reduced', '2015-01-01', null,         'https://legilux.public.lu/eli/etat/leg/loi/1979/02/12/n1/jo'),
  (8,  'reduced',       '2015-01-01', '2022-12-31', 'https://legilux.public.lu/eli/etat/leg/loi/1979/02/12/n1/jo'),
  (7,  'reduced',       '2023-01-01', '2023-12-31', 'https://trade.ec.europa.eu/access-to-markets/fr/news/modifications-des-taux-de-tva-applicables-au-1-janvier-2024-dans-certains-etats-membres-de-lue'),
  (8,  'reduced',       '2024-01-01', null,         'https://trade.ec.europa.eu/access-to-markets/fr/news/modifications-des-taux-de-tva-applicables-au-1-janvier-2024-dans-certains-etats-membres-de-lue'),
  (14, 'intermediate',  '2015-01-01', '2022-12-31', 'https://legilux.public.lu/eli/etat/leg/loi/1979/02/12/n1/jo'),
  (13, 'intermediate',  '2023-01-01', '2023-12-31', 'https://trade.ec.europa.eu/access-to-markets/fr/news/modifications-des-taux-de-tva-applicables-au-1-janvier-2024-dans-certains-etats-membres-de-lue'),
  (14, 'intermediate',  '2024-01-01', null,         'https://trade.ec.europa.eu/access-to-markets/fr/news/modifications-des-taux-de-tva-applicables-au-1-janvier-2024-dans-certains-etats-membres-de-lue'),
  (17, 'standard',      '2015-01-01', '2022-12-31', 'https://legilux.public.lu/eli/etat/leg/loi/1979/02/12/n1/jo'),
  (16, 'standard',      '2023-01-01', '2023-12-31', 'https://trade.ec.europa.eu/access-to-markets/fr/news/modifications-des-taux-de-tva-applicables-au-1-janvier-2024-dans-certains-etats-membres-de-lue'),
  (17, 'standard',      '2024-01-01', null,         'https://trade.ec.europa.eu/access-to-markets/fr/news/modifications-des-taux-de-tva-applicables-au-1-janvier-2024-dans-certains-etats-membres-de-lue')
on conflict do nothing;

create or replace function public.lu_vat_rate_allowed(p_rate numeric, p_on date)
returns boolean
language sql
stable
set search_path to 'pg_catalog', 'public'
as $$
  select p_rate is null or exists (
    select 1 from public.vat_rate_periods
    where rate = p_rate and effective_from <= coalesce(p_on, current_date)
      and (effective_to is null or effective_to >= coalesce(p_on, current_date)))
$$;
revoke all on function public.lu_vat_rate_allowed(numeric, date) from public, anon;
grant execute on function public.lu_vat_rate_allowed(numeric, date) to authenticated, service_role;

create or replace function app_private.validate_source_transaction_vat_rate()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $$
begin
  if not public.lu_vat_rate_allowed(new.vat_rate, new.occurred_on) then
    raise exception 'Unsupported Luxembourg VAT rate % for a transaction on %', new.vat_rate, new.occurred_on;
  end if;
  return new;
end $$;

create or replace trigger source_transactions_validate_vat_rate
  before insert or update of vat_rate, occurred_on on public.source_transactions
  for each row execute function app_private.validate_source_transaction_vat_rate();

-- ---------------------------------------------------------------------------
-- Deduction rights and exemption basis
-- ---------------------------------------------------------------------------
alter table public.companies
  add column if not exists vat_exemption_basis text,
  add column if not exists vat_deduction_mode text not null default 'full',
  add column if not exists vat_deduction_ratio numeric(5,2);

do $$ begin
  alter table public.companies add constraint companies_vat_exemption_basis_check check (vat_exemption_basis in ('franchise','exempt_activity'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.companies add constraint companies_vat_deduction_mode_check check (vat_deduction_mode in ('full','partial','none'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.companies add constraint companies_vat_deduction_ratio_check check (
    (vat_deduction_mode = 'partial' and vat_deduction_ratio between 0 and 100)
    or (vat_deduction_mode <> 'partial' and vat_deduction_ratio is null));
exception when duplicate_object then null; end $$;

comment on column public.companies.vat_exemption_basis is
  'Why the business does not charge VAT on (some) supplies: franchise = small-business scheme (LTVA art. 57bis), exempt_activity = exempt supplies (LTVA art. 44).';
comment on column public.companies.vat_deduction_mode is
  'Right to deduct input VAT: full, partial (pro-rata in vat_deduction_ratio) or none. Ignored (treated as none) when the company is not VAT registered.';

create or replace function app_private.vat_deduction_share(p_company public.companies)
returns numeric
language sql
immutable
as $$
  select case
    when not p_company.vat_registered then 0
    when p_company.vat_deduction_mode = 'none' then 0
    when p_company.vat_deduction_mode = 'partial' then coalesce(p_company.vat_deduction_ratio, 0) / 100
    else 1 end
$$;
revoke all on function app_private.vat_deduction_share(public.companies) from public, anon;
grant execute on function app_private.vat_deduction_share(public.companies) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Invoice exemption / reverse-charge mention, fixed at issue time
-- ---------------------------------------------------------------------------
alter table public.sales_invoices add column if not exists vat_exemption_mention text;
comment on column public.sales_invoices.vat_exemption_mention is
  'Legal VAT mention printed on the invoice, fixed when the invoice is issued (art. 57bis franchise, art. 44 exemption, or reverse charge).';

create or replace function app_private.sales_invoice_issue_checks()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public', 'app_private'
as $$
declare
  v_company public.companies%rowtype;
  v_bad_rate numeric;
begin
  if new.status <> 'draft' and (tg_op = 'INSERT' or old.status = 'draft') then
    select l.vat_rate into v_bad_rate from public.sales_invoice_lines l
    where l.invoice_id = new.id and not public.lu_vat_rate_allowed(l.vat_rate, new.service_date) limit 1;
    if found then
      raise exception 'Unsupported Luxembourg VAT rate % for a supply on %', v_bad_rate, new.service_date;
    end if;

    select * into v_company from public.companies where id = new.company_id;
    new.vat_exemption_mention := case
      when new.vat_treatment = 'eu_b2b_reverse_charge' then 'Autoliquidation'
      when new.vat_treatment = 'domestic' and new.vat_total = 0 and v_company.vat_exemption_basis = 'exempt_activity'
        then 'Exonération de TVA – article 44 de la loi modifiée du 12 février 1979'
      when new.vat_treatment = 'domestic' and new.vat_total = 0 and (v_company.vat_exemption_basis = 'franchise' or not v_company.vat_registered)
        then 'TVA non applicable – Article 57bis de la loi modifiée du 12 février 1979'
      else null end;
  end if;
  return new;
end $$;

create or replace trigger sales_invoices_issue_checks
  before insert or update of status on public.sales_invoices
  for each row execute function app_private.sales_invoice_issue_checks();

create or replace function app_private.validate_sales_invoice_line_vat_rate()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $$
declare v_date date;
begin
  select coalesce(service_date, issue_date) into v_date from public.sales_invoices where id = new.invoice_id;
  if not public.lu_vat_rate_allowed(new.vat_rate, v_date) then
    raise exception 'Unsupported Luxembourg VAT rate % for a supply on %', new.vat_rate, v_date;
  end if;
  return new;
end $$;

create or replace trigger sales_invoice_lines_validate_vat_rate
  before insert or update of vat_rate on public.sales_invoice_lines
  for each row execute function app_private.validate_sales_invoice_line_vat_rate();

revoke all on function app_private.validate_source_transaction_vat_rate() from public, anon;
revoke all on function app_private.sales_invoice_issue_checks() from public, anon;
revoke all on function app_private.validate_sales_invoice_line_vat_rate() from public, anon;

-- ---------------------------------------------------------------------------
-- Functions updated for the rules above
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.classify_and_post_source_transaction(p_source_transaction_id uuid, p_account_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'app_private'
AS $function$
declare
 v_uid uuid:=auth.uid();
 v_tx public.source_transactions%rowtype;
 v_selected public.company_accounts%rowtype;
 v_bank public.company_accounts%rowtype;
 v_vat_in public.company_accounts%rowtype;
 v_vat_out public.company_accounts%rowtype;
 v_company public.companies%rowtype;
 v_period_id uuid;
 v_period_start date;
 v_period_end date;
 v_period_year integer;
 v_entry_id uuid;
 v_entry_number bigint;
 v_net numeric(18,2);
 v_vat_amount numeric(18,2);
 v_description text;
 v_is_expense_refund boolean:=false;
 v_reverse boolean:=false;
 v_fx numeric(18,8);
 v_base_gross numeric(18,2);
 v_base_net numeric(18,2);
 v_base_vat numeric(18,2);
 v_base_currency text;
 v_share numeric;
 v_deductible numeric(18,2):=0;
 v_non_deductible numeric(18,2):=0;
 v_orig_deductible numeric(18,2):=0;
 v_orig_non_deductible numeric(18,2):=0;
 v_foreign text;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 select * into v_tx from public.source_transactions where id=p_source_transaction_id for update;
 if not found then raise exception 'Source transaction not found or not accessible'; end if;
 if not app_private.can_bookkeep_org(v_tx.organization_id) then raise exception 'You do not have permission to post accounting entries for this company'; end if;
 if v_tx.classification_status='posted' or v_tx.posted_journal_entry_id is not null then raise exception 'This transaction has already been posted'; end if;

 select * into v_company from public.companies where id=v_tx.company_id;
 v_base_currency:=upper(trim(v_company.base_currency::text));
 if upper(trim(v_tx.currency))=v_base_currency then
   v_fx:=1;
 else
   v_fx:=v_tx.exchange_rate_to_base;
   if v_fx is null or v_fx<=0 then
     raise exception 'An exchange rate is required before posting this foreign-currency transaction';
   end if;
 end if;

 select * into v_selected from public.company_accounts where company_id=v_tx.company_id and code=trim(p_account_code) and is_active=true;
 if not found then raise exception 'Accounting category % is not available for this company',p_account_code; end if;

 v_is_expense_refund:=v_tx.direction='income' and v_selected.account_type='expense';
 v_reverse:=v_tx.direction='expense' and v_tx.vat_treatment='eu_b2b_reverse_charge';
 if v_tx.direction='income' and v_selected.account_type not in ('revenue','asset','liability','expense') then raise exception 'Bank inflows must be classified to revenue, a supplier-refund expense account, or an eligible balance-sheet account'; end if;
 if v_tx.direction='expense' and v_selected.account_type not in ('expense','asset','liability') then raise exception 'Bank outflows must be classified to an expense or eligible balance-sheet account'; end if;

 select * into v_bank from public.company_accounts where company_id=v_tx.company_id and code='5131' and is_active=true;
 if not found then raise exception 'The company bank ledger account (5131) is missing'; end if;

 v_vat_amount:=coalesce(v_tx.vat_amount,0);
 v_net:=coalesce(v_tx.amount_net,case when v_reverse then v_tx.amount_gross else round(v_tx.amount_gross-v_vat_amount,2) end);
 v_base_gross:=round(v_tx.amount_gross*v_fx,2);
 v_base_net:=round(v_net*v_fx,2);
 v_base_vat:=round(v_vat_amount*v_fx,2);
 v_foreign:=case when upper(trim(v_tx.currency))<>v_base_currency then upper(trim(v_tx.currency)) else null end;
 -- Share of input VAT the company may deduct (LTVA: none for non-registered or exempt activities, pro-rata for mixed activities).
 v_share:=app_private.vat_deduction_share(v_company);
 if v_tx.direction='expense' or v_is_expense_refund then
   v_deductible:=round(v_base_vat*v_share,2); v_non_deductible:=v_base_vat-v_deductible;
   v_orig_deductible:=round(v_vat_amount*v_share,2); v_orig_non_deductible:=v_vat_amount-v_orig_deductible;
 end if;

 if v_selected.account_type in ('asset','liability') and v_vat_amount<>0 then raise exception 'Balance-sheet transfers cannot carry VAT in this workflow'; end if;
 if v_vat_amount>0 then
   if not v_company.vat_registered and v_tx.direction='income' and not v_is_expense_refund then raise exception 'VAT cannot be charged by a company that is not marked as VAT registered'; end if;
   select * into v_vat_in from public.company_accounts where company_id=v_tx.company_id and code='421611' and is_active=true;
   select * into v_vat_out from public.company_accounts where company_id=v_tx.company_id and code='461411' and is_active=true;
   if v_reverse and v_vat_out.id is null then raise exception 'Reverse-charge VAT accounts are missing'; end if;
   if v_tx.direction='income' and not v_is_expense_refund and v_vat_out.id is null then raise exception 'The required VAT ledger account is missing'; end if;
   if v_deductible>0 and v_vat_in.id is null then raise exception 'The required VAT ledger account is missing'; end if;
 end if;

 v_period_year:=extract(year from v_tx.occurred_on)::integer;
 if extract(month from v_tx.occurred_on)::integer<v_company.fiscal_year_start_month then v_period_year:=v_period_year-1; end if;
 v_period_start:=make_date(v_period_year,v_company.fiscal_year_start_month,1);
 v_period_end:=(v_period_start+interval '1 year - 1 day')::date;
 select id into v_period_id from public.accounting_periods where company_id=v_tx.company_id and starts_on=v_period_start and ends_on=v_period_end and status in ('open','soft_closed') limit 1;
 if v_period_id is null then
   insert into public.accounting_periods(organization_id,company_id,starts_on,ends_on,status)
   values(v_tx.organization_id,v_tx.company_id,v_period_start,v_period_end,'open')
   on conflict(company_id,starts_on,ends_on) do nothing;
   select id into v_period_id from public.accounting_periods where company_id=v_tx.company_id and starts_on=v_period_start and ends_on=v_period_end and status in ('open','soft_closed') limit 1;
 end if;
 if v_period_id is null then raise exception 'The accounting period is closed or locked'; end if;

 perform pg_advisory_xact_lock(hashtextextended(v_tx.company_id::text,0));
 select coalesce(max(entry_number),0)+1 into v_entry_number from public.journal_entries where company_id=v_tx.company_id;
 v_description:=coalesce(nullif(v_tx.counterparty_name,''),nullif(v_tx.description,''),case when v_tx.direction='income' then 'Bank inflow' else 'Bank outflow' end);

 insert into public.journal_entries(organization_id,company_id,accounting_period_id,entry_number,entry_date,document_date,description,source_type,source_id,status,created_by)
 values(v_tx.organization_id,v_tx.company_id,v_period_id,v_entry_number,v_tx.occurred_on,v_tx.occurred_on,v_description,v_tx.source_type,v_tx.id,'draft',v_uid)
 returning id into v_entry_id;

 if v_tx.direction='income' then
   insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,description,debit,credit,currency,exchange_rate,original_currency,original_debit,original_credit)
   values(v_tx.organization_id,v_entry_id,v_bank.id,v_description,v_base_gross,0,v_base_currency,v_fx,v_foreign,case when v_foreign is not null then v_tx.amount_gross else null end,0);
   -- A supplier refund also reverses the VAT that was not deductible (it was part of the cost).
   insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,description,debit,credit,currency,exchange_rate,original_currency,original_debit,original_credit)
   values(v_tx.organization_id,v_entry_id,v_selected.id,v_description,0,v_base_net+v_non_deductible,v_base_currency,v_fx,v_foreign,0,case when v_foreign is not null then v_net+v_orig_non_deductible else null end);
   if v_vat_amount>0 then
     if v_is_expense_refund then
       if v_deductible>0 then
         insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,description,debit,credit,currency,exchange_rate,vat_code,vat_rate,vat_amount,original_currency,original_debit,original_credit)
         values(v_tx.organization_id,v_entry_id,v_vat_in.id,'Input VAT reversal',0,v_deductible,v_base_currency,v_fx,'INPUT_REVERSAL',v_tx.vat_rate,v_deductible,v_foreign,0,case when v_foreign is not null then v_orig_deductible else null end);
       end if;
     else
       insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,description,debit,credit,currency,exchange_rate,vat_code,vat_rate,vat_amount,original_currency,original_debit,original_credit)
       values(v_tx.organization_id,v_entry_id,v_vat_out.id,'Output VAT',0,v_base_vat,v_base_currency,v_fx,'OUTPUT',v_tx.vat_rate,v_base_vat,v_foreign,0,case when v_foreign is not null then v_vat_amount else null end);
     end if;
   end if;
 else
   -- Non-deductible input VAT is part of the cost of the purchase.
   insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,description,debit,credit,currency,exchange_rate,vat_code,vat_rate,vat_amount,original_currency,original_debit,original_credit)
   values(v_tx.organization_id,v_entry_id,v_selected.id,v_description,v_base_net+v_non_deductible,0,v_base_currency,v_fx,case when v_reverse then 'RC_BASE' else null end,v_tx.vat_rate,case when v_reverse then v_base_vat else null end,v_foreign,case when v_foreign is not null then v_net+v_orig_non_deductible else null end,0);
   if v_vat_amount>0 then
     if v_reverse then
       if v_deductible>0 then
         insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,description,debit,credit,currency,exchange_rate,vat_code,vat_rate,vat_amount,original_currency,original_debit,original_credit)
         values(v_tx.organization_id,v_entry_id,v_vat_in.id,'Reverse-charge input VAT',v_deductible,0,v_base_currency,v_fx,'RC_INPUT',v_tx.vat_rate,v_deductible,v_foreign,case when v_foreign is not null then v_orig_deductible else null end,0);
       end if;
       insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,description,debit,credit,currency,exchange_rate,vat_code,vat_rate,vat_amount,original_currency,original_debit,original_credit)
       values(v_tx.organization_id,v_entry_id,v_vat_out.id,'Reverse-charge output VAT',0,v_base_vat,v_base_currency,v_fx,'RC_OUTPUT',v_tx.vat_rate,v_base_vat,v_foreign,0,case when v_foreign is not null then v_vat_amount else null end);
     elsif v_deductible>0 then
       insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,description,debit,credit,currency,exchange_rate,vat_code,vat_rate,vat_amount,original_currency,original_debit,original_credit)
       values(v_tx.organization_id,v_entry_id,v_vat_in.id,'Input VAT',v_deductible,0,v_base_currency,v_fx,'INPUT',v_tx.vat_rate,v_deductible,v_foreign,case when v_foreign is not null then v_orig_deductible else null end,0);
     end if;
   end if;
   insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,description,debit,credit,currency,exchange_rate,original_currency,original_debit,original_credit)
   values(v_tx.organization_id,v_entry_id,v_bank.id,v_description,0,v_base_gross,v_base_currency,v_fx,v_foreign,0,case when v_foreign is not null then v_tx.amount_gross else null end);
 end if;

 perform public.post_journal_entry(v_entry_id);
 update public.source_transactions
 set suggested_account_id=v_selected.id,
     classification_status='posted',
     posted_journal_entry_id=v_entry_id,
     exchange_rate_to_base=v_fx,
     suggestion_kind=case when v_reverse then 'reverse_charge' when v_is_expense_refund then 'expense_refund' else suggestion_kind end,
     updated_at=now()
 where id=v_tx.id;
 return v_entry_id;
end
$function$
;

CREATE OR REPLACE FUNCTION public.create_and_issue_service_invoice(p_company_id uuid, p_customer_name text, p_customer_email text, p_customer_country text, p_customer_vat_number text, p_customer_address jsonb, p_issue_date date, p_service_date date, p_due_date date, p_vat_treatment text, p_lines jsonb, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_company public.companies%rowtype;
  v_contact_id uuid;
  v_invoice_id uuid;
  v_invoice_number text;
  v_seq bigint;
  v_year integer;
  v_line jsonb;
  v_line_no integer:=0;
  v_desc text;
  v_qty numeric(18,4);
  v_unit numeric(18,4);
  v_rate numeric(5,2);
  v_net numeric(18,2);
  v_vat numeric(18,2);
  v_gross numeric(18,2);
  v_subtotal numeric(18,2):=0;
  v_vat_total numeric(18,2):=0;
  v_total numeric(18,2):=0;
  v_receivable public.company_accounts%rowtype;
  v_revenue public.company_accounts%rowtype;
  v_vat_account public.company_accounts%rowtype;
  v_period_id uuid; v_period_start date; v_period_end date; v_period_year integer;
  v_entry_id uuid; v_entry_number bigint;
  v_customer_snapshot jsonb; v_issuer_snapshot jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_company from public.companies where id=p_company_id;
  if not found then raise exception 'Company not found'; end if;
  if not app_private.can_bookkeep_org(v_company.organization_id) then raise exception 'You do not have permission to issue invoices for this company'; end if;
  if coalesce(v_company.registered_address,'{}'::jsonb)='{}'::jsonb then raise exception 'Complete the registered office address before issuing an invoice'; end if;
  if v_company.vat_registered and nullif(trim(v_company.vat_number),'') is null then raise exception 'Complete the company VAT number before issuing a VAT invoice'; end if;
  if nullif(trim(p_customer_name),'') is null then raise exception 'Customer name is required'; end if;
  if nullif(trim(p_customer_country),'') is null or length(trim(p_customer_country))<>2 then raise exception 'Customer country code is required'; end if;
  if coalesce(p_customer_address,'{}'::jsonb)='{}'::jsonb then raise exception 'Customer address is required'; end if;
  if p_issue_date is null or p_service_date is null or p_due_date is null then raise exception 'Invoice, service and due dates are required'; end if;
  if p_due_date<p_issue_date then raise exception 'Due date cannot be before the invoice date'; end if;
  if p_vat_treatment not in ('domestic','eu_b2b_reverse_charge') then raise exception 'Unsupported VAT treatment'; end if;
  if p_vat_treatment='eu_b2b_reverse_charge' then
    if upper(trim(p_customer_country))='LU' then raise exception 'EU reverse charge cannot be used for a Luxembourg customer'; end if;
    if nullif(trim(p_customer_vat_number),'') is null then raise exception 'Customer VAT number is required for EU B2B reverse charge'; end if;
  end if;
  if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'At least one invoice line is required'; end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_line_no:=v_line_no+1;
    v_desc:=trim(coalesce(v_line->>'description',''));
    v_qty:=coalesce((v_line->>'quantity')::numeric,0);
    v_unit:=coalesce((v_line->>'unit_price')::numeric,0);
    v_rate:=coalesce((v_line->>'vat_rate')::numeric,0);
    if v_desc='' then raise exception 'Every invoice line needs a description'; end if;
    if v_qty<=0 or v_unit<0 then raise exception 'Invoice quantities and prices are invalid'; end if;
    if p_vat_treatment='eu_b2b_reverse_charge' then v_rate:=0; end if;
    if not public.lu_vat_rate_allowed(v_rate, p_service_date) then raise exception 'Unsupported Luxembourg VAT rate % for a supply on %',v_rate,p_service_date; end if;
    if p_vat_treatment='domestic' and not v_company.vat_registered and v_rate<>0 then raise exception 'A non-VAT-registered company cannot charge VAT'; end if;
    v_net:=round(v_qty*v_unit,2); v_vat:=round(v_net*v_rate/100,2); v_gross:=v_net+v_vat;
    v_subtotal:=v_subtotal+v_net; v_vat_total:=v_vat_total+v_vat; v_total:=v_total+v_gross;
  end loop;

  select id into v_contact_id from public.contacts
   where company_id=v_company.id and (
     (nullif(trim(p_customer_vat_number),'') is not null and upper(coalesce(vat_number,''))=upper(trim(p_customer_vat_number)))
     or (nullif(trim(p_customer_email),'') is not null and lower(coalesce(email,''))=lower(trim(p_customer_email)))
   ) order by created_at asc limit 1;
  if v_contact_id is null then
    insert into public.contacts(organization_id,company_id,type,display_name,legal_name,country_code,vat_number,email,address)
    values(v_company.organization_id,v_company.id,'customer',trim(p_customer_name),trim(p_customer_name),upper(trim(p_customer_country)),nullif(trim(p_customer_vat_number),''),nullif(trim(p_customer_email),''),coalesce(p_customer_address,'{}'::jsonb)) returning id into v_contact_id;
  else
    update public.contacts set display_name=trim(p_customer_name),legal_name=trim(p_customer_name),country_code=upper(trim(p_customer_country)),vat_number=nullif(trim(p_customer_vat_number),''),email=nullif(trim(p_customer_email),''),address=coalesce(p_customer_address,'{}'::jsonb),updated_at=now() where id=v_contact_id;
  end if;

  v_issuer_snapshot:=jsonb_build_object('legal_name',v_company.legal_name,'legal_form',v_company.legal_form,'rcs_number',v_company.rcs_number,'vat_number',v_company.vat_number,'business_permit_number',v_company.business_permit_number,'registered_address',v_company.registered_address);
  v_customer_snapshot:=jsonb_build_object('name',trim(p_customer_name),'email',nullif(trim(p_customer_email),''),'country_code',upper(trim(p_customer_country)),'vat_number',nullif(trim(p_customer_vat_number),''),'address',coalesce(p_customer_address,'{}'::jsonb));

  insert into public.sales_invoices(organization_id,company_id,contact_id,status,payment_status,issue_date,service_date,due_date,currency,vat_treatment,subtotal,vat_total,total,issuer_snapshot,customer_snapshot,notes,created_by)
  values(v_company.organization_id,v_company.id,v_contact_id,'draft','unpaid',p_issue_date,p_service_date,p_due_date,v_company.base_currency,p_vat_treatment,v_subtotal,v_vat_total,v_total,v_issuer_snapshot,v_customer_snapshot,nullif(trim(p_notes),''),v_uid) returning id into v_invoice_id;

  v_line_no:=0;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_line_no:=v_line_no+1; v_desc:=trim(v_line->>'description'); v_qty:=(v_line->>'quantity')::numeric; v_unit:=(v_line->>'unit_price')::numeric; v_rate:=coalesce((v_line->>'vat_rate')::numeric,0); if p_vat_treatment='eu_b2b_reverse_charge' then v_rate:=0; end if;
    v_net:=round(v_qty*v_unit,2); v_vat:=round(v_net*v_rate/100,2); v_gross:=v_net+v_vat;
    insert into public.sales_invoice_lines(organization_id,company_id,invoice_id,line_number,description,quantity,unit_price,vat_rate,net_amount,vat_amount,gross_amount,revenue_account_code)
    values(v_company.organization_id,v_company.id,v_invoice_id,v_line_no,v_desc,v_qty,v_unit,v_rate,v_net,v_vat,v_gross,'7033');
  end loop;

  v_year:=extract(year from p_issue_date)::integer;
  insert into public.invoice_sequences(company_id,fiscal_year,last_number) values(v_company.id,v_year,1)
  on conflict(company_id,fiscal_year) do update set last_number=public.invoice_sequences.last_number+1
  returning last_number into v_seq;
  v_invoice_number:='INV-'||v_year::text||'-'||lpad(v_seq::text,4,'0');

  select * into v_receivable from public.company_accounts where company_id=v_company.id and code='4011' and is_active=true;
  select * into v_revenue from public.company_accounts where company_id=v_company.id and code='7033' and is_active=true;
  if v_receivable.id is null or v_revenue.id is null then raise exception 'Required customer or revenue ledger account is missing'; end if;
  if v_vat_total>0 then select * into v_vat_account from public.company_accounts where company_id=v_company.id and code='461411' and is_active=true; if v_vat_account.id is null then raise exception 'Output VAT ledger account is missing'; end if; end if;

  v_period_year:=extract(year from p_service_date)::integer;
  if extract(month from p_service_date)::integer<v_company.fiscal_year_start_month then v_period_year:=v_period_year-1; end if;
  v_period_start:=make_date(v_period_year,v_company.fiscal_year_start_month,1); v_period_end:=(v_period_start+interval '1 year - 1 day')::date;
  select id into v_period_id from public.accounting_periods where company_id=v_company.id and starts_on=v_period_start and ends_on=v_period_end and status in ('open','soft_closed') limit 1;
  if v_period_id is null then
    insert into public.accounting_periods(organization_id,company_id,starts_on,ends_on,status) values(v_company.organization_id,v_company.id,v_period_start,v_period_end,'open') on conflict(company_id,starts_on,ends_on) do nothing;
    select id into v_period_id from public.accounting_periods where company_id=v_company.id and starts_on=v_period_start and ends_on=v_period_end and status in ('open','soft_closed') limit 1;
  end if;
  if v_period_id is null then raise exception 'The accounting period is closed or locked'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_company.id::text,0));
  select coalesce(max(entry_number),0)+1 into v_entry_number from public.journal_entries where company_id=v_company.id;
  insert into public.journal_entries(organization_id,company_id,accounting_period_id,entry_number,entry_date,document_date,description,source_type,source_id,status,created_by)
  values(v_company.organization_id,v_company.id,v_period_id,v_entry_number,p_service_date,p_issue_date,'Invoice '||v_invoice_number||' — '||trim(p_customer_name),'invoice',v_invoice_id,'draft',v_uid) returning id into v_entry_id;
  insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,contact_id,description,debit,credit,currency,exchange_rate)
  values(v_company.organization_id,v_entry_id,v_receivable.id,v_contact_id,'Customer receivable '||v_invoice_number,v_total,0,v_company.base_currency,1);
  insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,contact_id,description,debit,credit,currency,exchange_rate)
  values(v_company.organization_id,v_entry_id,v_revenue.id,v_contact_id,'Service revenue '||v_invoice_number,0,v_subtotal,v_company.base_currency,1);
  if v_vat_total>0 then
    insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,contact_id,description,debit,credit,currency,exchange_rate,vat_code,vat_amount)
    values(v_company.organization_id,v_entry_id,v_vat_account.id,v_contact_id,'Output VAT '||v_invoice_number,0,v_vat_total,v_company.base_currency,1,'OUTPUT',v_vat_total);
  end if;
  perform public.post_journal_entry(v_entry_id);

  update public.sales_invoices set invoice_number=v_invoice_number,status='issued',journal_entry_id=v_entry_id,issued_at=now(),updated_at=now() where id=v_invoice_id;
  return v_invoice_id;
end;
$function$
;

