-- Year-aware personal fiscal and CCSS profiles for Luxembourg self-employed users.
-- Calculated totals intentionally stay out of the canonical profile tables.

create table if not exists public.personal_fiscal_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tax_year smallint not null check (tax_year between 2000 and 2100),
  residency_status text not null check (residency_status in ('resident','non_resident')),
  civil_status text not null check (civil_status in ('single','married','registered_partnership','divorced','separated','widowed')),
  civil_status_event_date date,
  qualifying_children_count smallint not null default 0 check (qualifying_children_count between 0 and 30),
  age_64_at_year_start boolean not null default false,
  taxation_mode text not null default 'not_applicable' check (taxation_mode in ('joint','individual','individual_reallocation','not_applicable','needs_confirmation')),
  partnership_full_year_conditions_met boolean not null default false,
  legally_recognized_separation boolean not null default false,
  transitional_class_2_used_in_prior_five_years boolean not null default false,
  derived_tax_class text not null check (derived_tax_class in ('1','1a','2','needs_confirmation')),
  derivation_version text not null default 'lu-resident-2026-v1',
  manual_tax_class_override text check (manual_tax_class_override is null or manual_tax_class_override in ('1','1a','2')),
  acd_tax_rate_percent numeric(7,4) check (acd_tax_rate_percent is null or (acd_tax_rate_percent >= 0 and acd_tax_rate_percent <= 100)),
  override_source text,
  override_reason text,
  last_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tax_year),
  check (civil_status_event_date is null or extract(year from civil_status_event_date) between 1900 and 2100),
  check (manual_tax_class_override is null or nullif(btrim(coalesce(override_source,'')),'') is not null)
);

create table if not exists public.ccss_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tax_year smallint not null check (tax_year between 2000 and 2100),
  affiliation_type text not null check (affiliation_type in ('principal','secondary','manager')),
  activity_legal_form text not null check (activity_legal_form in ('own_name','company')),
  affiliation_start_date date not null,
  estimated_annual_professional_income numeric(14,2) not null check (estimated_annual_professional_income >= 0),
  income_status text not null check (income_status in ('provisional','user_confirmed','final_acd')),
  income_source text not null check (income_source in ('manual','accounting_proxy','manager_remuneration','acd_final')),
  aaa_factor numeric(6,4) not null default 1.0000 check (aaa_factor between 0.1000 and 5.0000),
  mde_membership text not null default 'not_affiliated' check (mde_membership in ('not_affiliated','affiliated')),
  mde_class smallint check (mde_class between 1 and 4),
  pension_reduction_status text not null default 'not_requested' check (pension_reduction_status in ('not_requested','requested','approved')),
  insignificant_income_exemption_status text not null default 'not_requested' check (insignificant_income_exemption_status in ('not_requested','requested','approved')),
  assisting_spouse_enabled boolean not null default false,
  assisting_spouse_qualifying_relationship boolean not null default false,
  assisting_spouse_main_activity boolean not null default false,
  last_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tax_year),
  check ((mde_membership = 'affiliated' and mde_class is not null) or (mde_membership = 'not_affiliated' and mde_class is null)),
  check (income_source <> 'accounting_proxy' or activity_legal_form = 'own_name'),
  check (affiliation_type <> 'manager' or income_source in ('manual','manager_remuneration','acd_final')),
  check (
    not assisting_spouse_enabled
    or (
      activity_legal_form = 'own_name'
      and assisting_spouse_qualifying_relationship
      and assisting_spouse_main_activity
    )
  )
);

create table if not exists public.ccss_parameter_periods (
  id uuid primary key default gen_random_uuid(),
  effective_from date not null unique,
  effective_to date,
  ssm numeric(14,2) not null check (ssm > 0),
  secondary_activity_minimum numeric(14,2) not null check (secondary_activity_minimum > 0),
  maximum_contribution_base numeric(14,2) not null check (maximum_contribution_base > 0),
  assisting_spouse_maximum numeric(14,2) not null check (assisting_spouse_maximum > 0),
  dependency_allowance numeric(14,2) not null check (dependency_allowance >= 0),
  health_rate numeric(9,6) not null check (health_rate >= 0),
  sickness_cash_benefit_rate numeric(9,6) not null check (sickness_cash_benefit_rate >= 0),
  pension_rate numeric(9,6) not null check (pension_rate >= 0),
  dependency_rate numeric(9,6) not null check (dependency_rate >= 0),
  accident_base_rate numeric(9,6) not null check (accident_base_rate >= 0),
  mde_class_1_rate numeric(9,6) not null check (mde_class_1_rate >= 0),
  mde_class_2_rate numeric(9,6) not null check (mde_class_2_rate >= 0),
  mde_class_3_rate numeric(9,6) not null check (mde_class_3_rate >= 0),
  mde_class_4_rate numeric(9,6) not null check (mde_class_4_rate >= 0),
  source_authority text not null,
  source_reference text not null,
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  check (maximum_contribution_base >= ssm),
  check (assisting_spouse_maximum >= ssm)
);

create table if not exists public.ccss_statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ccss_profile_id uuid not null references public.ccss_profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  contribution_month date not null,
  statement_issue_date date not null,
  amount_due numeric(14,2) not null check (amount_due >= 0),
  due_date date not null,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','disputed')),
  paid_date date,
  source_document_id uuid references public.documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, company_id, contribution_month),
  check (contribution_month = date_trunc('month', contribution_month)::date),
  check (due_date = statement_issue_date + 10),
  check ((payment_status = 'paid' and paid_date is not null) or (payment_status <> 'paid' and paid_date is null))
);

