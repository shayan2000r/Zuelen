-- Invoices to business customers abroad (Phase 1 VAT)
--
-- The "business customer abroad" treatment (eu_b2b_reverse_charge) now covers customers outside the EU
-- (United Kingdom, Switzerland, United States...): a service to a business is supplied where the customer is
-- established, so no Luxembourg VAT is charged (official return: box 423 for EU customers, box 019 for other
-- supplies abroad).
-- * EU customers keep the mention "Autoliquidation" and must have a VAT number.
-- * Customers outside the EU get a factual mention and no VAT number is required.
--
-- save_service_invoice_draft gets the same change in db/pending (its body removes draft lines, so it is applied
-- in the SQL editor).
-- * The EU recapitulative statement obligation now counts only customers in other EU Member States.
--
-- Register: A5, A8, A11.

create or replace function app_private.is_other_eu_country(p_country text)
returns boolean
language sql
immutable
set search_path to 'pg_catalog'
as $$
  select upper(trim(coalesce(p_country,''))) in ('AT','BE','BG','CY','CZ','DE','DK','EE','EL','GR','ES','FI','FR','HR','HU','IE','IT','LT','LV','MT','NL','PL','PT','RO','SE','SI','SK')
$$;
comment on function app_private.is_other_eu_country(text) is 'EU Member State other than Luxembourg (VAT country codes; Greece EL or GR).';
revoke all on function app_private.is_other_eu_country(text) from public, anon;
grant execute on function app_private.is_other_eu_country(text) to authenticated, service_role;

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
      -- Business customer in another Member State: the customer accounts for the VAT (reverse charge).
      when new.vat_treatment = 'eu_b2b_reverse_charge' and app_private.is_other_eu_country(new.customer_snapshot->>'country_code')
        then 'Autoliquidation'
      -- Business customer outside the EU: the service is supplied where the customer is established.
      when new.vat_treatment = 'eu_b2b_reverse_charge'
        then 'TVA non applicable – prestation de services à un preneur assujetti établi hors de l''Union européenne'
      when new.vat_treatment = 'domestic' and new.vat_total = 0 and v_company.vat_exemption_basis = 'exempt_activity'
        then 'Exonération de TVA – article 44 de la loi modifiée du 12 février 1979'
      when new.vat_treatment = 'domestic' and new.vat_total = 0 and (v_company.vat_exemption_basis = 'franchise' or not v_company.vat_registered)
        then 'TVA non applicable – Article 57bis de la loi modifiée du 12 février 1979'
      else null end;

    -- Freeze the establishment-authorisation barcode shown on the issued invoice.
    if v_company.establishment_barcode_path is not null then
      new.issuer_snapshot := coalesce(new.issuer_snapshot, '{}'::jsonb)
        || jsonb_build_object('establishment_barcode_path', v_company.establishment_barcode_path);
    end if;
  end if;
  return new;
end $$;

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
    if upper(trim(p_customer_country))='LU' then raise exception 'A Luxembourg customer is charged Luxembourg VAT: reverse charge applies to business customers abroad'; end if;
    if app_private.is_other_eu_country(p_customer_country) and nullif(trim(p_customer_vat_number),'') is null then raise exception 'Customer VAT number is required for an EU business customer (reverse charge)'; end if;
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

