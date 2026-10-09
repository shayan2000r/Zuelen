-- Foreign-currency posting, transaction audit coverage and AI document-type safety.
-- Posted journal lines stay in the company base currency while original currency facts are preserved.

alter table public.source_transactions
  add column if not exists exchange_rate_to_base numeric(18,8);

alter table public.source_transactions
  drop constraint if exists source_transactions_exchange_rate_to_base_check;
alter table public.source_transactions
  add constraint source_transactions_exchange_rate_to_base_check
  check (exchange_rate_to_base is null or exchange_rate_to_base > 0);

alter table public.journal_lines
  add column if not exists original_currency text,
  add column if not exists original_debit numeric(18,2),
  add column if not exists original_credit numeric(18,2);

alter table public.journal_lines
  drop constraint if exists journal_lines_original_currency_check;
alter table public.journal_lines
  add constraint journal_lines_original_currency_check
  check (original_currency is null or original_currency ~ '^[A-Z]{3}$');

CREATE OR REPLACE FUNCTION app_private.audit_source_transaction_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'app_private'
AS $function$
declare
  v_event text;
  v_metadata jsonb := '{}'::jsonb;
begin
  if tg_op='INSERT' then
    v_event:='source_transaction.created';
    v_metadata:=jsonb_build_object(
      'direction',new.direction,
      'amount_gross',new.amount_gross,
      'currency',new.currency,
      'source_type',new.source_type,
      'classification_status',new.classification_status
    );
    insert into public.audit_events(organization_id,company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(new.organization_id,new.company_id,auth.uid(),v_event,'source_transaction',new.id,v_metadata);
    return new;
  elsif tg_op='DELETE' then
    -- Safe-delete RPCs already write a richer deletion event including reversal metadata.
    return old;
  end if;

  if old.classification_status is distinct from new.classification_status then
    if new.classification_status='posted' then
      v_event:='source_transaction.posted';
    else
      v_event:='source_transaction.status_changed';
    end if;
    v_metadata:=jsonb_build_object('from',old.classification_status,'to',new.classification_status);
    insert into public.audit_events(organization_id,company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(new.organization_id,new.company_id,auth.uid(),v_event,'source_transaction',new.id,v_metadata);
  end if;

  if old.exchange_rate_to_base is distinct from new.exchange_rate_to_base and new.exchange_rate_to_base is not null then
    insert into public.audit_events(organization_id,company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
    values(new.organization_id,new.company_id,auth.uid(),'source_transaction.exchange_rate_set','source_transaction',new.id,
      jsonb_build_object('currency',new.currency,'exchange_rate_to_base',new.exchange_rate_to_base));
  end if;

  return new;
end
$function$


drop trigger if exists audit_source_transaction_changes on public.source_transactions;
create trigger audit_source_transaction_changes
after insert or update or delete on public.source_transactions
for each row execute function app_private.audit_source_transaction_changes();

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

 if v_selected.account_type in ('asset','liability') and v_vat_amount<>0 then raise exception 'Balance-sheet transfers cannot carry VAT in this workflow'; end if;
 if v_vat_amount>0 then
   if not v_company.vat_registered then raise exception 'VAT cannot be posted for a company that is not marked as VAT registered'; end if;
   select * into v_vat_in from public.company_accounts where company_id=v_tx.company_id and code='421611' and is_active=true;
   select * into v_vat_out from public.company_accounts where company_id=v_tx.company_id and code='461411' and is_active=true;
   if v_reverse and (v_vat_in.id is null or v_vat_out.id is null) then raise exception 'Reverse-charge VAT accounts are missing'; end if;
   if not v_reverse and (case when v_is_expense_refund or v_tx.direction='expense' then v_vat_in.id else v_vat_out.id end) is null then raise exception 'The required VAT ledger account is missing'; end if;
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
   values(v_tx.organization_id,v_entry_id,v_bank.id,v_description,v_base_gross,0,v_base_currency,v_fx,case when upper(trim(v_tx.currency))<>v_base_currency then upper(trim(v_tx.currency)) else null end,case when upper(trim(v_tx.currency))<>v_base_currency then v_tx.amount_gross else null end,0);
   insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,description,debit,credit,currency,exchange_rate,original_currency,original_debit,original_credit)
   values(v_tx.organization_id,v_entry_id,v_selected.id,v_description,0,v_base_net,v_base_currency,v_fx,case when upper(trim(v_tx.currency))<>v_base_currency then upper(trim(v_tx.currency)) else null end,0,case when upper(trim(v_tx.currency))<>v_base_currency then v_net else null end);
   if v_vat_amount>0 then
     if v_is_expense_refund then
       insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,description,debit,credit,currency,exchange_rate,vat_code,vat_rate,vat_amount,original_currency,original_debit,original_credit)
       values(v_tx.organization_id,v_entry_id,v_vat_in.id,'Input VAT reversal',0,v_base_vat,v_base_currency,v_fx,'INPUT_REVERSAL',v_tx.vat_rate,v_base_vat,case when upper(trim(v_tx.currency))<>v_base_currency then upper(trim(v_tx.currency)) else null end,0,case when upper(trim(v_tx.currency))<>v_base_currency then v_vat_amount else null end);
     else
       insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,description,debit,credit,currency,exchange_rate,vat_code,vat_rate,vat_amount,original_currency,original_debit,original_credit)
       values(v_tx.organization_id,v_entry_id,v_vat_out.id,'Output VAT',0,v_base_vat,v_base_currency,v_fx,'OUTPUT',v_tx.vat_rate,v_base_vat,case when upper(trim(v_tx.currency))<>v_base_currency then upper(trim(v_tx.currency)) else null end,0,case when upper(trim(v_tx.currency))<>v_base_currency then v_vat_amount else null end);
     end if;
   end if;
 else
   insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,description,debit,credit,currency,exchange_rate,vat_code,vat_rate,vat_amount,original_currency,original_debit,original_credit)
   values(v_tx.organization_id,v_entry_id,v_selected.id,v_description,v_base_net,0,v_base_currency,v_fx,case when v_reverse then 'RC_BASE' else null end,v_tx.vat_rate,case when v_reverse then v_base_vat else null end,case when upper(trim(v_tx.currency))<>v_base_currency then upper(trim(v_tx.currency)) else null end,case when upper(trim(v_tx.currency))<>v_base_currency then v_net else null end,0);
   if v_vat_amount>0 then
     if v_reverse then
       insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,description,debit,credit,currency,exchange_rate,vat_code,vat_rate,vat_amount,original_currency,original_debit,original_credit)
       values(v_tx.organization_id,v_entry_id,v_vat_in.id,'Reverse-charge input VAT',v_base_vat,0,v_base_currency,v_fx,'RC_INPUT',v_tx.vat_rate,v_base_vat,case when upper(trim(v_tx.currency))<>v_base_currency then upper(trim(v_tx.currency)) else null end,case when upper(trim(v_tx.currency))<>v_base_currency then v_vat_amount else null end,0);
       insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,description,debit,credit,currency,exchange_rate,vat_code,vat_rate,vat_amount,original_currency,original_debit,original_credit)
       values(v_tx.organization_id,v_entry_id,v_vat_out.id,'Reverse-charge output VAT',0,v_base_vat,v_base_currency,v_fx,'RC_OUTPUT',v_tx.vat_rate,v_base_vat,case when upper(trim(v_tx.currency))<>v_base_currency then upper(trim(v_tx.currency)) else null end,0,case when upper(trim(v_tx.currency))<>v_base_currency then v_vat_amount else null end);
     else
       insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,description,debit,credit,currency,exchange_rate,vat_code,vat_rate,vat_amount,original_currency,original_debit,original_credit)
       values(v_tx.organization_id,v_entry_id,v_vat_in.id,'Input VAT',v_base_vat,0,v_base_currency,v_fx,'INPUT',v_tx.vat_rate,v_base_vat,case when upper(trim(v_tx.currency))<>v_base_currency then upper(trim(v_tx.currency)) else null end,case when upper(trim(v_tx.currency))<>v_base_currency then v_vat_amount else null end,0);
     end if;
   end if;
   insert into public.journal_lines(organization_id,journal_entry_id,company_account_id,description,debit,credit,currency,exchange_rate,original_currency,original_debit,original_credit)
   values(v_tx.organization_id,v_entry_id,v_bank.id,v_description,0,v_base_gross,v_base_currency,v_fx,case when upper(trim(v_tx.currency))<>v_base_currency then upper(trim(v_tx.currency)) else null end,0,case when upper(trim(v_tx.currency))<>v_base_currency then v_tx.amount_gross else null end);
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


