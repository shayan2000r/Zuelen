-- Remove redundant first-pass indexes and align the statement index with the workspace query path.
drop index if exists public.personal_fiscal_profiles_user_year_idx;
drop index if exists public.ccss_profiles_user_year_idx;
drop index if exists public.ccss_parameter_periods_effective_idx;
drop index if exists public.ccss_statements_user_due_idx;
drop index if exists public.ccss_statements_company_due_idx;

create index if not exists ccss_statements_user_company_due_idx
  on public.ccss_statements(user_id, company_id, due_date);