alter table public.ccss_parameter_periods
  add constraint ccss_parameter_periods_no_overlap
  exclude using gist (daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') with &&);

create index if not exists ccss_statements_user_company_due_idx on public.ccss_statements(user_id, company_id, due_date);
create index if not exists ccss_statements_profile_idx on public.ccss_statements(ccss_profile_id);
create index if not exists ccss_statements_source_document_idx on public.ccss_statements(source_document_id) where source_document_id is not null;

create or replace function app_private.touch_ccss_row()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists personal_fiscal_profiles_touch on public.personal_fiscal_profiles;
create trigger personal_fiscal_profiles_touch before update on public.personal_fiscal_profiles
for each row execute function app_private.touch_ccss_row();
drop trigger if exists ccss_profiles_touch on public.ccss_profiles;
create trigger ccss_profiles_touch before update on public.ccss_profiles
for each row execute function app_private.touch_ccss_row();
drop trigger if exists ccss_statements_touch on public.ccss_statements;
create trigger ccss_statements_touch before update on public.ccss_statements
for each row execute function app_private.touch_ccss_row();

alter table public.personal_fiscal_profiles enable row level security;
alter table public.ccss_profiles enable row level security;
alter table public.ccss_parameter_periods enable row level security;
alter table public.ccss_statements enable row level security;

revoke all on public.personal_fiscal_profiles, public.ccss_profiles, public.ccss_parameter_periods, public.ccss_statements from public, anon;
revoke all on public.ccss_parameter_periods from authenticated;
grant select, insert, update, delete on public.personal_fiscal_profiles, public.ccss_profiles, public.ccss_statements to authenticated;
grant select on public.ccss_parameter_periods to authenticated;

create policy personal_fiscal_profiles_select_own on public.personal_fiscal_profiles
for select to authenticated using ((select auth.uid()) = user_id);
create policy personal_fiscal_profiles_insert_own on public.personal_fiscal_profiles
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy personal_fiscal_profiles_update_own on public.personal_fiscal_profiles
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy personal_fiscal_profiles_delete_own on public.personal_fiscal_profiles
for delete to authenticated using ((select auth.uid()) = user_id);

create policy ccss_profiles_select_own on public.ccss_profiles
for select to authenticated using ((select auth.uid()) = user_id);
create policy ccss_profiles_insert_own on public.ccss_profiles
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy ccss_profiles_update_own on public.ccss_profiles
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy ccss_profiles_delete_own on public.ccss_profiles
for delete to authenticated using ((select auth.uid()) = user_id);

create policy ccss_parameter_periods_read on public.ccss_parameter_periods
for select to authenticated using (true);

create policy ccss_statements_select_own on public.ccss_statements
for select to authenticated using ((select auth.uid()) = user_id);
create policy ccss_statements_insert_own on public.ccss_statements
for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.ccss_profiles p
    where p.id = ccss_statements.ccss_profile_id
      and p.user_id = (select auth.uid())
      and p.tax_year = extract(year from ccss_statements.contribution_month)
  )
  and exists (
    select 1
    from public.companies c
    join public.organization_members m on m.organization_id = c.organization_id
    where c.id = ccss_statements.company_id and m.user_id = (select auth.uid())
  )
  and (
    source_document_id is null
    or exists (
      select 1 from public.documents d
      where d.id = ccss_statements.source_document_id and d.company_id = ccss_statements.company_id
    )
  )
);
create policy ccss_statements_update_own on public.ccss_statements
for update to authenticated using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.ccss_profiles p
    where p.id = ccss_statements.ccss_profile_id
      and p.user_id = (select auth.uid())
      and p.tax_year = extract(year from ccss_statements.contribution_month)
  )
  and exists (
    select 1
    from public.companies c
    join public.organization_members m on m.organization_id = c.organization_id
    where c.id = ccss_statements.company_id and m.user_id = (select auth.uid())
  )
  and (
    source_document_id is null
    or exists (
      select 1 from public.documents d
      where d.id = ccss_statements.source_document_id and d.company_id = ccss_statements.company_id
    )
  )
);
create policy ccss_statements_delete_own on public.ccss_statements
for delete to authenticated using ((select auth.uid()) = user_id);

insert into public.ccss_parameter_periods (
  effective_from,effective_to,ssm,secondary_activity_minimum,maximum_contribution_base,
  assisting_spouse_maximum,dependency_allowance,health_rate,sickness_cash_benefit_rate,
  pension_rate,dependency_rate,accident_base_rate,mde_class_1_rate,mde_class_2_rate,
  mde_class_3_rate,mde_class_4_rate,source_authority,source_reference,verified_at
) values
  ('2026-01-01','2026-05-31',2703.74,901.25,13518.68,5407.47,675.94,5.600000,0.500000,17.000000,1.400000,0.650000,0.230000,0.950000,1.560000,2.660000,'CCSS','https://ccss.public.lu/fr/publications/avis/2026/20260313-avis-60.html','2026-08-25T00:00:00Z'),
  ('2026-06-01','2026-12-31',2771.33,923.78,13856.63,5542.65,692.83,5.600000,0.500000,17.000000,1.400000,0.650000,0.230000,0.950000,1.560000,2.660000,'CCSS','https://ccss.public.lu/fr/parametres-sociaux.html','2026-08-25T00:00:00Z')
on conflict (effective_from) do nothing;
