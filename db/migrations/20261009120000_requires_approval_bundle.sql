-- Applied on 2026-10-09 in the Supabase SQL editor (the connector cannot confirm DROP/DELETE
-- statements from a cloud session). Recorded in the migration history as 20261009120000.
--
--
-- 1. Bookkeeping retention guard (regulatory register H1). Code de commerce art. 16: accounting
--    records are kept for ten years from the end of the financial year. The reset functions already
--    refused closed periods and filed declarations; they now also refuse to remove issued invoices
--    (sequential numbering) and posted entries of a financial year that has ended.
-- 2. Invoice draft rate validation by supply date, and immutability of the VAT mention on issued
--    invoices (register A1, A7).
-- 3. Remove the hard-coded 0/3/8/14/17 % checks so dated rates (incl. 2023: 16/13/7 %) are accepted.
-- 4. Remove the temporary function used on 2026-10-09 to export the schema baseline (already
--    disabled: no EXECUTE privilege, body only raises an error).

-- 1 ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_company_bookkeeping(p_company_id uuid, p_confirmation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'app_private'
AS $function$
declare v_uid uuid:=auth.uid();v_company public.companies%rowtype;v_role text;v_counts jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_company from public.companies where id=p_company_id;if not found then raise exception 'Company not found';end if;
  select role into v_role from public.organization_members where organization_id=v_company.organization_id and user_id=v_uid;if v_role<>'owner' then raise exception 'Only the company owner can reset bookkeeping data';end if;
  if trim(p_confirmation)<>v_company.legal_name then raise exception 'Type the exact company legal name to confirm the reset';end if;
  if exists(select 1 from public.accounting_periods where company_id=p_company_id and status in ('closed','locked','hard_closed')) then raise exception 'A closed or locked accounting period exists. Bookkeeping reset is disabled.';end if;
  if exists(select 1 from public.filings where company_id=p_company_id and (status in ('filed','accepted') or export_status='submitted')) then raise exception 'A filed, accepted or submitted declaration exists. Bookkeeping reset is disabled.';end if;
  -- Code de commerce art. 16: books and supporting documents are kept for ten years. Issued invoices
  -- (sequential numbering) and entries of a financial year that has ended cannot be wiped.
  if exists(select 1 from public.sales_invoices where company_id=p_company_id and status<>'draft') then raise exception 'Issued invoices exist. They must be kept and cannot be deleted by a reset; use credit notes or corrections instead.';end if;
  if exists(select 1 from public.journal_entries je where je.company_id=p_company_id and je.status='posted' and je.entry_date<make_date(extract(year from current_date)::integer-case when extract(month from current_date)::integer<v_company.fiscal_year_start_month then 1 else 0 end,v_company.fiscal_year_start_month,1)) then raise exception 'Posted entries of a financial year that has ended must be kept for ten years. Reset is disabled; use reversing entries instead.';end if;
  select jsonb_build_object('transactions',(select count(*) from public.source_transactions where company_id=p_company_id),'journals',(select count(*) from public.journal_entries where company_id=p_company_id),'invoices',(select count(*) from public.sales_invoices where company_id=p_company_id),'bank_rows',(select count(*) from public.bank_transactions where company_id=p_company_id),'filings',(select count(*) from public.filings where company_id=p_company_id)) into v_counts;
  perform set_config('compta.bookkeeping_reset','on',true);
  delete from public.filings where company_id=p_company_id and status not in ('filed','accepted') and export_status<>'submitted';
  delete from public.invoice_payments where company_id=p_company_id;
  delete from public.sales_invoices where company_id=p_company_id;
  delete from public.source_transactions where company_id=p_company_id;
  update public.bank_transactions set matched_journal_entry_id=null where company_id=p_company_id;
  update public.journal_entries set reversal_of=null where company_id=p_company_id;
  delete from public.journal_entries where company_id=p_company_id;
  delete from public.bank_transactions where company_id=p_company_id;
  delete from public.bank_import_batches where company_id=p_company_id;
  update public.accounting_periods set status='open',locked_at=null where company_id=p_company_id and status in ('open','soft_closed');
  insert into public.audit_events(organization_id,company_id,actor_user_id,event_type,entity_type,entity_id,metadata) values(v_company.organization_id,p_company_id,v_uid,'bookkeeping.reset','company',p_company_id,v_counts);
  return v_counts;
end $function$
;

CREATE OR REPLACE FUNCTION public.reset_financial_year(p_company_id uuid, p_fiscal_year integer, p_confirmation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'app_private'
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_company public.companies%rowtype;
  v_role text;
  v_start date;
  v_end date;
  v_counts jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_fiscal_year<2000 or p_fiscal_year>2100 then raise exception 'Invalid financial year'; end if;
  select * into v_company from public.companies where id=p_company_id;
  if not found then raise exception 'Company not found'; end if;
  select role into v_role from public.organization_members where organization_id=v_company.organization_id and user_id=v_uid;
  if v_role<>'owner' then raise exception 'Only the company owner can reset a financial year'; end if;
  if trim(p_confirmation)<>('RESET '||p_fiscal_year::text) then raise exception 'Type RESET % exactly to confirm',p_fiscal_year; end if;
  v_start:=make_date(p_fiscal_year,v_company.fiscal_year_start_month,1);v_end:=(v_start+interval '1 year - 1 day')::date;

  if exists(select 1 from public.accounting_periods where company_id=p_company_id and starts_on=v_start and ends_on=v_end and status in ('closed','locked','hard_closed')) then raise exception 'This financial year is closed or locked and cannot be reset'; end if;
  if exists(select 1 from public.filings where company_id=p_company_id and (period_label=p_fiscal_year::text or (period_start<=v_end and period_end>=v_start)) and (status in ('filed','accepted') or export_status='submitted')) then raise exception 'A filed, accepted or submitted declaration exists for this year. Reset is disabled.'; end if;
  -- Code de commerce art. 16: books and supporting documents are kept for ten years.
  if exists(select 1 from public.sales_invoices where company_id=p_company_id and status<>'draft' and service_date between v_start and v_end) then raise exception 'Issued invoices exist for this year. They must be kept and cannot be deleted by a reset; use credit notes or corrections instead.'; end if;
  if v_end<current_date and exists(select 1 from public.journal_entries where company_id=p_company_id and status='posted' and entry_date between v_start and v_end) then raise exception 'This financial year has ended. Its posted entries must be kept for ten years; use reversing entries instead.'; end if;

  select jsonb_build_object(
    'transactions',(select count(*) from public.source_transactions where company_id=p_company_id and occurred_on between v_start and v_end),
    'journals',(select count(*) from public.journal_entries where company_id=p_company_id and entry_date between v_start and v_end),
    'invoices',(select count(*) from public.sales_invoices where company_id=p_company_id and service_date between v_start and v_end),
    'bank_rows',(select count(*) from public.bank_transactions where company_id=p_company_id and booking_date between v_start and v_end),
    'filings',(select count(*) from public.filings where company_id=p_company_id and (period_label=p_fiscal_year::text or (period_start<=v_end and period_end>=v_start)) and status not in ('filed','accepted') and export_status<>'submitted')
  ) into v_counts;

  perform set_config('compta.bookkeeping_reset','on',true);
  delete from public.filings where company_id=p_company_id and (period_label=p_fiscal_year::text or (period_start<=v_end and period_end>=v_start)) and status not in ('filed','accepted') and export_status<>'submitted';
  delete from public.invoice_payments where company_id=p_company_id and (
    paid_on between v_start and v_end
    or journal_entry_id in (select id from public.journal_entries where company_id=p_company_id and entry_date between v_start and v_end)
    or invoice_id in (select id from public.sales_invoices where company_id=p_company_id and service_date between v_start and v_end)
  );
  delete from public.sales_invoices where company_id=p_company_id and service_date between v_start and v_end;
  delete from public.source_transactions where company_id=p_company_id and occurred_on between v_start and v_end;
  update public.bank_transactions set matched_journal_entry_id=null where company_id=p_company_id and booking_date between v_start and v_end;
  update public.journal_entries set reversal_of=null where company_id=p_company_id and reversal_of in (select id from public.journal_entries where company_id=p_company_id and entry_date between v_start and v_end);
  delete from public.journal_entries where company_id=p_company_id and entry_date between v_start and v_end;
  delete from public.bank_transactions where company_id=p_company_id and booking_date between v_start and v_end;
  delete from public.bank_import_batches b where b.company_id=p_company_id and not exists(select 1 from public.bank_transactions t where t.import_batch_id=b.id);
  update public.accounting_periods set status='open',locked_at=null where company_id=p_company_id and starts_on=v_start and ends_on=v_end and status in ('open','soft_closed');

  insert into public.audit_events(organization_id,company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_company.organization_id,p_company_id,v_uid,'bookkeeping.fiscal_year_reset','company',p_company_id,v_counts||jsonb_build_object('fiscal_year',p_fiscal_year));
  return v_counts;
end $function$
;

-- 2 ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_service_invoice_draft(p_company_id uuid, p_invoice_id uuid DEFAULT NULL::uuid, p_customer_name text DEFAULT ''::text, p_customer_email text DEFAULT NULL::text, p_customer_country text DEFAULT 'LU'::text, p_customer_vat_number text DEFAULT NULL::text, p_customer_address jsonb DEFAULT '{}'::jsonb, p_issue_date date DEFAULT CURRENT_DATE, p_service_date date DEFAULT CURRENT_DATE, p_due_date date DEFAULT CURRENT_DATE, p_currency text DEFAULT 'EUR'::text, p_exchange_rate_to_base numeric DEFAULT 1, p_vat_treatment text DEFAULT 'domestic'::text, p_lines jsonb DEFAULT '[]'::jsonb, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_company public.companies%rowtype;
  v_invoice public.sales_invoices%rowtype;
  v_invoice_id uuid;
  v_contact_id uuid;
  v_line jsonb;
  v_line_no integer := 0;
  v_desc text;
  v_qty numeric(18,4);
  v_unit numeric(18,4);
  v_rate numeric(5,2);
  v_net numeric(18,2);
  v_vat numeric(18,2);
  v_gross numeric(18,2);
  v_subtotal numeric(18,2) := 0;
  v_vat_total numeric(18,2) := 0;
  v_total numeric(18,2) := 0;
  v_customer_snapshot jsonb;
  v_issuer_snapshot jsonb;
  v_currency text;
  v_fx numeric(18,8);
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_company from public.companies where id = p_company_id;
  if not found then raise exception 'Company not found'; end if;
  if not app_private.can_bookkeep_org(v_company.organization_id) then raise exception 'You do not have permission to edit invoices for this company'; end if;

  v_currency:=upper(trim(coalesce(p_currency,v_company.base_currency::text)));
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'Invoice currency must use a three-letter ISO code'; end if;
  v_fx:=case when v_currency=upper(trim(v_company.base_currency::text)) then 1 else p_exchange_rate_to_base end;
  if v_fx is null or v_fx<=0 then raise exception 'An exchange rate to the company base currency is required'; end if;

  if nullif(trim(p_customer_name),'') is null then raise exception 'Customer name is required'; end if;
  if nullif(trim(p_customer_country),'') is null or length(trim(p_customer_country)) <> 2 then raise exception 'Customer country code is required'; end if;
  if coalesce(p_customer_address,'{}'::jsonb) = '{}'::jsonb then raise exception 'Customer address is required'; end if;
  if p_issue_date is null or p_service_date is null or p_due_date is null then raise exception 'Invoice, service and due dates are required'; end if;
  if p_due_date < p_issue_date then raise exception 'Due date cannot be before the invoice date'; end if;
  if p_vat_treatment not in ('domestic','eu_b2b_reverse_charge') then raise exception 'Unsupported VAT treatment'; end if;
  if p_vat_treatment = 'eu_b2b_reverse_charge' then
    if upper(trim(p_customer_country)) = 'LU' then raise exception 'EU reverse charge cannot be used for a Luxembourg customer'; end if;
    if nullif(trim(p_customer_vat_number),'') is null then raise exception 'Customer VAT number is required for EU B2B reverse charge'; end if;
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'At least one invoice line is required'; end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_line_no := v_line_no + 1;
    v_desc := trim(coalesce(v_line->>'description',''));
    v_qty := coalesce((v_line->>'quantity')::numeric,0);
    v_unit := coalesce((v_line->>'unit_price')::numeric,0);
    v_rate := coalesce((v_line->>'vat_rate')::numeric,0);
    if v_desc = '' then raise exception 'Every invoice line needs a description'; end if;
    if v_qty <= 0 or v_unit < 0 then raise exception 'Invoice quantities and prices are invalid'; end if;
    if p_vat_treatment = 'eu_b2b_reverse_charge' then v_rate := 0; end if;
    if not public.lu_vat_rate_allowed(v_rate, coalesce(p_service_date, p_issue_date, current_date)) then raise exception 'Unsupported Luxembourg VAT rate % for a supply on %', v_rate, coalesce(p_service_date, p_issue_date, current_date); end if;
    if p_vat_treatment = 'domestic' and not v_company.vat_registered and v_rate <> 0 then raise exception 'A non-VAT-registered company cannot charge VAT'; end if;
    v_net := round(v_qty * v_unit,2);
    v_vat := round(v_net * v_rate / 100,2);
    v_gross := v_net + v_vat;
    v_subtotal := v_subtotal + v_net;
    v_vat_total := v_vat_total + v_vat;
    v_total := v_total + v_gross;
  end loop;

  select id into v_contact_id
  from public.contacts
  where company_id = v_company.id
    and ((nullif(trim(p_customer_vat_number),'') is not null and upper(coalesce(vat_number,'')) = upper(trim(p_customer_vat_number)))
      or (nullif(trim(p_customer_email),'') is not null and lower(coalesce(email,'')) = lower(trim(p_customer_email))))
  order by created_at asc limit 1;

  if v_contact_id is null then
    insert into public.contacts(organization_id,company_id,type,display_name,legal_name,country_code,vat_number,email,address)
    values(v_company.organization_id,v_company.id,'customer',trim(p_customer_name),trim(p_customer_name),upper(trim(p_customer_country)),nullif(trim(p_customer_vat_number),''),nullif(trim(p_customer_email),''),coalesce(p_customer_address,'{}'::jsonb))
    returning id into v_contact_id;
  else
    update public.contacts set
      display_name=trim(p_customer_name), legal_name=trim(p_customer_name), country_code=upper(trim(p_customer_country)),
      vat_number=nullif(trim(p_customer_vat_number),''), email=nullif(trim(p_customer_email),''), address=coalesce(p_customer_address,'{}'::jsonb), updated_at=now()
    where id=v_contact_id;
  end if;

  v_issuer_snapshot := jsonb_build_object('legal_name',v_company.legal_name,'legal_form',v_company.legal_form,'rcs_number',v_company.rcs_number,'vat_number',v_company.vat_number,'business_permit_number',v_company.business_permit_number,'registered_address',v_company.registered_address);
  v_customer_snapshot := jsonb_build_object('name',trim(p_customer_name),'email',nullif(trim(p_customer_email),''),'country_code',upper(trim(p_customer_country)),'vat_number',nullif(trim(p_customer_vat_number),''),'address',coalesce(p_customer_address,'{}'::jsonb));

  if p_invoice_id is null then
    insert into public.sales_invoices(organization_id,company_id,contact_id,status,payment_status,issue_date,service_date,due_date,currency,exchange_rate_to_base,vat_treatment,subtotal,vat_total,total,issuer_snapshot,customer_snapshot,notes,created_by)
    values(v_company.organization_id,v_company.id,v_contact_id,'draft','unpaid',p_issue_date,p_service_date,p_due_date,v_currency,v_fx,p_vat_treatment,v_subtotal,v_vat_total,v_total,v_issuer_snapshot,v_customer_snapshot,nullif(trim(p_notes),''),v_uid)
    returning id into v_invoice_id;
  else
    select * into v_invoice from public.sales_invoices where id=p_invoice_id for update;
    if not found or v_invoice.company_id <> v_company.id then raise exception 'Draft invoice not found'; end if;
    if v_invoice.status <> 'draft' then raise exception 'Only a draft invoice can be edited directly'; end if;
    v_invoice_id := v_invoice.id;
    update public.sales_invoices set
      contact_id=v_contact_id, issue_date=p_issue_date, service_date=p_service_date, due_date=p_due_date,
      currency=v_currency, exchange_rate_to_base=v_fx, vat_treatment=p_vat_treatment, subtotal=v_subtotal, vat_total=v_vat_total, total=v_total,
      issuer_snapshot=v_issuer_snapshot, customer_snapshot=v_customer_snapshot, notes=nullif(trim(p_notes),''), updated_at=now()
    where id=v_invoice_id;
    delete from public.sales_invoice_lines where invoice_id=v_invoice_id;
  end if;

  v_line_no := 0;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_line_no := v_line_no + 1;
    v_desc := trim(v_line->>'description');
    v_qty := (v_line->>'quantity')::numeric;
    v_unit := (v_line->>'unit_price')::numeric;
    v_rate := coalesce((v_line->>'vat_rate')::numeric,0);
    if p_vat_treatment='eu_b2b_reverse_charge' then v_rate:=0; end if;
    v_net:=round(v_qty*v_unit,2); v_vat:=round(v_net*v_rate/100,2); v_gross:=v_net+v_vat;
    insert into public.sales_invoice_lines(organization_id,company_id,invoice_id,line_number,description,quantity,unit_price,vat_rate,net_amount,vat_amount,gross_amount,revenue_account_code)
    values(v_company.organization_id,v_company.id,v_invoice_id,v_line_no,v_desc,v_qty,v_unit,v_rate,v_net,v_vat,v_gross,'7033');
  end loop;

  insert into public.audit_events(organization_id,company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_company.organization_id,v_company.id,v_uid,case when p_invoice_id is null then 'invoice.draft_created' else 'invoice.draft_updated' end,'sales_invoice',v_invoice_id,jsonb_build_object('total',v_total,'currency',v_currency,'exchange_rate_to_base',v_fx));
  return v_invoice_id;
end
$function$
;

CREATE OR REPLACE FUNCTION public.protect_issued_sales_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_has_reversal boolean:=false;
begin
  if current_user in ('postgres','service_role','supabase_admin') and current_setting('compta.bookkeeping_reset',true)='on' then return case when tg_op='DELETE' then old else new end; end if;
  if tg_op='DELETE' and old.status<>'draft' then raise exception 'Issued invoices cannot be deleted directly; use the controlled void or credit-note workflow'; end if;
  if tg_op='UPDATE' and old.status<>'draft' then
    if new.status=old.status and new.id=old.id and new.organization_id=old.organization_id and new.company_id=old.company_id and new.contact_id is not distinct from old.contact_id and new.invoice_number is not distinct from old.invoice_number and new.issue_date=old.issue_date and new.service_date=old.service_date and new.due_date=old.due_date and new.currency=old.currency and new.vat_treatment=old.vat_treatment and new.subtotal=old.subtotal and new.vat_total=old.vat_total and new.total=old.total and new.issuer_snapshot=old.issuer_snapshot and new.customer_snapshot=old.customer_snapshot and new.payment_reference is not distinct from old.payment_reference and new.notes is not distinct from old.notes and new.vat_exemption_mention is not distinct from old.vat_exemption_mention and new.journal_entry_id is not distinct from old.journal_entry_id and new.created_by is not distinct from old.created_by and new.issued_at is not distinct from old.issued_at and new.created_at=old.created_at and (new.payment_status is distinct from old.payment_status or new.paid_at is distinct from old.paid_at or new.updated_at is distinct from old.updated_at) then return new; end if;
    if old.status='issued' and new.status='void' then
      select exists(select 1 from public.journal_entries r where r.reversal_of=old.journal_entry_id and r.status='posted') into v_has_reversal;
      if v_has_reversal and new.id=old.id and new.organization_id=old.organization_id and new.company_id=old.company_id and new.contact_id is not distinct from old.contact_id and new.invoice_number is not distinct from old.invoice_number and new.issue_date=old.issue_date and new.service_date=old.service_date and new.due_date=old.due_date and new.currency=old.currency and new.vat_treatment=old.vat_treatment and new.subtotal=old.subtotal and new.vat_total=old.vat_total and new.total=old.total and new.issuer_snapshot=old.issuer_snapshot and new.customer_snapshot=old.customer_snapshot and new.payment_reference is not distinct from old.payment_reference and new.notes is not distinct from old.notes and new.vat_exemption_mention is not distinct from old.vat_exemption_mention and new.journal_entry_id is not distinct from old.journal_entry_id and new.created_by is not distinct from old.created_by and new.issued_at is not distinct from old.issued_at and new.created_at=old.created_at then return new; end if;
    end if;
    raise exception 'Issued invoices are immutable except through controlled payment, correction, void or credit-note workflows';
  end if;
  return case when tg_op='DELETE' then old else new end;
end $function$
;

-- 3 ---------------------------------------------------------------------------
alter table public.source_transactions drop constraint if exists source_transactions_vat_rate_check;
alter table public.sales_invoice_lines drop constraint if exists sales_invoice_lines_vat_rate_check;

-- 4 ---------------------------------------------------------------------------
drop function if exists public.zz_tmp_schema_export(text, text);