create or replace function public.sync_core_compliance_calendar(p_company_id uuid, p_fiscal_year integer)
returns integer
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_company public.companies%rowtype;
  v_profile public.independent_activity_profiles%rowtype;
  v_rule public.compliance_rules%rowtype;
  v_start date;
  v_end date;
  v_tax_year integer;
  v_count integer := 0;
  v_label text := p_fiscal_year::text;
  v_is_independent boolean;
  v_is_capital_company boolean;
  v_turnover numeric := 0;
  v_accounts_required boolean := false;
  v_i integer;
  v_period_start date;
  v_period_end date;
  v_date text;
  v_has_eu boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_company from public.companies where id = p_company_id;
  if not found then raise exception 'Company not found'; end if;
  if not app_private.can_account_org(v_company.organization_id) then raise exception 'You do not have permission to update this compliance calendar'; end if;
  if p_fiscal_year < 2000 or p_fiscal_year > 2100 then raise exception 'Invalid fiscal year'; end if;

  v_start := make_date(p_fiscal_year, v_company.fiscal_year_start_month, 1);
  v_end := (v_start + interval '1 year - 1 day')::date;
  v_tax_year := extract(year from v_end)::integer;
  v_is_independent := v_company.entity_kind = 'independent' or v_company.legal_form in ('SOLE_TRADER','INDEPENDENT');
  if v_is_independent then
    select * into v_profile from public.independent_activity_profiles where company_id = v_company.id;
  end if;

  -- Annual accounts ------------------------------------------------------------
  v_rule := app_private.active_compliance_rule('annual_accounts_approval', v_end);
  if v_rule.id is not null then
    v_is_capital_company := v_company.legal_form in (select jsonb_array_elements_text(v_rule.parameters->'legal_forms'));
    if v_is_capital_company then
      v_accounts_required := true;
    elsif v_is_independent and coalesce(v_profile.rcs_registered, false) then
      select coalesce(sum(jl.credit - jl.debit), 0) into v_turnover
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.journal_entry_id
      join public.company_accounts ca on ca.id = jl.company_account_id
      where je.company_id = v_company.id and je.status = 'posted'
        and je.entry_date between v_start and v_end and ca.code like '70%';
      v_accounts_required := v_turnover > (v_rule.parameters->>'independent_turnover_gt')::numeric;
    end if;

    if v_accounts_required then
      v_count := v_count + app_private.upsert_compliance_obligation(v_company, v_rule, 'annual_accounts_approval', v_label,
        (v_end + make_interval(months => (v_rule.parameters->>'months_after_year_end')::integer))::date,
        v_rule.parameters->>'label_en', v_rule.parameters->>'label_fr', jsonb_build_object('year_end', v_end));
      v_rule := app_private.active_compliance_rule('annual_accounts_filing', v_end);
      if v_rule.id is not null then
        v_count := v_count + app_private.upsert_compliance_obligation(v_company, v_rule, 'annual_accounts_filing', v_label,
          (v_end + make_interval(months => (v_rule.parameters->>'months_after_year_end_max')::integer))::date,
          v_rule.parameters->>'label_en', v_rule.parameters->>'label_fr', jsonb_build_object('year_end', v_end));
      end if;
    end if;
  end if;

  -- Direct tax returns ---------------------------------------------------------
  if v_is_independent then
    v_rule := app_private.active_compliance_rule('model_100', make_date(p_fiscal_year, 12, 31));
    if v_rule.id is not null then
      v_count := v_count + app_private.upsert_compliance_obligation(v_company, v_rule, 'model_100', v_label,
        make_date(p_fiscal_year + (v_rule.parameters->>'year_offset')::integer, 12, 31),
        v_rule.parameters->>'label_en', v_rule.parameters->>'label_fr', jsonb_build_object('tax_year', p_fiscal_year));
    end if;
  else
    v_rule := app_private.active_compliance_rule('model_500', make_date(v_tax_year, 12, 31));
    if v_rule.id is not null and v_company.legal_form in (select jsonb_array_elements_text(v_rule.parameters->'legal_forms')) then
      v_count := v_count + app_private.upsert_compliance_obligation(v_company, v_rule, 'model_500', v_label,
        make_date(v_tax_year + (v_rule.parameters->>'year_offset')::integer, 12, 31),
        v_rule.parameters->>'label_en', v_rule.parameters->>'label_fr', jsonb_build_object('tax_year', v_tax_year));
    end if;
  end if;

  -- Quarterly tax advances (only when fixed by the ACD) ------------------------
  if v_company.tax_advances_assessed then
    v_rule := app_private.active_compliance_rule('tax_advances_income', make_date(p_fiscal_year, 12, 31));
    if v_rule.id is not null then
      v_i := 0;
      for v_date in select jsonb_array_elements_text(v_rule.parameters->'dates') loop
        v_i := v_i + 1;
        v_count := v_count + app_private.upsert_compliance_obligation(v_company, v_rule, 'tax_advances_income_q' || v_i, p_fiscal_year::text || ' Q' || v_i,
          (p_fiscal_year::text || '-' || v_date)::date,
          case when v_is_independent then v_rule.parameters->>'label_en_individual' else v_rule.parameters->>'label_en_company' end || ' Q' || v_i,
          case when v_is_independent then v_rule.parameters->>'label_fr_individual' else v_rule.parameters->>'label_fr_company' end || ' T' || v_i);
      end loop;
    end if;

    v_rule := app_private.active_compliance_rule('tax_advances_business', make_date(p_fiscal_year, 12, 31));
    if v_rule.id is not null and (not v_is_independent
        or coalesce(v_profile.activity_category, '') in (select jsonb_array_elements_text(v_rule.parameters->'independent_categories'))) then
      v_i := 0;
      for v_date in select jsonb_array_elements_text(v_rule.parameters->'dates') loop
        v_i := v_i + 1;
        v_count := v_count + app_private.upsert_compliance_obligation(v_company, v_rule, 'tax_advances_business_q' || v_i, p_fiscal_year::text || ' Q' || v_i,
          (p_fiscal_year::text || '-' || v_date)::date,
          (v_rule.parameters->>'label_en') || ' Q' || v_i, (v_rule.parameters->>'label_fr') || ' T' || v_i);
      end loop;
    end if;

    if not v_is_independent then
      v_rule := app_private.active_compliance_rule('tax_advances_wealth', make_date(p_fiscal_year, 12, 31));
      if v_rule.id is not null then
        v_i := 0;
        for v_date in select jsonb_array_elements_text(v_rule.parameters->'dates') loop
          v_i := v_i + 1;
          v_count := v_count + app_private.upsert_compliance_obligation(v_company, v_rule, 'tax_advances_wealth_q' || v_i, p_fiscal_year::text || ' Q' || v_i,
            (p_fiscal_year::text || '-' || v_date)::date,
            (v_rule.parameters->>'label_en') || ' Q' || v_i, (v_rule.parameters->>'label_fr') || ' T' || v_i);
        end loop;
      end if;
    end if;
  end if;

  -- VAT returns (calendar periods) -------------------------------------------
  if v_company.vat_registered and v_company.vat_filing_frequency is not null then
    v_rule := app_private.active_compliance_rule('vat_periodic', make_date(p_fiscal_year, 12, 31));
    if v_rule.id is not null and v_company.vat_filing_frequency = 'quarterly' then
      for v_i in 1..4 loop
        v_period_start := make_date(p_fiscal_year, 1 + (v_i - 1) * 3, 1);
        v_count := v_count + app_private.upsert_compliance_obligation(v_company, v_rule, 'vat_quarterly_q' || v_i, p_fiscal_year::text || ' Q' || v_i,
          app_private.day_before((v_period_start + interval '3 months')::date + ((v_rule.parameters->>'before_day')::integer - 1)),
          v_rule.parameters->>'label_en_quarterly', v_rule.parameters->>'label_fr_quarterly', jsonb_build_object('frequency', 'quarterly'));
      end loop;
    elsif v_rule.id is not null and v_company.vat_filing_frequency = 'monthly' then
      for v_i in 1..12 loop
        v_period_start := make_date(p_fiscal_year, v_i, 1);
        v_count := v_count + app_private.upsert_compliance_obligation(v_company, v_rule, 'vat_month_' || lpad(v_i::text, 2, '0'), to_char(v_period_start, 'YYYY-MM'),
          app_private.day_before((v_period_start + interval '1 month')::date + ((v_rule.parameters->>'before_day')::integer - 1)),
          v_rule.parameters->>'label_en_monthly', v_rule.parameters->>'label_fr_monthly', jsonb_build_object('frequency', 'monthly'));
      end loop;
    end if;

    v_rule := app_private.active_compliance_rule('vat_annual', make_date(p_fiscal_year, 12, 31));
    if v_rule.id is not null then
      v_count := v_count + app_private.upsert_compliance_obligation(v_company, v_rule, 'vat_annual', v_label,
        app_private.day_before(((p_fiscal_year + 1)::text || '-' ||
          case when v_company.vat_filing_frequency = 'annual' then v_rule.parameters->>'annual_only_before' else v_rule.parameters->>'periodic_filers_before' end)::date),
        v_rule.parameters->>'label_en', v_rule.parameters->>'label_fr', jsonb_build_object('frequency', v_company.vat_filing_frequency));
    end if;

    -- EU recapitulative statements: one per period with EU B2B supplies -------
    v_rule := app_private.active_compliance_rule('eu_recap', make_date(p_fiscal_year, 12, 31));
    if v_rule.id is not null then
      for v_i in 1..(case when v_company.eu_recap_frequency = 'quarterly' then 4 else 12 end) loop
        if v_company.eu_recap_frequency = 'quarterly' then
          v_period_start := make_date(p_fiscal_year, 1 + (v_i - 1) * 3, 1);
          v_period_end := (v_period_start + interval '3 months - 1 day')::date;
        else
          v_period_start := make_date(p_fiscal_year, v_i, 1);
          v_period_end := (v_period_start + interval '1 month - 1 day')::date;
        end if;
        select exists (
          select 1 from public.sales_invoices si
          where si.company_id = v_company.id and si.status = 'issued' and si.vat_treatment = 'eu_b2b_reverse_charge'
            and app_private.is_other_eu_country(si.customer_snapshot->>'country_code')
            and si.service_date between v_period_start and v_period_end
          union all
          select 1 from public.source_transactions st
          where st.company_id = v_company.id and st.direction = 'income' and st.vat_treatment = 'eu_b2b_reverse_charge'
            and app_private.is_other_eu_country(st.counterparty_country)
            and st.classification_status = 'posted' and st.occurred_on between v_period_start and v_period_end
        ) into v_has_eu;
        if v_has_eu then
          v_count := v_count + app_private.upsert_compliance_obligation(v_company, v_rule,
            'eu_recap_' || case when v_company.eu_recap_frequency = 'quarterly' then 'q' || v_i else lpad(v_i::text, 2, '0') end,
            case when v_company.eu_recap_frequency = 'quarterly' then p_fiscal_year::text || ' Q' || v_i else to_char(v_period_start, 'YYYY-MM') end,
            app_private.day_before((v_period_end + 1) + ((v_rule.parameters->>'before_day')::integer - 1)),
            v_rule.parameters->>'label_en', v_rule.parameters->>'label_fr', jsonb_build_object('frequency', v_company.eu_recap_frequency));
        end if;
      end loop;
    end if;
  end if;

  return v_count;
end;
$function$;
