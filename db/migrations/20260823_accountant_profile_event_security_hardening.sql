create or replace function public.record_accountant_profile_event(p_profile_id uuid,p_event_type text)
returns boolean
language plpgsql
security definer
set search_path to 'public','auth','app_private'
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then return false; end if;
  if p_event_type not in ('view','email','phone','website') then
    raise exception 'Invalid accountant profile event';
  end if;
  if not app_private.accountant_profile_is_public(p_profile_id) then return false; end if;

  select user_id into v_owner from public.accountant_profiles where id=p_profile_id;
  if v_owner=auth.uid() then return true; end if;

  if exists (
    select 1
    from public.accountant_profile_events
    where profile_id=p_profile_id
      and event_type=p_event_type
      and viewer_user_id=auth.uid()
      and created_at > now() - interval '5 minutes'
  ) then
    return true;
  end if;

  insert into public.accountant_profile_events(profile_id,event_type,viewer_user_id)
  values(p_profile_id,p_event_type,auth.uid());
  return true;
end;
$$;

revoke all on function public.record_accountant_profile_event(uuid,text) from public;
revoke all on function public.record_accountant_profile_event(uuid,text) from anon;
grant execute on function public.record_accountant_profile_event(uuid,text) to authenticated;