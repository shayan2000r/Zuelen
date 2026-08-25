-- Unified economic workspaces: one auth identity, explicit entity kind, additive onboarding.

alter table public.companies
  add column if not exists entity_kind text;

update public.companies
set entity_kind = 'company'
where entity_kind is null;

alter table public.companies
  alter column entity_kind set default 'company',
  alter column entity_kind set not null;

alter table public.companies
  drop constraint if exists companies_entity_kind_check;
alter table public.companies
  add constraint companies_entity_kind_check
  check (entity_kind in ('independent', 'company'));

alter table public.companies
  drop constraint if exists companies_legal_form_check;
alter table public.companies
  add constraint companies_legal_form_check
  check (legal_form in ('SARL-S', 'SARL', 'SA', 'SAS', 'SCA', 'SOLE_TRADER', 'INDEPENDENT', 'OTHER'));

create index if not exists companies_organization_entity_kind_idx
  on public.companies (organization_id, entity_kind);
create index if not exists organization_members_user_created_idx
  on public.organization_members (user_id, created_at, organization_id);

create table if not exists public.independent_activity_profiles (
  company_id uuid primary key references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  personal_legal_name text not null,
  activity_name text,
  activity_category text not null
    check (activity_category in ('liberal_profession', 'commercial', 'craft', 'consultant_freelancer', 'other')),
  activity_start_date date not null,
  accounting_start_date date not null,
  location text not null default 'Luxembourg',
  rcs_registered boolean not null default false,
  business_permit_held boolean not null default false,
  opening_cash_amount numeric(14,2) not null default 0 check (opening_cash_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, company_id)
);

create index if not exists independent_activity_profiles_user_idx
  on public.independent_activity_profiles (user_id, created_at, company_id);

drop trigger if exists independent_activity_profiles_touch on public.independent_activity_profiles;
create trigger independent_activity_profiles_touch
before update on public.independent_activity_profiles
for each row execute function public.touch_updated_at();

alter table public.independent_activity_profiles enable row level security;
revoke all on public.independent_activity_profiles from public, anon;
grant select, insert, update, delete on public.independent_activity_profiles to authenticated;

create policy independent_activity_profiles_select on public.independent_activity_profiles
for select to authenticated using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.companies c
    join public.organization_members m on m.organization_id = c.organization_id
    where c.id = independent_activity_profiles.company_id
      and c.entity_kind = 'independent'
      and m.user_id = (select auth.uid())
  )
);
create policy independent_activity_profiles_insert on public.independent_activity_profiles
for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.companies c
    join public.organization_members m on m.organization_id = c.organization_id
    where c.id = independent_activity_profiles.company_id
      and c.entity_kind = 'independent'
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  )
);
create policy independent_activity_profiles_update on public.independent_activity_profiles
for update to authenticated using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.companies c
    join public.organization_members m on m.organization_id = c.organization_id
    where c.id = independent_activity_profiles.company_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  )
) with check ((select auth.uid()) = user_id);
create policy independent_activity_profiles_delete on public.independent_activity_profiles
for delete to authenticated using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.companies c
    join public.organization_members m on m.organization_id = c.organization_id
    where c.id = independent_activity_profiles.company_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  )
);

create or replace function public.create_company_workspace_v2(
  p_legal_name text,
  p_slug text,
  p_legal_form text,
  p_rcs_number text default null,
  p_vat_number text default null,
  p_municipality text default null,
  p_vat_registered boolean default true,
  p_business_permit_number text default null,
  p_registered_address jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_company_id uuid;
  v_year integer := extract(year from current_date)::integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_legal_name), '') is null then raise exception 'Legal company name is required'; end if;
  if nullif(btrim(p_slug), '') is null then raise exception 'Workspace slug is required'; end if;
  if p_legal_form not in ('SARL-S', 'SARL', 'SA', 'SAS', 'SCA', 'OTHER') then
    raise exception 'Choose a valid incorporated company legal form';
  end if;

  insert into public.organizations(name, slug, owner_id)
  values (btrim(p_legal_name), lower(btrim(p_slug)), v_uid)
  returning id into v_org_id;

  insert into public.companies(
    organization_id, legal_name, legal_form, entity_kind, rcs_number, vat_number,
    municipality, vat_registered, vat_filing_frequency, base_currency,
    business_permit_number, registered_address
  ) values (
    v_org_id, btrim(p_legal_name), p_legal_form, 'company', nullif(btrim(p_rcs_number), ''),
    nullif(btrim(p_vat_number), ''), nullif(btrim(p_municipality), ''), coalesce(p_vat_registered, false),
    case when coalesce(p_vat_registered, false) then 'annual' else null end, 'EUR',
    nullif(btrim(p_business_permit_number), ''), coalesce(p_registered_address, '{}'::jsonb)
  ) returning id into v_company_id;

  insert into public.company_accounts(organization_id, company_id, pcn_account_id, code, label, account_type, is_active)
  select v_org_id, v_company_id, p.id, p.code, coalesce(p.label_en, p.label_fr), p.account_type, true
  from public.pcn_accounts p
  where p.source_version = 'PCN2020' and p.is_active = true
  on conflict (company_id, code) do nothing;

  insert into public.accounting_periods(organization_id, company_id, starts_on, ends_on, status)
  values (v_org_id, v_company_id, make_date(v_year, 1, 1), make_date(v_year, 12, 31), 'open')
  on conflict (company_id, starts_on, ends_on) do nothing;
  return v_company_id;
