create or replace function app_private.accountant_profile_is_public(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public','auth','app_private'
as $$
  select exists (
    select 1
    from public.accountant_profiles p
    join public.accountant_listing_subscriptions s on s.profile_id = p.id
    where p.id = target_profile_id
      and p.approval_status = 'approved'
      and (
        s.status = 'active'
        or (s.status = 'trialing' and (s.trial_end is null or s.trial_end > now()))
      )
  );
$$;

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
  insert into public.accountant_profile_events(profile_id,event_type,viewer_user_id)
  values(p_profile_id,p_event_type,auth.uid());
  return true;
end;
$$;
revoke all on function public.record_accountant_profile_event(uuid,text) from public;
grant execute on function public.record_accountant_profile_event(uuid,text) to authenticated;

drop policy if exists accountant_profile_events_select on public.accountant_profile_events;
create policy accountant_profile_events_select on public.accountant_profile_events
for select to authenticated
using (
  app_private.owns_accountant_profile(profile_id)
  and exists (
    select 1 from public.accountant_listing_subscriptions s
    where s.profile_id=accountant_profile_events.profile_id
      and s.tier='premium'
      and (s.status='active' or (s.status='trialing' and (s.trial_end is null or s.trial_end>now())))
  )
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('accountant-profiles','accountant-profiles',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists accountant_profile_assets_insert on storage.objects;
create policy accountant_profile_assets_insert on storage.objects
for insert to authenticated
with check (bucket_id='accountant-profiles' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists accountant_profile_assets_update on storage.objects;
create policy accountant_profile_assets_update on storage.objects
for update to authenticated
using (bucket_id='accountant-profiles' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='accountant-profiles' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists accountant_profile_assets_delete on storage.objects;
create policy accountant_profile_assets_delete on storage.objects
for delete to authenticated
using (bucket_id='accountant-profiles' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists accountant_profile_assets_select_own on storage.objects;
create policy accountant_profile_assets_select_own on storage.objects
for select to authenticated
using (bucket_id='accountant-profiles' and (storage.foldername(name))[1]=auth.uid()::text);