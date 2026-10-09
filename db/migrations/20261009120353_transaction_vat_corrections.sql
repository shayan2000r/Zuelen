-- VAT on transactions: corrections, reverse charge and document intake (Phase 1 VAT audit)
--
-- * correct_source_transaction: one call updates the amounts and the VAT details of a transaction (rate,
--   treatment, country). A posted transaction is reversed and posted again with the corrected facts.
--   Before, editing a reverse-charge purchase stored net = gross - VAT and the posting failed; the rate and
--   treatment of a posted transaction were silently left unchanged.
--   update_source_transaction_safe is kept for older clients and now calls the new function.
-- * classify_and_post_source_transaction:
--   - intra-Community acquisitions of goods are self-assessed like reverse-charge services;
--   - only Luxembourg VAT (domestic or self-assessed) is deducted; VAT under another treatment is a cost;
--   - VAT with an unconfirmed treatment, Luxembourg VAT on an EU / export / exempt sale, and an EU purchase
--     with no self-assessed VAT are refused with a message.
-- * Document intake: VAT rates are checked against the rates in force on the document date (the 2023 rates
--   were dropped before); VAT on a purchase from a supplier outside Luxembourg is flagged for review; a bank
--   movement keeps its amount when a document is matched to it; the counterparty country is validated.
-- * Learned classification rules no longer apply a VAT rate that was not in force on the transaction date.
--
-- Register: A9, A13, A14 (docs/compliance/REGULATORY_REGISTER.md).

