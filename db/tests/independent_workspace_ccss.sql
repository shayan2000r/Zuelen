-- Complete Independent workspace regression. Safe for a populated test database:
-- every write is rolled back, and no customer or billing records are retained.
\set ON_ERROR_STOP on

begin;

do $$
begin
  if not exists (select 1 from auth.users) then
    raise exception 'Independent workspace regression requires one authenticated test identity';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  (select id::text from auth.users order by created_at, id limit 1),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
declare
  v_company_id uuid;
  v_slug text := 'independent-ccss-regression-' || txid_current()::text;
begin
  v_company_id := public.create_independent_workspace_v1(
    p_personal_legal_name => 'Independent workspace regression',
    p_activity_name => 'Regression activity',
    p_slug => v_slug,
    p_activity_description => 'Complete Independent onboarding regression',
    p_activity_category => 'consultant_freelancer',
    p_activity_start_date => current_date,
    p_accounting_start_date => current_date,
    p_location => 'Luxembourg',
    p_vat_registered => false,
    p_vat_number => null::text,
    p_vat_filing_frequency => null::text,
    p_rcs_registered => false,
    p_rcs_number => null::text,
    p_business_permit_held => false,
    p_business_permit_number => null::text,
    p_opening_cash_amount => 0::numeric,
    p_tax_year => extract(year from current_date)::smallint,
    p_residency_status => 'resident',
    p_civil_status => 'single',
    p_civil_status_event_date => null::date,
    p_qualifying_children_count => 0::smallint,
    p_age_64_at_year_start => false,
    p_taxation_mode => 'not_applicable',
    p_partnership_full_year_conditions_met => false,
    p_legally_recognized_separation => false,
    p_transitional_class_2_used_in_prior_five_years => false,
    p_derived_tax_class => '1',
    p_affiliation_type => 'principal',
    p_estimated_annual_professional_income => 48000::numeric,
    p_aaa_factor => 1.0000,
    p_mde_membership => 'not_affiliated',
    p_mde_class => null::smallint
  );

  if not exists (
    select 1
    from public.companies
    where id = v_company_id
      and entity_kind = 'independent'
  ) then
    raise exception 'Independent workspace was not created';
  end if;

  if not exists (
    select 1
    from public.compliance_obligations
    where company_id = v_company_id
      and authority = 'CCSS'
      and rule_key = 'ccss_initial_affiliation'
      and obligation_type = 'Initial self-employed affiliation'
  ) then
    raise exception 'Initial CCSS compliance obligation was not created';
  end if;
end;
$$;

reset role;
rollback;
