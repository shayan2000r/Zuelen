-- Invoice drafts for business customers abroad (run in the Supabase SQL editor: the function body removes
-- draft lines, which the connector cannot confirm from a cloud session).
--
-- Same change as db/migrations/20261009122117_invoice_customers_abroad.sql, for save_service_invoice_draft: a VAT number is
-- required only for a business customer in another EU Member State.

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
    if upper(trim(p_customer_country)) = 'LU' then raise exception 'A Luxembourg customer is charged Luxembourg VAT: reverse charge applies to business customers abroad'; end if;
    if app_private.is_other_eu_country(p_customer_country) and nullif(trim(p_customer_vat_number),'') is null then raise exception 'Customer VAT number is required for an EU business customer (reverse charge)'; end if;
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
