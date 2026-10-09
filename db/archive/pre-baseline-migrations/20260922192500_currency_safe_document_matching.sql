-- Document-to-transaction matching must never treat equal numeric amounts
-- in different currencies as the same financial event.

create or replace function public.refresh_document_matches(p_document_id uuid)
returns integer
language plpgsql
set search_path to 'pg_catalog', 'public', 'app_private'
as $function$
declare
  v_doc public.documents%rowtype;
  v_total numeric;
  v_date date;
  v_name text;
  v_currency text;
  v_row record;
  v_score numeric;
  v_count integer:=0;
begin
  select * into v_doc from public.documents where id=p_document_id;
  if not found then raise exception 'Document not found'; end if;
  if not app_private.can_bookkeep_org(v_doc.organization_id) then raise exception 'Permission denied'; end if;

  begin v_total:=nullif(v_doc.extracted_data->>'total','')::numeric;
  exception when others then v_total:=null; end;

  begin v_date:=nullif(v_doc.extracted_data->>'document_date','')::date;
  exception when others then v_date:=null; end;

  v_name:=coalesce(
    nullif(trim(v_doc.extracted_data->>'transaction_counterparty'),''),
    nullif(trim(v_doc.extracted_data->>'issuer_name'),''),
    nullif(trim(v_doc.extracted_data->>'customer_name'),'')
  );

  v_currency:=upper(nullif(trim(v_doc.extracted_data->>'currency'),''));
  if v_currency is not null and v_currency !~ '^[A-Z]{3}$' then
    v_currency:=null;
  end if;

  delete from public.document_transaction_links
  where document_id=v_doc.id
    and status='suggested';

  for v_row in
    select st.*,bt.id as bank_id
    from public.source_transactions st
    left join public.bank_transactions bt
      on st.source_type='bank' and bt.id=st.source_id
    where st.company_id=v_doc.company_id
      and st.classification_status not in ('reversed','ignored')
      and (v_currency is null or upper(st.currency)=v_currency)
      and (v_total is null or abs(st.amount_gross-v_total)<=0.02)
      and (v_date is null or st.occurred_on between v_date-7 and v_date+7)
    order by st.occurred_on desc
    limit 20
  loop
    v_score:=0.35;
    if v_currency is not null and upper(v_row.currency)=v_currency then v_score:=v_score+.08; end if;
    if v_total is not null and abs(v_row.amount_gross-v_total)<=0.02 then v_score:=v_score+.37; end if;
    if v_date is not null and v_row.occurred_on=v_date then v_score:=v_score+.15;
    elsif v_date is not null and abs(v_row.occurred_on-v_date)<=3 then v_score:=v_score+.08; end if;
    if coalesce(v_name,'')<>'' and app_private.normalize_counterparty(v_row.counterparty_name) like '%'||split_part(app_private.normalize_counterparty(v_name),' ',1)||'%' then v_score:=v_score+.1; end if;

    insert into public.document_transaction_links(
      organization_id,company_id,document_id,source_transaction_id,bank_transaction_id,
      match_score,status,match_reason,created_by
    )
    values(
      v_doc.organization_id,v_doc.company_id,v_doc.id,v_row.id,v_row.bank_id,
      least(v_score,.99),'suggested',
      case when v_currency is not null
        then 'Matched using currency, amount, date and counterparty evidence.'
        else 'Matched using amount, date and counterparty evidence.'
      end,
      auth.uid()
    )
    on conflict(document_id,source_transaction_id)
      where source_transaction_id is not null
    do update set
      match_score=excluded.match_score,
      match_reason=excluded.match_reason,
      updated_at=now();

    v_count:=v_count+1;
  end loop;

  return v_count;
end
$function$;