CREATE OR REPLACE FUNCTION public.correct_source_transaction(p_source_transaction_id uuid, p_occurred_on date, p_direction text, p_amount_gross numeric, p_amount_net numeric, p_vat_amount numeric, p_vat_rate numeric, p_vat_treatment text, p_counterparty_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_counterparty_country text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_tx public.source_transactions%rowtype;
  v_account_code text;
  v_old jsonb;
  v_reversal uuid;
  v_gross numeric(18,2):=round(p_amount_gross,2);
  v_vat numeric(18,2):=round(coalesce(p_vat_amount,0),2);
  v_net numeric(18,2):=round(p_amount_net,2);
  v_country text:=nullif(upper(trim(p_counterparty_country)),'');
  v_self_assessed boolean;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_tx from public.source_transactions where id=p_source_transaction_id for update;
  if not found then raise exception 'Transaction not found'; end if;
  if not app_private.can_bookkeep_org(v_tx.organization_id) then raise exception 'You do not have permission to edit this transaction'; end if;
  if v_tx.classification_status='reversed' then raise exception 'This transaction was reversed and can no longer be edited'; end if;
  if p_direction not in ('income','expense') then raise exception 'Choose income or expense'; end if;
  if v_gross is null or v_gross<=0 then raise exception 'Gross amount must be greater than zero'; end if;
  if v_vat<0 then raise exception 'VAT cannot be negative'; end if;
  if p_vat_treatment is null or p_vat_treatment not in ('domestic','eu_b2b_reverse_charge','eu_acquisition','non_eu','exempt_or_zero','outside_scope','unknown') then
    raise exception 'Choose a valid VAT treatment';
  end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then raise exception 'Country must be a 2-letter code'; end if;
  if p_direction='income' and p_vat_treatment='eu_acquisition' then raise exception 'An intra-Community acquisition is a purchase'; end if;
  if v_vat>0 and p_vat_treatment in ('non_eu','exempt_or_zero','outside_scope','unknown') then
    raise exception 'Choose Luxembourg VAT or an EU purchase to record a VAT amount';
  end if;
  if v_vat>0 and p_direction='income' and p_vat_treatment='eu_b2b_reverse_charge' then
    raise exception 'A sale to an EU business customer carries no Luxembourg VAT';
  end if;

  -- Self-assessed VAT on an EU purchase is not part of the amount paid, so there is no separate net amount.
  v_self_assessed:=p_direction='expense' and p_vat_treatment in ('eu_b2b_reverse_charge','eu_acquisition');
  if v_self_assessed then
    v_net:=null;
  else
    if v_vat>v_gross then raise exception 'VAT must be between zero and gross amount'; end if;
    v_net:=coalesce(v_net,v_gross-v_vat);
    if v_net+v_vat<>v_gross then raise exception 'Net amount plus VAT must equal the gross amount'; end if;
  end if;
  v_old:=to_jsonb(v_tx);

  if v_tx.classification_status='posted' and v_tx.posted_journal_entry_id is not null then
    select code into v_account_code from public.company_accounts where id=v_tx.suggested_account_id;
    if v_account_code is null then raise exception 'The original accounting category is missing'; end if;
    v_reversal:=public.reverse_posted_journal_entry(v_tx.posted_journal_entry_id,'Transaction corrected');
  end if;

  update public.source_transactions set
    occurred_on=p_occurred_on,
    direction=p_direction,
    amount_gross=v_gross,
    amount_net=v_net,
    vat_amount=v_vat,
    vat_rate=p_vat_rate,
    vat_treatment=p_vat_treatment,
    counterparty_country=v_country,
    counterparty_name=nullif(trim(p_counterparty_name),''),
    description=nullif(trim(p_description),''),
    classification_status='review',
    posted_journal_entry_id=null,
    updated_at=now()
  where id=v_tx.id;

  if v_account_code is not null then
    perform public.classify_and_post_source_transaction(v_tx.id,v_account_code);
  end if;

  insert into public.audit_events(organization_id,company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v_tx.organization_id,v_tx.company_id,v_uid,'source_transaction.updated','source_transaction',v_tx.id,jsonb_build_object('before',v_old,'reversal_entry_id',v_reversal));
  return v_tx.id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_source_transaction_safe(p_source_transaction_id uuid, p_occurred_on date, p_direction text, p_amount_gross numeric, p_vat_amount numeric, p_counterparty_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_tx public.source_transactions%rowtype;
begin
  -- Kept for older clients: keeps the stored VAT rate, treatment and country.
  select * into v_tx from public.source_transactions where id=p_source_transaction_id;
  if not found then raise exception 'Transaction not found'; end if;
  return public.correct_source_transaction(p_source_transaction_id,p_occurred_on,p_direction,p_amount_gross,null,p_vat_amount,
    v_tx.vat_rate,v_tx.vat_treatment,p_counterparty_name,p_description,v_tx.counterparty_country);
end;
$function$
;

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
 -- Purchases from EU businesses (services under reverse charge, goods as intra-Community acquisitions):
 -- the buyer self-assesses Luxembourg VAT.
 v_reverse:=v_tx.direction='expense' and v_tx.vat_treatment in ('eu_b2b_reverse_charge','eu_acquisition');
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
 -- Only Luxembourg VAT (charged by a Luxembourg supplier, or self-assessed) is deducted in the Luxembourg
 -- return. VAT recorded under any other treatment (for example foreign VAT) is part of the cost.
 v_share:=case when v_tx.vat_treatment in ('domestic','eu_b2b_reverse_charge','eu_acquisition') then app_private.vat_deduction_share(v_company) else 0 end;
 if v_tx.direction='expense' or v_is_expense_refund then
   v_deductible:=round(v_base_vat*v_share,2); v_non_deductible:=v_base_vat-v_deductible;
   v_orig_deductible:=round(v_vat_amount*v_share,2); v_orig_non_deductible:=v_vat_amount-v_orig_deductible;
 end if;

 if v_selected.account_type in ('asset','liability') and v_vat_amount<>0 then raise exception 'Balance-sheet transfers cannot carry VAT in this workflow'; end if;
 if v_vat_amount>0 and v_tx.vat_treatment='unknown' then
   raise exception 'Confirm the VAT situation of this transaction before posting it (Luxembourg VAT, EU, outside the EU or no VAT)';
 end if;
 if v_vat_amount>0 and v_tx.direction='income' and not v_is_expense_refund
    and v_tx.vat_treatment in ('eu_b2b_reverse_charge','eu_acquisition','non_eu','exempt_or_zero','outside_scope') then
   raise exception 'A sale with this VAT treatment cannot carry Luxembourg VAT';
 end if;
 if v_reverse and v_vat_amount<=0 then
   raise exception 'Enter the Luxembourg VAT rate to self-assess on this EU purchase before posting it';
 end if;
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

CREATE OR REPLACE FUNCTION public.create_source_transaction_from_document(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'app_private'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_doc public.documents%rowtype;
  v_existing_id uuid;
  v_transaction_id uuid;
  v_link_id uuid;
  v_kind text;
  v_direction text;
  v_currency text;
  v_counterparty text;
  v_counterparty_country text;
  v_description text;
  v_treatment text;
  v_date date;
  v_total numeric(18,2);
  v_net numeric(18,2);
  v_vat numeric(18,2);
  v_rate numeric(5,2);
  v_line_count integer := 0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_doc
  from public.documents
  where id=p_document_id
  for update;

  if not found then raise exception 'Document not found'; end if;
  if not app_private.can_bookkeep_org(v_doc.organization_id) then raise exception 'Permission denied'; end if;

  select id into v_existing_id
  from public.source_transactions
  where company_id=v_doc.company_id
    and source_type='document'
    and source_id=v_doc.id
  order by created_at asc
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object('transaction_id',v_existing_id,'created',false,'matched_existing',false,'already_created',true);
  end if;

  if v_doc.extracted_data is null or v_doc.extraction_status not in ('needs_review','complete') then
    raise exception 'Analyze the document before creating a transaction';
  end if;

  if jsonb_typeof(v_doc.extracted_data->'type_safeguard') = 'object'
     and coalesce((v_doc.extracted_data->'type_safeguard'->>'resolved')::boolean,false) = false then
    raise exception 'Confirm the document type before creating a transaction';
  end if;

  v_kind:=nullif(trim(v_doc.extracted_data->>'document_kind'),'');
  begin
    if jsonb_typeof(v_doc.extracted_data->'line_items')='array' then
      v_line_count:=jsonb_array_length(v_doc.extracted_data->'line_items');
    end if;
  exception when others then
    v_line_count:=0;
  end;

  -- The category chosen by the user in Transactions is authoritative.
  -- AI classification enriches the document but must not block a receipt/invoice intake.
  if v_doc.type not in ('receipt','purchase_invoice','sales_invoice') then
    if v_kind in ('receipt','purchase_invoice','sales_invoice') then
      null;
    elsif v_kind='bank_statement'
      and nullif(trim(v_doc.extracted_data->>'transaction_counterparty'),'') is not null
      and v_line_count=1 then
      null;
    else
      raise exception 'This document does not represent a single transaction that Zuelen can prepare automatically';
    end if;
  end if;

  begin v_total:=nullif(v_doc.extracted_data->>'total','')::numeric; exception when others then v_total:=null; end;
  if v_total is null or v_total<=0 then raise exception 'The document amount could not be read. Review the document before creating a transaction'; end if;
  v_total:=round(v_total,2);

  begin
    v_date:=coalesce(
      nullif(v_doc.extracted_data->>'service_date','')::date,
      nullif(v_doc.extracted_data->>'document_date','')::date
    );
  exception when others then
    v_date:=null;
  end;
  if v_date is null then raise exception 'The transaction date could not be read. Review the document before creating a transaction'; end if;

  v_currency:=upper(coalesce(nullif(trim(v_doc.extracted_data->>'currency'),''),'EUR'));
  if v_currency !~ '^[A-Z]{3}$' then v_currency:='EUR'; end if;

  v_direction:=nullif(trim(v_doc.extracted_data->>'transaction_direction'),'');
  if v_direction is null or v_direction not in ('income','expense') then
    v_direction:=case when v_kind='sales_invoice' or v_doc.type='sales_invoice' then 'income' else 'expense' end;
  end if;

  select string_agg(nullif(trim(item->>'description'),''),' · ')
  into v_description
  from jsonb_array_elements(coalesce(v_doc.extracted_data->'line_items','[]'::jsonb)) item
  where nullif(trim(item->>'description'),'') is not null;

  v_counterparty:=nullif(trim(v_doc.extracted_data->>'transaction_counterparty'),'');
  if v_counterparty is null then
    v_counterparty:=case
      when v_kind='sales_invoice' or v_doc.type='sales_invoice' then nullif(trim(v_doc.extracted_data->>'customer_name'),'')
      else nullif(trim(v_doc.extracted_data->>'issuer_name'),'')
    end;
  end if;

  v_counterparty_country:=case
    when v_kind='sales_invoice' or v_doc.type='sales_invoice' then nullif(upper(trim(v_doc.extracted_data->>'customer_country')),'')
    else nullif(upper(trim(v_doc.extracted_data->>'issuer_country')),'')
  end;

  if coalesce(v_doc.extracted_data->>'notes','') ilike '%transaction statement%'
     and v_description is not null then
    v_counterparty:=coalesce(nullif(trim(v_doc.extracted_data->>'transaction_counterparty'),''),split_part(v_description,' · ',1));
    v_counterparty_country:=null;
  end if;

  if v_counterparty_country is not null and v_counterparty_country !~ '^[A-Z]{2}$' then
    v_counterparty_country:=null;
  end if;

  begin v_net:=nullif(v_doc.extracted_data->>'subtotal','')::numeric; exception when others then v_net:=null; end;
  begin v_vat:=nullif(v_doc.extracted_data->>'vat_amount','')::numeric; exception when others then v_vat:=null; end;
  begin v_rate:=nullif(v_doc.extracted_data->>'vat_rate','')::numeric; exception when others then v_rate:=null; end;

  if v_rate is not null and not public.lu_vat_rate_allowed(v_rate,v_date) then v_rate:=null; end if;
  if v_net is not null then v_net:=round(v_net,2); end if;
  if v_vat is not null then v_vat:=round(v_vat,2); end if;
  if v_net is not null and v_vat is not null and round(v_net+v_vat,2)<>v_total then
    v_net:=null; v_vat:=null; v_rate:=null;
  end if;

  v_treatment:=coalesce(nullif(trim(v_doc.extracted_data->>'suggested_vat_treatment'),''),'unknown');
  if v_treatment not in ('domestic','eu_b2b_reverse_charge','eu_acquisition','non_eu','exempt_or_zero','outside_scope','unknown') then
    v_treatment:='unknown';
  end if;
  -- VAT charged by a supplier outside Luxembourg is not Luxembourg VAT: ask the user to confirm the treatment.
  if v_direction='expense' and v_treatment='domestic' and coalesce(v_vat,0)>0
     and v_counterparty_country is not null and v_counterparty_country<>'LU' then
    v_treatment:='unknown';
  end if;

  select l.source_transaction_id into v_existing_id
  from public.document_transaction_links l
  join public.source_transactions st on st.id=l.source_transaction_id
  where l.document_id=v_doc.id
    and l.status in ('suggested','confirmed')
    and l.source_transaction_id is not null
    and upper(st.currency)=v_currency
    and abs(st.amount_gross-v_total)<=0.02
    and coalesce(l.match_score,0)>=0.83
  order by case when l.status='confirmed' then 0 else 1 end,l.match_score desc,l.created_at asc
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object('transaction_id',v_existing_id,'created',false,'matched_existing',true,'already_created',false);
  end if;

  perform public.assert_usage_available(v_doc.organization_id,'transactions',1);

  insert into public.source_transactions(
    organization_id,company_id,occurred_on,direction,amount_gross,amount_net,vat_amount,currency,
    counterparty_name,description,source_type,source_id,classification_status,created_by,vat_rate,
    vat_treatment,counterparty_country
  )
  values(
    v_doc.organization_id,v_doc.company_id,v_date,v_direction,v_total,v_net,v_vat,v_currency,
    v_counterparty,v_description,'document',v_doc.id,'review',v_uid,v_rate,v_treatment,v_counterparty_country
  )
  returning id into v_transaction_id;

  perform public.apply_source_transaction_suggestion(v_transaction_id);

  insert into public.document_transaction_links(
    organization_id,company_id,document_id,source_transaction_id,match_score,status,match_reason,created_by
  )
  values(
    v_doc.organization_id,v_doc.company_id,v_doc.id,v_transaction_id,1,'suggested',
    'Transaction created from this document''s extracted facts.',v_uid
  )
  returning id into v_link_id;

  perform public.confirm_document_match(v_link_id);

  return jsonb_build_object('transaction_id',v_transaction_id,'created',true,'matched_existing',false,'already_created',false);
end
$function$
;

CREATE OR REPLACE FUNCTION public.apply_document_facts_to_transaction(p_link_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'app_private'
AS $function$
declare
  l public.document_transaction_links%rowtype;
  d public.documents%rowtype;
  t public.source_transactions%rowtype;
  v_total numeric;
  v_net numeric;
  v_vat numeric;
  v_rate numeric;
  v_treatment text;
  v_country text;
  v_counterparty text;
  v_currency text;
  v_gross numeric;
  v_amounts_match boolean;
begin
  select * into l
  from public.document_transaction_links
  where id=p_link_id;

  if not found or l.source_transaction_id is null then
    raise exception 'Document match is not linked to a transaction';
  end if;

  if not app_private.can_bookkeep_org(l.organization_id) then
    raise exception 'Permission denied';
  end if;

  select * into d from public.documents where id=l.document_id;
  select * into t from public.source_transactions where id=l.source_transaction_id for update;

  if t.classification_status in ('posted','reversed') then
    raise exception 'Posted transactions are immutable; reverse/correct the accounting entry instead';
  end if;

  begin v_total:=nullif(d.extracted_data->>'total','')::numeric; exception when others then v_total:=null; end;
  begin v_net:=nullif(d.extracted_data->>'subtotal','')::numeric; exception when others then v_net:=null; end;
  begin v_vat:=nullif(d.extracted_data->>'vat_amount','')::numeric; exception when others then v_vat:=null; end;
  begin v_rate:=nullif(d.extracted_data->>'vat_rate','')::numeric; exception when others then v_rate:=null; end;

  v_treatment:=coalesce(nullif(d.extracted_data->>'suggested_vat_treatment',''),'unknown');
  if v_treatment not in ('domestic','eu_b2b_reverse_charge','eu_acquisition','non_eu','exempt_or_zero','outside_scope','unknown') then
    v_treatment:='unknown';
  end if;
  if v_rate is not null and not public.lu_vat_rate_allowed(v_rate,t.occurred_on) then v_rate:=null; end if;
  v_currency:=upper(coalesce(nullif(trim(d.extracted_data->>'currency'),''),t.currency));
  -- The counterparty is the supplier on a purchase and the customer on a sale.
  v_country:=upper(nullif(trim(case when t.direction='income' then d.extracted_data->>'customer_country' else d.extracted_data->>'issuer_country' end),''));
  if v_country !~ '^[A-Z]{2}$' then v_country:=null; end if;
  v_counterparty:=nullif(trim(d.extracted_data->>'transaction_counterparty'),'');
  if v_counterparty is null then
    v_counterparty:=nullif(trim(d.extracted_data->>'issuer_name'),'');
  end if;

  -- A bank movement is the authority for the amount paid. The document's VAT is used only when the document is
  -- for the same amount and currency; amounts are kept consistent (net + VAT = gross).
  v_gross:=case when t.source_type='bank' then t.amount_gross else coalesce(round(v_total,2),t.amount_gross) end;
  v_amounts_match:=v_currency=upper(t.currency) and (v_total is null or abs(round(v_total,2)-v_gross)<=0.02);
  if not v_amounts_match then v_vat:=null; v_net:=null; v_rate:=null; end if;
  if v_vat is not null then
    v_vat:=round(v_vat,2);
    if v_vat<0 or v_vat>v_gross then
      v_vat:=null; v_net:=null; v_rate:=null;
    else
      v_net:=round(v_gross-v_vat,2);
    end if;
  end if;
  -- VAT charged by a supplier outside Luxembourg is not Luxembourg VAT: ask the user to confirm the treatment.
  if t.direction='expense' and v_treatment='domestic' and coalesce(v_vat,t.vat_amount,0)>0
     and v_country is not null and v_country<>'LU' then
    v_treatment:='unknown';
  end if;

  update public.source_transactions
  set
    amount_gross=v_gross,
    amount_net=case when v_vat is not null then v_net when v_gross=t.amount_gross then amount_net else null end,
    vat_amount=case when v_vat is not null then v_vat when v_gross=t.amount_gross then vat_amount else null end,
    vat_rate=case when v_vat is not null then v_rate else vat_rate end,
    vat_treatment=v_treatment,
    counterparty_country=coalesce(v_country,counterparty_country),
    counterparty_name=coalesce(v_counterparty,counterparty_name),
    updated_at=now()
  where id=t.id;

  perform public.apply_source_transaction_suggestion(t.id);
  perform public.confirm_document_match(l.id);
  return t.id;
end
$function$
;

CREATE OR REPLACE FUNCTION public.apply_source_transaction_suggestion(p_source_transaction_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'app_private'
AS $function$
declare v_tx public.source_transactions%rowtype;v_s record;v_match record;v_match_count integer;v_rule public.classification_rules%rowtype;v_norm text;v_raw jsonb;v_context text;v_protected boolean:=false;
begin
 select * into v_tx from public.source_transactions where id=p_source_transaction_id;if not found then raise exception 'Transaction not found';end if;if not app_private.can_bookkeep_org(v_tx.organization_id) then raise exception 'Permission denied';end if;
 if v_tx.source_type='bank' and v_tx.source_id is not null then select raw_data into v_raw from public.bank_transactions where id=v_tx.source_id;end if;
 v_context:=concat_ws(' ',nullif(v_tx.description,''),nullif(v_raw->>'operation_code',''),nullif(v_raw->>'communication',''),nullif(v_raw->>'raw_details',''),nullif(v_raw->>'counterparty_address',''),nullif(v_raw->>'counterparty_iban',''));
 select * into v_s from app_private.suggest_bank_account(v_tx.company_id,v_tx.direction,v_tx.counterparty_name,v_context);
 v_protected:=coalesce(v_s.kind,'') in ('shareholder_transfer','tax_advance','tax_payment','payment_processor_fee','refund_candidate','penalty','registry_payment','bank_transfer_unknown','bank_fee','platform_payout');
 if v_protected then update public.source_transactions set suggested_account_id=v_s.account_id,suggestion_confidence=v_s.confidence,suggestion_reason=v_s.reason,suggestion_kind=v_s.kind,updated_at=now() where id=v_tx.id;return v_s.account_id;end if;
 v_norm:=app_private.normalize_counterparty(v_tx.counterparty_name);
 if length(v_norm)>=3 then
  select * into v_rule from public.classification_rules where company_id=v_tx.company_id and direction=v_tx.direction and normalized_counterparty=v_norm order by times_confirmed desc,last_used_at desc limit 1;
  if found then update public.source_transactions set suggested_account_id=v_rule.company_account_id,suggestion_confidence=least(.99,.88+(least(v_rule.times_confirmed,5)*.02)),suggestion_reason='Learned from your previous confirmed treatment for this counterparty.',suggestion_kind='learned_rule',vat_treatment=case when vat_treatment='unknown' then v_rule.vat_treatment else vat_treatment end,vat_rate=coalesce(vat_rate,case when public.lu_vat_rate_allowed(v_rule.vat_rate,occurred_on) then v_rule.vat_rate end),counterparty_country=coalesce(counterparty_country,v_rule.counterparty_country),updated_at=now() where id=v_tx.id;update public.classification_rules set last_used_at=now(),updated_at=now() where id=v_rule.id;return v_rule.company_account_id;end if;
 end if;
 if v_s.account_id is null and v_s.kind is null and v_tx.direction='income' then
  select count(*) into v_match_count from public.source_transactions st where st.company_id=v_tx.company_id and st.direction='expense' and st.occurred_on between (v_tx.occurred_on-45) and v_tx.occurred_on and st.amount_gross=v_tx.amount_gross and st.suggested_account_id is not null and st.id<>v_tx.id;
  if v_match_count=1 then select st.id,st.suggested_account_id into v_match.id,v_match.suggested_account_id from public.source_transactions st where st.company_id=v_tx.company_id and st.direction='expense' and st.occurred_on between (v_tx.occurred_on-45) and v_tx.occurred_on and st.amount_gross=v_tx.amount_gross and st.suggested_account_id is not null and st.id<>v_tx.id limit 1;if v_match.suggested_account_id is not null then v_s.account_id:=v_match.suggested_account_id;v_s.confidence:=0.68;v_s.kind:='refund_candidate';v_s.reason:='Possible supplier refund: this bank inflow exactly matches one recent expense amount. Confirm the merchant/original purchase before posting.';end if;end if;
 end if;
 update public.source_transactions set suggested_account_id=v_s.account_id,suggestion_confidence=v_s.confidence,suggestion_reason=v_s.reason,suggestion_kind=v_s.kind,updated_at=now() where id=v_tx.id;return v_s.account_id;
end
$function$
;

revoke all on function public.correct_source_transaction(uuid, date, text, numeric, numeric, numeric, numeric, text, text, text, text) from public, anon;
grant execute on function public.correct_source_transaction(uuid, date, text, numeric, numeric, numeric, numeric, text, text, text, text) to authenticated, service_role;
