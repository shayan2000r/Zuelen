-- Allow document-origin source transactions to post to the journal and
-- preserve the underlying merchant when document facts are applied.

alter table public.journal_entries
  drop constraint journal_entries_source_type_check;

alter table public.journal_entries
  add constraint journal_entries_source_type_check
  check (source_type = any(array[
    'manual'::text,
    'invoice'::text,
    'purchase'::text,
    'bank'::text,
    'document'::text,
    'asset'::text,
    'vat'::text,
    'tax'::text,
    'closing'::text,
    'reversal'::text,
    'import'::text
  ]));

create or replace function public.apply_document_facts_to_transaction(p_link_id uuid)
returns uuid
language plpgsql
set search_path to 'pg_catalog', 'public', 'app_private'
as $function$
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
  v_country:=nullif(coalesce(d.extracted_data->>'issuer_country',d.extracted_data->>'customer_country'),'');
  v_counterparty:=nullif(trim(d.extracted_data->>'transaction_counterparty'),'');
  if v_counterparty is null then
    v_counterparty:=nullif(trim(d.extracted_data->>'issuer_name'),'');
  end if;

  update public.source_transactions
  set
    amount_gross=coalesce(v_total,amount_gross),
    amount_net=coalesce(v_net,case when v_total is not null and v_vat is not null then v_total-v_vat else amount_net end),
    vat_amount=coalesce(v_vat,vat_amount),
    vat_rate=coalesce(v_rate,vat_rate),
    vat_treatment=v_treatment,
    counterparty_country=coalesce(v_country,counterparty_country),
    counterparty_name=coalesce(v_counterparty,counterparty_name),
    updated_at=now()
  where id=t.id;

  perform public.apply_source_transaction_suggestion(t.id);
  perform public.confirm_document_match(l.id);
  return t.id;
end
$function$;
