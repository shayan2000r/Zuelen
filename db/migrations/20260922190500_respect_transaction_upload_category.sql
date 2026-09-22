-- Transaction intake should respect the category explicitly chosen by the user.
-- AI document_kind enriches extraction, but must not override a Receipt / Invoice
-- selection and block creation. Single-transaction bank/payment statements remain
-- supported when the AI extracted one clear transaction.

create or replace function public.create_source_transaction_from_document(p_document_id uuid)
returns jsonb
language plpgsql
set search_path to 'pg_catalog', 'public', 'app_private'
as $function$
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

  v_kind:=nullif(trim(v_doc.extracted_data->>'document_kind'),'');
  begin
    if jsonb_typeof(v_doc.extracted_data->'line_items')='array' then
      v_line_count:=jsonb_array_length(v_doc.extracted_data->'line_items');
    end if;
  exception when others then
    v_line_count:=0;
  end;

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

  if v_rate is not null and v_rate not in (0,3,8,14,17) then v_rate:=null; end if;
  if v_net is not null then v_net:=round(v_net,2); end if;
  if v_vat is not null then v_vat:=round(v_vat,2); end if;
  if v_net is not null and v_vat is not null and round(v_net+v_vat,2)<>v_total then
    v_net:=null; v_vat:=null; v_rate:=null;
  end if;

  v_treatment:=coalesce(nullif(trim(v_doc.extracted_data->>'suggested_vat_treatment'),''),'unknown');
  if v_treatment not in ('domestic','eu_b2b_reverse_charge','eu_acquisition','non_eu','exempt_or_zero','outside_scope','unknown') then
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
$function$;

revoke all on function public.create_source_transaction_from_document(uuid) from public, anon;
grant execute on function public.create_source_transaction_from_document(uuid) to authenticated;