revoke all on function public.classify_and_post_source_transaction(uuid,text) from public, anon;
grant execute on function public.classify_and_post_source_transaction(uuid,text) to authenticated;

-- Prevent direct RPC callers from bypassing an unresolved AI type conflict.
do $do$
declare
  v_sql text;
  v_old text := 'if v_doc.extracted_data is null or v_doc.extraction_status not in (''needs_review'',''complete'') then
    raise exception ''Analyze the document before creating a transaction'';
  end if;';
  v_new text := 'if v_doc.extracted_data is null or v_doc.extraction_status not in (''needs_review'',''complete'') then
    raise exception ''Analyze the document before creating a transaction'';
  end if;

  if jsonb_typeof(v_doc.extracted_data->''type_safeguard'') = ''object''
     and coalesce((v_doc.extracted_data->''type_safeguard''->>''resolved'')::boolean,false) = false then
    raise exception ''Confirm the document type before creating a transaction'';
  end if;';
begin
  select pg_get_functiondef('public.create_source_transaction_from_document(uuid)'::regprocedure) into v_sql;
  if position(v_new in v_sql)=0 then
    if position(v_old in v_sql)=0 then
      raise exception 'Expected document preparation guard was not found';
    end if;
    execute replace(v_sql,v_old,v_new);
  end if;
end
$do$;
