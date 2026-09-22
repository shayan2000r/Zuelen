-- Independent workspaces can issue invoices without RCS / business-permit numbers
-- when onboarding explicitly records that those registrations do not apply.
-- Company workspaces keep the previous requirements unchanged.

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
  v_independent_rcs_registered boolean := false;
  v_independent_permit_held boolean := false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_invoice from public.sales_invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.status <> 'draft' then raise exception 'Only a draft invoice can be issued'; end if;
  if not app_private.can_bookkeep_org(v_invoice.organization_id) then raise exception 'You do not have permission to issue this invoice'; end if;
  select * into v_company from public.companies where id=v_invoice.company_id;
  if not found then raise exception 'Company not found'; end if;

  if v_company.entity_kind = 'independent' then
    select
      coalesce(iap.rcs_registered, false),
      coalesce(iap.business_permit_held, false)
    into
      v_independent_rcs_registered,
      v_independent_permit_held
    from public.independent_activity_profiles iap
    where iap.company_id = v_company.id;

    v_independent_rcs_registered := coalesce(v_independent_rcs_registered, false);
    v_independent_permit_held := coalesce(v_independent_permit_held, false);
  end if;

  if (
    v_company.entity_kind <> 'independent'
    or v_independent_rcs_registered
  ) and nullif(trim(v_company.rcs_number),'') is null then
    raise exception 'Complete the RCS number before issuing an invoice';
  end if;

  if (
    v_company.entity_kind <> 'independent'
    or v_independent_permit_held
  ) and nullif(trim(v_company.business_permit_number),'') is null then
    raise exception 'Complete the business permit number before issuing an invoice';
  end if;

  if coalesce(v_company.registered_address,'{}'::jsonb)='{}'::jsonb then raise exception 'Complete the registered office address before issuing an invoice'; end if;
  if v_company.vat_registered and nullif(trim(v_company.vat_number),'') is null then raise exception 'Complete the company VAT number before issuing a VAT invoice'; end if;
  if not exists(select 1 from public.sales_invoice_lines where invoice_id=v_invoice.id) then raise exception 'Add at least one invoice line'; end if;

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

  insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,contact_id,description,debit,credit,currency,exchange_rate)
  values(v_company.organization_id,v_entry_id,v_receivable.id,v_invoice.contact_id,'Customer receivable '||v_invoice_number,v_invoice.total,0,v_invoice.currency,1);
  insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,contact_id,description,debit,credit,currency,exchange_rate)
  values(v_company.organization_id,v_entry_id,v_revenue.id,v_invoice.contact_id,'Service revenue '||v_invoice_number,0,v_invoice.subtotal,v_invoice.currency,1);
  if v_invoice.vat_total > 0 then
    insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,contact_id,description,debit,credit,currency,exchange_rate,vat_code,vat_amount)
    values(v_company.organization_id,v_entry_id,v_vat_account.id,v_invoice.contact_id,'Output VAT '||v_invoice_number,0,v_invoice.vat_total,v_invoice.currency,1,'OUTPUT',v_invoice.vat_total);
  end if;
  perform public.post_journal_entry(v_entry_id);

  update public.sales_invoices set invoice_number=v_invoice_number,status='issued',journal_entry_id=v_entry_id,issued_at=now(),updated_at=now() where id=v_invoice.id;
  insert into public.audit_events(organization_id,company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_invoice.organization_id,v_invoice.company_id,v_uid,'invoice.issued','sales_invoice',v_invoice.id,jsonb_build_object('invoice_number',v_invoice_number,'journal_entry_id',v_entry_id));
  return v_invoice.id;
end;
$function$;
