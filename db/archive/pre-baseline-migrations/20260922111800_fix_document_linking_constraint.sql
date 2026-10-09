-- Fix document evidence linking failing the documents_extraction_status_check.
-- "complete" is the existing terminal extraction state understood by the UI.

create or replace function public.confirm_document_match(p_link_id uuid)
returns uuid
language plpgsql
set search_path to 'pg_catalog', 'public', 'app_private'
as $function$
declare
  v_link public.document_transaction_links%rowtype;
begin
  select *
  into v_link
  from public.document_transaction_links
  where id = p_link_id
  for update;

  if not found then
    raise exception 'Match not found';
  end if;

  if not app_private.can_bookkeep_org(v_link.organization_id) then
    raise exception 'Permission denied';
  end if;

  update public.document_transaction_links
  set status = 'rejected',
      updated_at = now()
  where document_id = v_link.document_id
    and id <> v_link.id
    and status = 'suggested';

  update public.document_transaction_links
  set status = 'confirmed',
      updated_at = now()
  where id = v_link.id;

  update public.documents
  set extraction_status = case
    when extraction_status = 'needs_review' then 'complete'
    else extraction_status
  end
  where id = v_link.document_id;

  insert into public.audit_events(
    organization_id,
    company_id,
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values(
    v_link.organization_id,
    v_link.company_id,
    auth.uid(),
    'document_match_confirmed',
    'document',
    v_link.document_id,
    jsonb_build_object(
      'link_id', v_link.id,
      'source_transaction_id', v_link.source_transaction_id,
      'score', v_link.match_score
    )
  );

  return v_link.id;
end
$function$;
