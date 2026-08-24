create index if not exists accountant_profile_events_viewer_lookup_idx
  on public.accountant_profile_events(viewer_user_id,profile_id,event_type,created_at desc);

drop policy if exists accountant_profiles_select on public.accountant_profiles;
create policy accountant_profiles_select on public.accountant_profiles
for select to authenticated
using (user_id=(select auth.uid()) or app_private.accountant_profile_is_public(id));

drop policy if exists accountant_profiles_insert on public.accountant_profiles;
create policy accountant_profiles_insert on public.accountant_profiles
for insert to authenticated
with check (user_id=(select auth.uid()));

drop policy if exists accountant_profiles_update on public.accountant_profiles;
create policy accountant_profiles_update on public.accountant_profiles
for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));