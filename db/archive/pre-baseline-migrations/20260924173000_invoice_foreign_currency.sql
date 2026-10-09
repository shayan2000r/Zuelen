-- Full foreign-currency support for sales invoices and settlements.
-- Customer documents stay in the invoice currency; ledger postings stay in the company base currency.

alter table public.sales_invoices
  add column if not exists exchange_rate_to_base numeric(18,8) not null default 1;

alter table public.sales_invoices
  drop constraint if exists sales_invoices_exchange_rate_to_base_check;
alter table public.sales_invoices
  add constraint sales_invoices_exchange_rate_to_base_check
  check (exchange_rate_to_base > 0);

alter table public.invoice_payments
  add column if not exists exchange_rate_to_base numeric(18,8) not null default 1,
  add column if not exists base_amount numeric(18,2);

update public.invoice_payments set base_amount=amount where base_amount is null;
alter table public.invoice_payments alter column base_amount set not null;

alter table public.invoice_payments
  drop constraint if exists invoice_payments_exchange_rate_to_base_check;
alter table public.invoice_payments
  add constraint invoice_payments_exchange_rate_to_base_check
  check (exchange_rate_to_base > 0);

drop function if exists public.save_service_invoice_draft(uuid,uuid,text,text,text,text,jsonb,date,date,date,text,jsonb,text);
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
    if v_rate not in (0,3,8,14,17) then raise exception 'Unsupported Luxembourg VAT rate %', v_rate; end if;
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

revoke all on function public.save_service_invoice_draft(uuid,uuid,text,text,text,text,jsonb,date,date,date,text,numeric,text,jsonb,text) from public, anon;
grant execute on function public.save_service_invoice_draft(uuid,uuid,text,text,text,text,jsonb,date,date,date,text,numeric,text,jsonb,text) to authenticated;