end;
$$;

create or replace function public.create_independent_workspace_v1(
  p_personal_legal_name text,
  p_activity_name text,
  p_slug text,
  p_activity_description text,
  p_activity_category text,
  p_activity_start_date date,
  p_accounting_start_date date,
  p_location text default 'Luxembourg',
  p_vat_registered boolean default false,
  p_vat_number text default null,
  p_vat_filing_frequency text default null,
  p_rcs_registered boolean default false,
  p_rcs_number text default null,
  p_business_permit_held boolean default false,
  p_business_permit_number text default null,
  p_opening_cash_amount numeric default 0,
  p_tax_year smallint default extract(year from current_date)::smallint,
  p_residency_status text default 'resident',
  p_civil_status text default 'single',
  p_civil_status_event_date date default null,
  p_qualifying_children_count smallint default 0,
  p_age_64_at_year_start boolean default false,
  p_taxation_mode text default 'not_applicable',
  p_partnership_full_year_conditions_met boolean default false,
  p_legally_recognized_separation boolean default false,
  p_transitional_class_2_used_in_prior_five_years boolean default false,
  p_derived_tax_class text default '1',
  p_affiliation_type text default 'principal',
  p_estimated_annual_professional_income numeric default 0,
  p_aaa_factor numeric default 1.0000,
  p_mde_membership text default 'not_affiliated',
  p_mde_class smallint default null
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_company_id uuid;
  v_display_name text;
  v_period_start date;
  v_period_end date;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_personal_legal_name), '') is null then raise exception 'Personal legal name is required'; end if;
  if nullif(btrim(p_slug), '') is null then raise exception 'Workspace slug is required'; end if;
  if p_activity_category not in ('liberal_profession', 'commercial', 'craft', 'consultant_freelancer', 'other') then raise exception 'Invalid activity category'; end if;
  if p_vat_filing_frequency is not null and p_vat_filing_frequency not in ('annual', 'quarterly', 'monthly') then raise exception 'Invalid VAT filing frequency'; end if;
  if p_affiliation_type not in ('principal', 'secondary') then raise exception 'Invalid independent affiliation type'; end if;
  if p_residency_status not in ('resident', 'non_resident') then raise exception 'Invalid residency status'; end if;
  if p_civil_status not in ('single', 'married', 'registered_partnership', 'divorced', 'separated', 'widowed') then raise exception 'Invalid civil status'; end if;
  if p_taxation_mode not in ('joint', 'individual', 'individual_reallocation', 'not_applicable', 'needs_confirmation') then raise exception 'Invalid taxation mode'; end if;
  if p_derived_tax_class not in ('1', '1a', '2', 'needs_confirmation') then raise exception 'Invalid derived tax class'; end if;
  if p_mde_membership not in ('not_affiliated', 'affiliated') then raise exception 'Invalid MDE membership'; end if;
  if p_mde_membership = 'affiliated' and not coalesce(p_mde_class between 1 and 4, false) then raise exception 'Confirm the MDE class'; end if;
  if p_mde_membership = 'not_affiliated' and p_mde_class is not null then raise exception 'MDE class requires membership'; end if;
  if p_activity_start_date is null or p_accounting_start_date is null then raise exception 'Activity and accounting start dates are required'; end if;
  if coalesce(p_opening_cash_amount, 0) < 0 or coalesce(p_estimated_annual_professional_income, 0) < 0 then raise exception 'Amounts cannot be negative'; end if;

  v_display_name := coalesce(nullif(btrim(p_activity_name), ''), btrim(p_personal_legal_name));
  v_period_start := make_date(p_tax_year, 1, 1);
  v_period_end := make_date(p_tax_year, 12, 31);

  insert into public.organizations(name, slug, owner_id)
  values (v_display_name, lower(btrim(p_slug)), v_uid)
  returning id into v_org_id;

  insert into public.companies(
    organization_id, legal_name, trading_name, legal_form, entity_kind, rcs_number,
    vat_number, business_permit_number, municipality, activity, fiscal_year_start_month,
    base_currency, vat_registered, vat_filing_frequency, registered_address
  ) values (
    v_org_id, btrim(p_personal_legal_name), nullif(btrim(p_activity_name), ''), 'INDEPENDENT', 'independent',
    case when p_rcs_registered then nullif(btrim(p_rcs_number), '') else null end,
    case when p_vat_registered then nullif(btrim(p_vat_number), '') else null end,
    case when p_business_permit_held then nullif(btrim(p_business_permit_number), '') else null end,
    nullif(btrim(p_location), ''), nullif(btrim(p_activity_description), ''), 1, 'EUR',
    coalesce(p_vat_registered, false), case when p_vat_registered then coalesce(p_vat_filing_frequency, 'annual') else null end,
    jsonb_build_object('city', coalesce(nullif(btrim(p_location), ''), 'Luxembourg'), 'country_code', 'LU')
  ) returning id into v_company_id;

  insert into public.independent_activity_profiles(
    company_id, user_id, personal_legal_name, activity_name, activity_category,
    activity_start_date, accounting_start_date, location, rcs_registered,
    business_permit_held, opening_cash_amount
  ) values (
    v_company_id, v_uid, btrim(p_personal_legal_name), nullif(btrim(p_activity_name), ''), p_activity_category,
    p_activity_start_date, p_accounting_start_date, coalesce(nullif(btrim(p_location), ''), 'Luxembourg'),
    coalesce(p_rcs_registered, false), coalesce(p_business_permit_held, false), coalesce(p_opening_cash_amount, 0)
  );

  insert into public.company_accounts(organization_id, company_id, pcn_account_id, code, label, account_type, is_active)
  select v_org_id, v_company_id, p.id, p.code, coalesce(p.label_en, p.label_fr), p.account_type, true
  from public.pcn_accounts p
  where p.source_version = 'PCN2020' and p.is_active = true
  on conflict (company_id, code) do nothing;

  insert into public.accounting_periods(organization_id, company_id, starts_on, ends_on, status)
  values (v_org_id, v_company_id, v_period_start, v_period_end, 'open')
  on conflict (company_id, starts_on, ends_on) do nothing;

  insert into public.compliance_obligations(
    organization_id, company_id, authority, obligation_type, period_label,
    due_date, status, rule_key, rule_version, metadata
  ) values (
    v_org_id, v_company_id, 'CCSS', 'Initial self-employed affiliation',
    extract(year from p_activity_start_date)::text, p_activity_start_date + 8,
    case when p_activity_start_date + 8 < current_date then 'overdue' else 'upcoming' end,
    'ccss_initial_affiliation', '2026.1',
    jsonb_build_object('activity_start_date', p_activity_start_date, 'source_authority', 'CCSS', 'semantic_state', 'derived_deadline')
  ) on conflict (company_id, rule_key, period_label) where rule_key is not null do nothing;

  insert into public.personal_fiscal_profiles(
    user_id, tax_year, residency_status, civil_status, civil_status_event_date, qualifying_children_count,
    age_64_at_year_start, taxation_mode, partnership_full_year_conditions_met,
    legally_recognized_separation, transitional_class_2_used_in_prior_five_years,
    derived_tax_class, derivation_version, last_confirmed_at
  ) values (
    v_uid, p_tax_year, p_residency_status, p_civil_status, p_civil_status_event_date, p_qualifying_children_count,
    p_age_64_at_year_start, p_taxation_mode, p_partnership_full_year_conditions_met,
    p_legally_recognized_separation, p_transitional_class_2_used_in_prior_five_years,
    p_derived_tax_class, 'lu-resident-2026-v1', now()
  ) on conflict (user_id, tax_year) do nothing;

  insert into public.ccss_profiles(
    user_id, tax_year, affiliation_type, activity_legal_form, affiliation_start_date,
    estimated_annual_professional_income, income_status, income_source, aaa_factor,
    mde_membership, mde_class, pension_reduction_status, insignificant_income_exemption_status,
    assisting_spouse_enabled, assisting_spouse_qualifying_relationship, assisting_spouse_main_activity,
    last_confirmed_at
  ) values (
    v_uid, p_tax_year, p_affiliation_type, 'own_name', p_activity_start_date,
    p_estimated_annual_professional_income, 'user_confirmed', 'manual', p_aaa_factor,
    p_mde_membership, case when p_mde_membership = 'affiliated' then p_mde_class else null end,
    'not_requested', 'not_requested', false, false, false, now()
  ) on conflict (user_id, tax_year) do nothing;

  return v_company_id;
end;
$$;

revoke all on function public.create_independent_workspace_v1(text,text,text,text,text,date,date,text,boolean,text,text,boolean,text,boolean,text,numeric,smallint,text,text,date,smallint,boolean,text,boolean,boolean,boolean,text,text,numeric,numeric,text,smallint) from public, anon;
grant execute on function public.create_independent_workspace_v1(text,text,text,text,text,date,date,text,boolean,text,text,boolean,text,boolean,text,numeric,smallint,text,text,date,smallint,boolean,text,boolean,boolean,boolean,text,text,numeric,numeric,text,smallint) to authenticated;

revoke all on function public.create_company_workspace_v2(text,text,text,text,text,text,boolean,text,jsonb) from public, anon;
grant execute on function public.create_company_workspace_v2(text,text,text,text,text,text,boolean,text,jsonb) to authenticated;
