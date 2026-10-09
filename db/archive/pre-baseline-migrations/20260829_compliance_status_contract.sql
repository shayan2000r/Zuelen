-- Keep the status RPC aligned with the existing compliance_obligations_status_check.
-- RLS/permission checks and audit logging remain unchanged.
create or replace function public.update_compliance_obligation_status(p_obligation_id uuid, p_status text)
returns uuid
language plpgsql
set search_path to 'pg_catalog', 'public', 'app_private'
as $$
declare v public.compliance_obligations%rowtype;
begin
  if p_status not in ('upcoming','action_required','ready','filed','paid','overdue','not_applicable') then
    raise exception 'Invalid compliance status';
  end if;

  select * into v from public.compliance_obligations where id = p_obligation_id for update;
  if not found or not app_private.can_account_org(v.organization_id) then raise exception 'Permission denied'; end if;

  update public.compliance_obligations
  set status = p_status,
      completed_at = case when p_status in ('filed','paid','not_applicable') then now() else null end,
      updated_at = now()
  where id = v.id;

  insert into public.audit_events(organization_id,company_id,actor_user_id,event_type,entity_type,entity_id,metadata)
  values(v.organization_id,v.company_id,auth.uid(),'compliance_status_changed','compliance_obligation',v.id,jsonb_build_object('status',p_status));
  return v.id;
end
$$;