CREATE OR REPLACE FUNCTION public.issue_service_invoice_draft(p_invoice_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_invoice public.sales_invoices%rowtype;
  v_company public.companies%rowtype;
  v_receivable public.company_accounts%rowtype;
  v_revenue public.company_accounts%rowtype;
  v_vat_account public.company_accounts%rowtype;
  v_period_id uuid;
  v_period_start date;
  v_period_end date;
  v_period_year integer;
  v_entry_id uuid;
  v_entry_number bigint;
  v_year integer;
  v_seq bigint;
  v_invoice_number text;
  v_fx numeric(18,8);
  v_base_currency text;
  v_base_total numeric(18,2);
  v_base_subtotal numeric(18,2);
  v_base_vat numeric(18,2);
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_invoice from public.sales_invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.status <> 'draft' then raise exception 'Only a draft invoice can be issued'; end if;
  if not app_private.can_bookkeep_org(v_invoice.organization_id) then raise exception 'You do not have permission to issue this invoice'; end if;
  select * into v_company from public.companies where id=v_invoice.company_id;
  if not found then raise exception 'Company not found'; end if;

  if coalesce(v_company.registered_address,'{}'::jsonb)='{}'::jsonb then raise exception 'Complete the registered office address before issuing an invoice'; end if;
  if v_company.vat_registered and nullif(trim(v_company.vat_number),'') is null then raise exception 'Complete the company VAT number before issuing a VAT invoice'; end if;
  if not exists(select 1 from public.sales_invoice_lines where invoice_id=v_invoice.id) then raise exception 'Add at least one invoice line'; end if;

  v_base_currency:=upper(trim(v_company.base_currency::text));
  v_fx:=case when upper(trim(v_invoice.currency))=v_base_currency then 1 else v_invoice.exchange_rate_to_base end;
  if v_fx is null or v_fx<=0 then raise exception 'An exchange rate to the company base currency is required before issuing this invoice'; end if;
  v_base_total:=round(v_invoice.total*v_fx,2);
  v_base_subtotal:=round(v_invoice.subtotal*v_fx,2);
  v_base_vat:=round(v_invoice.vat_total*v_fx,2);

  v_year := extract(year from v_invoice.issue_date)::integer;
  insert into public.invoice_sequences(company_id,fiscal_year,last_number) values(v_company.id,v_year,1)
  on conflict(company_id,fiscal_year) do update set last_number=public.invoice_sequences.last_number+1
  returning last_number into v_seq;
  v_invoice_number := 'INV-'||v_year::text||'-'||lpad(v_seq::text,4,'0');

  select * into v_receivable from public.company_accounts where company_id=v_company.id and code='4011' and is_active=true;
  select * into v_revenue from public.company_accounts where company_id=v_company.id and code='7033' and is_active=true;
  if v_receivable.id is null or v_revenue.id is null then raise exception 'Required customer or revenue ledger account is missing'; end if;
  if v_invoice.vat_total > 0 then
    select * into v_vat_account from public.company_accounts where company_id=v_company.id and code='461411' and is_active=true;
    if v_vat_account.id is null then raise exception 'Output VAT ledger account is missing'; end if;
  end if;

  v_period_year := extract(year from v_invoice.service_date)::integer;
  if extract(month from v_invoice.service_date)::integer < v_company.fiscal_year_start_month then v_period_year := v_period_year - 1; end if;
  v_period_start := make_date(v_period_year,v_company.fiscal_year_start_month,1);
  v_period_end := (v_period_start + interval '1 year - 1 day')::date;
  select id into v_period_id from public.accounting_periods where company_id=v_company.id and starts_on=v_period_start and ends_on=v_period_end and status in ('open','soft_closed') limit 1;
  if v_period_id is null then
    insert into public.accounting_periods(organization_id,company_id,starts_on,ends_on,status)
    values(v_company.organization_id,v_company.id,v_period_start,v_period_end,'open') on conflict(company_id,starts_on,ends_on) do nothing;
    select id into v_period_id from public.accounting_periods where company_id=v_company.id and starts_on=v_period_start and ends_on=v_period_end and status in ('open','soft_closed') limit 1;
  end if;
  if v_period_id is null then raise exception 'The accounting period is closed or locked'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_company.id::text,0));
  select coalesce(max(entry_number),0)+1 into v_entry_number from public.journal_entries where company_id=v_company.id;
  insert into public.journal_entries(organization_id,company_id,accounting_period_id,entry_number,entry_date,document_date,description,source_type,source_id,status,created_by)
  values(v_company.organization_id,v_company.id,v_period_id,v_entry_number,v_invoice.service_date,v_invoice.issue_date,'Invoice '||v_invoice_number||' — '||coalesce(v_invoice.customer_snapshot->>'name','Customer'),'invoice',v_invoice.id,'draft',v_uid)
  returning id into v_entry_id;

  insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,contact_id,description,debit,credit,currency,exchange_rate,original_currency,original_debit,original_credit)
  values(v_company.organization_id,v_entry_id,v_receivable.id,v_invoice.contact_id,'Customer receivable '||v_invoice_number,v_base_total,0,v_base_currency,v_fx,case when upper(trim(v_invoice.currency))<>v_base_currency then upper(trim(v_invoice.currency)) else null end,case when upper(trim(v_invoice.currency))<>v_base_currency then v_invoice.total else null end,0);
  insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,contact_id,description,debit,credit,currency,exchange_rate,original_currency,original_debit,original_credit)
  values(v_company.organization_id,v_entry_id,v_revenue.id,v_invoice.contact_id,'Service revenue '||v_invoice_number,0,v_base_subtotal,v_base_currency,v_fx,case when upper(trim(v_invoice.currency))<>v_base_currency then upper(trim(v_invoice.currency)) else null end,0,case when upper(trim(v_invoice.currency))<>v_base_currency then v_invoice.subtotal else null end);
  if v_invoice.vat_total > 0 then
    insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,contact_id,description,debit,credit,currency,exchange_rate,vat_code,vat_amount,original_currency,original_debit,original_credit)
    values(v_company.organization_id,v_entry_id,v_vat_account.id,v_invoice.contact_id,'Output VAT '||v_invoice_number,0,v_base_vat,v_base_currency,v_fx,'OUTPUT',v_base_vat,case when upper(trim(v_invoice.currency))<>v_base_currency then upper(trim(v_invoice.currency)) else null end,0,case when upper(trim(v_invoice.currency))<>v_base_currency then v_invoice.vat_total else null end);
  end if;
  perform public.post_journal_entry(v_entry_id);

  update public.sales_invoices set invoice_number=v_invoice_number,status='issued',journal_entry_id=v_entry_id,issued_at=now(),updated_at=now() where id=v_invoice.id;
  insert into public.audit_events(organization_id,company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_invoice.organization_id,v_invoice.company_id,v_uid,'invoice.issued','sales_invoice',v_invoice.id,jsonb_build_object('invoice_number',v_invoice_number,'journal_entry_id',v_entry_id,'currency',v_invoice.currency,'exchange_rate_to_base',v_fx));
  return v_invoice.id;
