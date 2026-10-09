-- Optional authority-confirmed monthly bases from a CCSS statement.
-- These do not replace the income model; they let a user reproduce an assessed statement exactly.
alter table public.ccss_profiles
  add column if not exists confirmed_monthly_normal_base numeric(14,2),
  add column if not exists confirmed_monthly_pension_base numeric(14,2),
  add column if not exists confirmed_monthly_dependency_base numeric(14,2);

alter table public.ccss_profiles
  drop constraint if exists ccss_profiles_confirmed_bases_check;
alter table public.ccss_profiles
  add constraint ccss_profiles_confirmed_bases_check check (
    (
      confirmed_monthly_normal_base is null
      and confirmed_monthly_pension_base is null
      and confirmed_monthly_dependency_base is null
    )
    or (
      confirmed_monthly_normal_base >= 0
      and confirmed_monthly_pension_base >= 0
      and confirmed_monthly_dependency_base >= 0
      and pension_reduction_status = 'approved'
    )
  );
