create or replace function public.current_user_requires_mfa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.mfa_factors factor
    where factor.user_id = (select auth.uid())
      and factor.status = 'verified'
  )
  and coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2';
$$;

revoke all on function public.current_user_requires_mfa() from public;
revoke all on function public.current_user_requires_mfa() from anon;
grant execute on function public.current_user_requires_mfa() to authenticated;

comment on function public.current_user_requires_mfa() is
  'Returns true when the current authenticated session is below AAL2 and the user has opted in with a verified MFA factor.';