end
$function$


revoke all on function public.issue_service_invoice_draft(uuid) from public, anon;
grant execute on function public.issue_service_invoice_draft(uuid) to authenticated;

drop function if exists public.record_invoice_payment(uuid,numeric,date,uuid,text);
CREATE OR REPLACE FUNCTION public.record_invoice_payment(p_invoice_id uuid, p_amount numeric, p_paid_on date, p_bank_transaction_id uuid DEFAULT NULL::uuid, p_reference text DEFAULT NULL::text, p_exchange_rate_to_base numeric DEFAULT NULL::numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_invoice public.sales_invoices%rowtype;
  v_company public.companies%rowtype;
  v_bank public.company_accounts%rowtype;
  v_receivable public.company_accounts%rowtype;
  v_fx_gain public.company_accounts%rowtype;
  v_fx_loss public.company_accounts%rowtype;
  v_bank_tx public.bank_transactions%rowtype;
  v_period_id uuid;
  v_period_start date;
  v_period_end date;
  v_period_year integer;
  v_entry_id uuid;
  v_entry_number bigint;
  v_payment_id uuid;
  v_paid_before numeric(18,2);
  v_paid_after numeric(18,2);
  v_description text;
  v_base_currency text;
  v_payment_fx numeric(18,8);
  v_issue_fx numeric(18,8);
  v_payment_base numeric(18,2);
  v_receivable_base numeric(18,2);
  v_fx_difference numeric(18,2);
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if p_paid_on is null then raise exception 'Payment date is required'; end if;

  select * into v_invoice from public.sales_invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if not app_private.can_bookkeep_org(v_invoice.organization_id) then raise exception 'You do not have permission to record payments for this company'; end if;
  if v_invoice.status <> 'issued' then raise exception 'Only issued invoices can receive payments'; end if;

  select coalesce(sum(amount),0) into v_paid_before from public.invoice_payments where invoice_id = v_invoice.id;
  if v_paid_before >= v_invoice.total then raise exception 'This invoice is already fully paid'; end if;
  if round(v_paid_before + p_amount,2) > round(v_invoice.total,2) then raise exception 'Payment exceeds the outstanding invoice balance'; end if;

  select * into v_company from public.companies where id = v_invoice.company_id;
  if not found then raise exception 'Company not found'; end if;

  v_base_currency:=upper(trim(v_company.base_currency::text));
  v_issue_fx:=case when upper(trim(v_invoice.currency))=v_base_currency then 1 else v_invoice.exchange_rate_to_base end;
  v_payment_fx:=case when upper(trim(v_invoice.currency))=v_base_currency then 1 else p_exchange_rate_to_base end;
  if v_issue_fx is null or v_issue_fx<=0 then raise exception 'The invoice issue exchange rate is missing'; end if;
  if v_payment_fx is null or v_payment_fx<=0 then raise exception 'A payment-date exchange rate is required for this foreign-currency invoice'; end if;

  v_payment_base:=round(p_amount*v_payment_fx,2);
  v_receivable_base:=round(p_amount*v_issue_fx,2);
  v_fx_difference:=round(v_payment_base-v_receivable_base,2);

  select * into v_bank from public.company_accounts where company_id=v_company.id and code='5131' and is_active=true;
  select * into v_receivable from public.company_accounts where company_id=v_company.id and code='4011' and is_active=true;
  select * into v_fx_loss from public.company_accounts where company_id=v_company.id and code='6562' and is_active=true;
  select * into v_fx_gain from public.company_accounts where company_id=v_company.id and code='7562' and is_active=true;
  if v_bank.id is null or v_receivable.id is null then raise exception 'Required bank or customer receivable ledger account is missing'; end if;
  if v_fx_difference<>0 and (v_fx_loss.id is null or v_fx_gain.id is null) then raise exception 'Foreign exchange gain/loss ledger accounts are missing'; end if;

  if p_bank_transaction_id is not null then
    select * into v_bank_tx from public.bank_transactions where id=p_bank_transaction_id for update;
    if not found then raise exception 'Bank transaction not found'; end if;
    if v_bank_tx.company_id <> v_invoice.company_id or v_bank_tx.organization_id <> v_invoice.organization_id then raise exception 'Bank transaction belongs to another company'; end if;
    if v_bank_tx.match_status = 'matched' or v_bank_tx.matched_journal_entry_id is not null then raise exception 'Bank transaction is already matched'; end if;
    if v_bank_tx.amount <= 0 then raise exception 'Invoice payments must be matched to an incoming bank transaction'; end if;
    if upper(trim(v_bank_tx.currency))=upper(trim(v_invoice.currency)) then
      if round(v_bank_tx.amount,2)<>round(p_amount,2) then raise exception 'Bank transaction amount does not match the invoice-currency payment amount'; end if;
    elsif upper(trim(v_bank_tx.currency))=v_base_currency then
      if round(v_bank_tx.amount,2)<>v_payment_base then raise exception 'Base-currency bank amount does not match the converted payment amount'; end if;
    else
      raise exception 'Bank transaction currency is incompatible with this invoice';
    end if;
  end if;

  v_period_year := extract(year from p_paid_on)::integer;
  if extract(month from p_paid_on)::integer < v_company.fiscal_year_start_month then v_period_year := v_period_year - 1; end if;
  v_period_start := make_date(v_period_year, v_company.fiscal_year_start_month, 1);
  v_period_end := (v_period_start + interval '1 year - 1 day')::date;

  select id into v_period_id from public.accounting_periods
   where company_id=v_company.id and starts_on=v_period_start and ends_on=v_period_end and status in ('open','soft_closed') limit 1;
  if v_period_id is null then
    insert into public.accounting_periods(organization_id,company_id,starts_on,ends_on,status)
    values(v_company.organization_id,v_company.id,v_period_start,v_period_end,'open')
    on conflict(company_id,starts_on,ends_on) do nothing;
    select id into v_period_id from public.accounting_periods
     where company_id=v_company.id and starts_on=v_period_start and ends_on=v_period_end and status in ('open','soft_closed') limit 1;
  end if;
  if v_period_id is null then raise exception 'The accounting period is closed or locked'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_company.id::text,0));
  select coalesce(max(entry_number),0)+1 into v_entry_number from public.journal_entries where company_id=v_company.id;
  v_description := 'Payment ' || coalesce(v_invoice.invoice_number,'invoice') || ' — ' || coalesce(v_invoice.customer_snapshot->>'name','Customer');

  insert into public.journal_entries(
    organization_id,company_id,accounting_period_id,entry_number,entry_date,document_date,description,source_type,source_id,status,created_by
  ) values (
    v_company.organization_id,v_company.id,v_period_id,v_entry_number,p_paid_on,p_paid_on,v_description,'bank',coalesce(p_bank_transaction_id,v_invoice.id),'draft',v_uid
  ) returning id into v_entry_id;

  insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,contact_id,description,debit,credit,currency,exchange_rate,original_currency,original_debit,original_credit)
  values(v_company.organization_id,v_entry_id,v_bank.id,v_invoice.contact_id,v_description,v_payment_base,0,v_base_currency,v_payment_fx,case when upper(trim(v_invoice.currency))<>v_base_currency then upper(trim(v_invoice.currency)) else null end,case when upper(trim(v_invoice.currency))<>v_base_currency then p_amount else null end,0);

  insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,contact_id,description,debit,credit,currency,exchange_rate,original_currency,original_debit,original_credit)
  values(v_company.organization_id,v_entry_id,v_receivable.id,v_invoice.contact_id,v_description,0,v_receivable_base,v_base_currency,v_issue_fx,case when upper(trim(v_invoice.currency))<>v_base_currency then upper(trim(v_invoice.currency)) else null end,0,case when upper(trim(v_invoice.currency))<>v_base_currency then p_amount else null end);

  if v_fx_difference>0 then
    insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,contact_id,description,debit,credit,currency,exchange_rate)
    values(v_company.organization_id,v_entry_id,v_fx_gain.id,v_invoice.contact_id,'Foreign exchange gain',0,v_fx_difference,v_base_currency,1);
  elsif v_fx_difference<0 then
    insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,contact_id,description,debit,credit,currency,exchange_rate)
    values(v_company.organization_id,v_entry_id,v_fx_loss.id,v_invoice.contact_id,'Foreign exchange loss',abs(v_fx_difference),0,v_base_currency,1);
  end if;

  perform public.post_journal_entry(v_entry_id);

  insert into public.invoice_payments(
    organization_id,company_id,invoice_id,bank_transaction_id,paid_on,amount,currency,exchange_rate_to_base,base_amount,reference,journal_entry_id,created_by
  ) values (
    v_company.organization_id,v_company.id,v_invoice.id,p_bank_transaction_id,p_paid_on,round(p_amount,2),v_invoice.currency,v_payment_fx,v_payment_base,nullif(trim(p_reference),''),v_entry_id,v_uid
  ) returning id into v_payment_id;

  v_paid_after := round(v_paid_before + p_amount,2);
  update public.sales_invoices
     set payment_status = case when v_paid_after >= total then 'paid' else 'partially_paid' end,
         paid_at = case when v_paid_after >= total then now() else null end,
         updated_at = now()
   where id = v_invoice.id;

  if p_bank_transaction_id is not null then
    update public.bank_transactions
       set match_status='matched', matched_journal_entry_id=v_entry_id
     where id=p_bank_transaction_id;
  end if;

  insert into public.audit_events(organization_id,company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_invoice.organization_id,v_invoice.company_id,v_uid,'invoice.payment_recorded','sales_invoice',v_invoice.id,
    jsonb_build_object('payment_id',v_payment_id,'amount',p_amount,'currency',v_invoice.currency,'payment_exchange_rate',v_payment_fx,'fx_difference',v_fx_difference));

  return v_payment_id;
end
$function$

revoke all on function public.record_invoice_payment(uuid,numeric,date,uuid,text,numeric) from public, anon;
grant execute on function public.record_invoice_payment(uuid,numeric,date,uuid,text,numeric) to authenticated;

CREATE OR REPLACE FUNCTION public.suggest_invoice_payment_candidates(p_invoice_id uuid)
 RETURNS TABLE(bank_transaction_id uuid, score numeric, reason text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'app_private'
AS $function$
declare v public.sales_invoices%rowtype; v_paid numeric; v_outstanding numeric; v_customer text; b record; s numeric; r text;
begin
 select * into v from public.sales_invoices where id=p_invoice_id;
 if not found or not app_private.is_org_member(v.organization_id) then raise exception 'Invoice not found'; end if;
 select coalesce(sum(amount),0) into v_paid from public.invoice_payments where invoice_id=v.id; v_outstanding:=greatest(v.total-v_paid,0);
 v_customer:=app_private.normalize_counterparty(coalesce(v.customer_snapshot->>'name',''));
 for b in select * from public.bank_transactions where company_id=v.company_id and amount>0 and match_status='unmatched' and upper(trim(currency))=upper(trim(v.currency)) order by booking_date desc limit 100 loop
  s:=0;r:='';
  if abs(b.amount-v_outstanding)<=0.02 then s:=s+.62;r:='Exact outstanding amount'; elsif abs(b.amount-v.total)<=0.02 then s:=s+.5;r:='Exact invoice total'; elsif b.amount<=v_outstanding and b.amount>0 then s:=s+.16;r:='Possible partial payment'; end if;
  if v.invoice_number is not null and lower(coalesce(b.reference,'')) like '%'||lower(v.invoice_number)||'%' then s:=s+.25;r:=r||case when r='' then '' else ' · ' end||'Invoice number in bank reference'; end if;
  if v.payment_reference is not null and lower(coalesce(b.reference,'')) like '%'||lower(v.payment_reference)||'%' then s:=s+.28;r:=r||case when r='' then '' else ' · ' end||'Payment reference matches'; end if;
  if v_customer<>'' and app_private.normalize_counterparty(coalesce(b.counterparty_name,''))<>'' and (app_private.normalize_counterparty(b.counterparty_name) like '%'||split_part(v_customer,' ',1)||'%' or v_customer like '%'||split_part(app_private.normalize_counterparty(b.counterparty_name),' ',1)||'%') then s:=s+.12;r:=r||case when r='' then '' else ' · ' end||'Customer name looks consistent'; end if;
  if b.booking_date>=v.issue_date and (v.due_date is null or b.booking_date<=v.due_date+60) then s:=s+.06; end if;
  if s>=.2 then bank_transaction_id:=b.id;score:=least(s,.99);reason:=coalesce(nullif(r,''),'Date/amount candidate');return next;end if;
 end loop;
end
$function$


drop function if exists public.correct_and_reissue_service_invoice(uuid,text,text,text,text,jsonb,date,date,date,text,jsonb,text);
CREATE OR REPLACE FUNCTION public.correct_and_reissue_service_invoice(p_invoice_id uuid, p_customer_name text, p_customer_email text, p_customer_country text, p_customer_vat_number text, p_customer_address jsonb, p_issue_date date, p_service_date date, p_due_date date, p_currency text, p_exchange_rate_to_base numeric, p_vat_treatment text, p_lines jsonb, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_old public.sales_invoices%rowtype;
  v_new_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_old from public.sales_invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if not app_private.can_bookkeep_org(v_old.organization_id) then raise exception 'You do not have permission to correct this invoice'; end if;
  if v_old.status <> 'issued' then raise exception 'Only an issued invoice can be corrected with this workflow'; end if;
  if exists(select 1 from public.invoice_payments where invoice_id=v_old.id) then raise exception 'A paid or partially paid invoice requires a credit-note workflow'; end if;

  perform public.void_sales_invoice_safe(v_old.id);
  v_new_id:=public.save_service_invoice_draft(
    v_old.company_id,
    null,
    p_customer_name,
    p_customer_email,
    p_customer_country,
    p_customer_vat_number,
    p_customer_address,
    p_issue_date,
    p_service_date,
    p_due_date,
    p_currency,
    p_exchange_rate_to_base,
    p_vat_treatment,
    p_lines,
    p_notes
  );
  perform public.issue_service_invoice_draft(v_new_id);

  insert into public.audit_events(organization_id,company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_old.organization_id,v_old.company_id,v_uid,'invoice.corrected','sales_invoice',v_old.id,
    jsonb_build_object('replacement_invoice_id',v_new_id,'old_invoice_number',v_old.invoice_number,'currency',p_currency,'exchange_rate_to_base',p_exchange_rate_to_base));
  return v_new_id;
end
$function$

revoke all on function public.correct_and_reissue_service_invoice(uuid,text,text,text,text,jsonb,date,date,date,text,numeric,text,jsonb,text) from public, anon;
grant execute on function public.correct_and_reissue_service_invoice(uuid,text,text,text,text,jsonb,date,date,date,text,numeric,text,jsonb,text) to authenticated;
