-- Compliance calendar v2 (regulatory register E3, E6, E7, E8, A3, A4, A5)
--
-- * Deadlines are now read from public.compliance_rules (dated, sourced rows) instead of being
--   hard-coded in sync_core_compliance_calendar.
-- * "avant le Xe jour" deadlines are shown on the last day that complies (day X - 1).
-- * Annual accounts and Model 500 cover every capital-company form offered at setup
--   (SARL-S, SARL, SA, SAS, SCA) and RCS-registered independents with turnover > EUR 100,000.
-- * New obligations: EU recapitulative statements, Model 100 for independents, and quarterly
--   tax advances (only when the company says the ACD has fixed advances).
-- * Labels are stored in English and French in the obligation metadata.

alter table public.companies
  add column if not exists tax_advances_assessed boolean not null default false,
  add column if not exists eu_recap_frequency text not null default 'monthly';

do $$ begin
  alter table public.companies add constraint companies_eu_recap_frequency_check check (eu_recap_frequency in ('monthly','quarterly'));
exception when duplicate_object then null; end $$;

comment on column public.companies.tax_advances_assessed is
  'True when the ACD has fixed quarterly tax advances (bulletin de fixation des avances) for this taxpayer.';
comment on column public.companies.eu_recap_frequency is
  'Periodicity of the EU recapitulative statement. Monthly by default; quarterly may be chosen for services (and for goods up to EUR 50,000 per quarter).';

-- ---------------------------------------------------------------------------
-- Rules: retire version 2026.1 and insert version 2026.2
-- ---------------------------------------------------------------------------
update public.compliance_rules set is_active = false where version = '2026.1' and jurisdiction = 'LU';

insert into public.compliance_rules (jurisdiction, rule_key, authority, title, version, effective_from, effective_to, source_url, source_verified_at, parameters, is_active)
values
('LU','vat_periodic','AED','Monthly or quarterly VAT return','2026.2','2020-01-01',null,
 'https://guichet.public.lu/fr/entreprises/fiscalite/impots-benefices/tva/declarations/declaration-tva.html','2026-10-09',
 jsonb_build_object('before_day',15,
   'statutory_fr','avant le 15e jour du mois (trimestre) qui suit celui au cours duquel la taxe est devenue exigible',
   'label_en_monthly','Monthly VAT return','label_fr_monthly','Déclaration TVA mensuelle',
   'label_en_quarterly','Quarterly VAT return','label_fr_quarterly','Déclaration TVA trimestrielle'),true),
('LU','vat_annual','AED','Annual VAT return','2026.2','2020-01-01',null,
 'https://guichet.public.lu/fr/entreprises/fiscalite/impots-benefices/tva/declarations/declaration-tva.html','2026-10-09',
 jsonb_build_object('annual_only_before','03-01','periodic_filers_before','05-01',
   'turnover_annual_lt',112000,'turnover_quarterly_lt',620000,
   'statutory_fr','avant le 1er mars (déclarants annuels) / avant le 1er mai (déclarants mensuels ou trimestriels) de l''année suivante',
   'label_en','Annual VAT return','label_fr','Déclaration TVA annuelle'),true),
('LU','eu_recap','AED','EU recapitulative statement','2026.2','2020-01-01',null,
 'https://guichet.public.lu/fr/entreprises/fiscalite/impots-benefices/tva/declarations/etats-recapitulatifs.html','2026-10-09',
 jsonb_build_object('before_day',25,'goods_quarterly_threshold',50000,
   'statutory_fr','avant le 25e jour du mois qui suit la période déclarative',
   'label_en','EU recapitulative statement','label_fr','État récapitulatif UE'),true),
('LU','annual_accounts_approval','RCS','Approve annual accounts and allocation of result','2026.2','2020-01-01',null,
 'https://guichet.public.lu/fr/entreprises/gestion-juridique-comptabilite/registre-commerce/depots-publications/depot-comptes-annuels.html','2026-10-09',
 jsonb_build_object('months_after_year_end',6,'legal_forms',jsonb_build_array('SARL-S','SARL','SA','SAS','SCA'),
   'independent_turnover_gt',100000,
   'label_en','Approve annual accounts and allocation of result','label_fr','Approbation des comptes annuels et affectation du résultat'),true),
('LU','annual_accounts_filing','RCS','File annual accounts with the RCS','2026.2','2020-01-01',null,
 'https://guichet.public.lu/fr/entreprises/gestion-juridique-comptabilite/registre-commerce/depots-publications/depot-comptes-annuels.html','2026-10-09',
 jsonb_build_object('months_after_approval',1,'months_after_year_end_max',7,'legal_forms',jsonb_build_array('SARL-S','SARL','SA','SAS','SCA'),
   'independent_turnover_gt',100000,
   'label_en','File annual accounts (latest date)','label_fr','Dépôt des comptes annuels (date limite)',
   'note_en','Filing is due within one month after approval; this is the outer limit.',
   'note_fr','Le dépôt doit intervenir dans le mois de l''approbation ; ceci est la limite extrême.'),true),
('LU','model_500','ACD','Corporate tax return (Model 500)','2026.2','2022-01-01',null,
 'https://impotsdirects.public.lu/fr/az/d/delais/depot.html','2026-10-09',
 jsonb_build_object('deadline','12-31','year_offset',1,'legal_forms',jsonb_build_array('SARL-S','SARL','SA','SAS','SCA'),
   'label_en','Corporate tax return (Model 500)','label_fr','Déclaration d''impôt des collectivités (modèle 500)'),true),
('LU','model_100','ACD','Personal income tax return (Model 100)','2026.2','2022-01-01',null,
 'https://impotsdirects.public.lu/fr/az/d/delais/depot.html','2026-10-09',
 jsonb_build_object('deadline','12-31','year_offset',1,
   'label_en','Personal income tax return (Model 100)','label_fr','Déclaration d''impôt sur le revenu (modèle 100)'),true),
('LU','tax_advances_income','ACD','Quarterly income tax advances','2026.2','2020-01-01',null,
 'https://impotsdirects.public.lu/fr/az/c/calendrierfiscal.html','2026-10-09',
 jsonb_build_object('dates',jsonb_build_array('03-10','06-10','09-10','12-10'),
   'label_en_company','Corporate income tax advance','label_fr_company','Avance IRC',
   'label_en_individual','Income tax advance','label_fr_individual','Avance d''impôt sur le revenu',
   'note_en','Only if the ACD fixed advances in your bulletin.','note_fr','Uniquement si l''ACD a fixé des avances dans votre bulletin.'),true),
('LU','tax_advances_business','ACD','Quarterly municipal business tax advances','2026.2','2020-01-01',null,
 'https://impotsdirects.public.lu/fr/az/c/calendrierfiscal.html','2026-10-09',
 jsonb_build_object('dates',jsonb_build_array('02-10','05-10','08-10','11-10'),
   'independent_categories',jsonb_build_array('commercial','craft'),
   'label_en','Municipal business tax advance','label_fr','Avance d''impôt commercial',
   'note_en','Only if the ACD fixed advances in your bulletin.','note_fr','Uniquement si l''ACD a fixé des avances dans votre bulletin.'),true),
('LU','tax_advances_wealth','ACD','Quarterly net wealth tax advances','2026.2','2020-01-01',null,
 'https://impotsdirects.public.lu/fr/az/c/calendrierfiscal.html','2026-10-09',
 jsonb_build_object('dates',jsonb_build_array('02-10','05-10','08-10','11-10'),
   'label_en','Net wealth tax advance','label_fr','Avance d''impôt sur la fortune',
   'note_en','Only if the ACD fixed advances in your bulletin.','note_fr','Uniquement si l''ACD a fixé des avances dans votre bulletin.'),true)
on conflict (rule_key, version) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function app_private.active_compliance_rule(p_rule_key text, p_on date)
returns public.compliance_rules
language sql
stable
set search_path to 'pg_catalog', 'public'
as $$
  select r.* from public.compliance_rules r
  where r.rule_key = p_rule_key and r.is_active and r.jurisdiction = 'LU'
    and r.effective_from <= p_on and (r.effective_to is null or r.effective_to >= p_on)
  order by r.effective_from desc, r.version desc
  limit 1
$$;

create or replace function app_private.upsert_compliance_obligation(
  p_company public.companies,
  p_rule public.compliance_rules,
  p_rule_key text,
  p_period_label text,
  p_due date,
  p_label_en text,
  p_label_fr text,
  p_extra jsonb default '{}'::jsonb)
returns integer
language plpgsql
set search_path to 'pg_catalog', 'public'
as $$
begin
  insert into public.compliance_obligations(organization_id, company_id, authority, obligation_type, period_label, due_date, status, rule_key, rule_version, metadata)
  values (p_company.organization_id, p_company.id, p_rule.authority, p_label_en, p_period_label, p_due, 'upcoming', p_rule_key, p_rule.version,
    jsonb_strip_nulls(jsonb_build_object(
      'source_url', p_rule.source_url,
      'label_en', p_label_en,
      'label_fr', p_label_fr,
      'note', p_rule.parameters->>'note_en',
      'note_en', p_rule.parameters->>'note_en',
      'note_fr', p_rule.parameters->>'note_fr',
      'statutory_fr', p_rule.parameters->>'statutory_fr')) || coalesce(p_extra, '{}'::jsonb))
  on conflict (company_id, rule_key, period_label) where rule_key is not null
  do update set obligation_type = excluded.obligation_type,
                authority = excluded.authority,
                due_date = excluded.due_date,
                rule_version = excluded.rule_version,
                metadata = excluded.metadata,
                updated_at = now();
  return 1;
end
$$;

-- Last day that complies with a deadline expressed as "before <date>".
create or replace function app_private.day_before(p_date date)
returns date language sql immutable as $$ select (p_date - 1) $$;

revoke all on function app_private.active_compliance_rule(text, date) from public, anon;
revoke all on function app_private.upsert_compliance_obligation(public.companies, public.compliance_rules, text, text, date, text, text, jsonb) from public, anon;
revoke all on function app_private.day_before(date) from public, anon;
grant execute on function app_private.active_compliance_rule(text, date) to authenticated, service_role;
grant execute on function app_private.upsert_compliance_obligation(public.companies, public.compliance_rules, text, text, date, text, text, jsonb) to authenticated, service_role;
grant execute on function app_private.day_before(date) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Calendar generator
-- ---------------------------------------------------------------------------
create or replace function public.sync_core_compliance_calendar(p_company_id uuid, p_fiscal_year integer)
returns integer
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_company public.companies%rowtype;
  v_profile public.independent_activity_profiles%rowtype;
  v_rule public.compliance_rules%rowtype;
  v_start date;
  v_end date;
  v_tax_year integer;
  v_count integer := 0;
  v_label text := p_fiscal_year::text;
  v_is_independent boolean;
  v_is_capital_company boolean;
  v_turnover numeric := 0;
  v_accounts_required boolean := false;
  v_i integer;
  v_period_start date;
  v_period_end date;
  v_date text;
  v_has_eu boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_company from public.companies where id = p_company_id;
  if not found then raise exception 'Company not found'; end if;
  if not app_private.can_account_org(v_company.organization_id) then raise exception 'You do not have permission to update this compliance calendar'; end if;
  if p_fiscal_year < 2000 or p_fiscal_year > 2100 then raise exception 'Invalid fiscal year'; end if;

  v_start := make_date(p_fiscal_year, v_company.fiscal_year_start_month, 1);
  v_end := (v_start + interval '1 year - 1 day')::date;
  v_tax_year := extract(year from v_end)::integer;
  v_is_independent := v_company.entity_kind = 'independent' or v_company.legal_form in ('SOLE_TRADER','INDEPENDENT');
  if v_is_independent then
    select * into v_profile from public.independent_activity_profiles where company_id = v_company.id;
  end if;

  -- Annual accounts ------------------------------------------------------------
  v_rule := app_private.active_compliance_rule('annual_accounts_approval', v_end);
  if v_rule.id is not null then
    v_is_capital_company := v_company.legal_form in (select jsonb_array_elements_text(v_rule.parameters->'legal_forms'));
    if v_is_capital_company then
      v_accounts_required := true;
    elsif v_is_independent and coalesce(v_profile.rcs_registered, false) then
      select coalesce(sum(jl.credit - jl.debit), 0) into v_turnover
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.journal_entry_id
      join public.company_accounts ca on ca.id = jl.company_account_id
      where je.company_id = v_company.id and je.status = 'posted'
        and je.entry_date between v_start and v_end and ca.code like '70%';
      v_accounts_required := v_turnover > (v_rule.parameters->>'independent_turnover_gt')::numeric;
    end if;

    if v_accounts_required then
      v_count := v_count + app_private.upsert_compliance_obligation(v_company, v_rule, 'annual_accounts_approval', v_label,
        (v_end + make_interval(months => (v_rule.parameters->>'months_after_year_end')::integer))::date,
        v_rule.parameters->>'label_en', v_rule.parameters->>'label_fr', jsonb_build_object('year_end', v_end));
      v_rule := app_private.active_compliance_rule('annual_accounts_filing', v_end);
      if v_rule.id is not null then
        v_count := v_count + app_private.upsert_compliance_obligation(v_company, v_rule, 'annual_accounts_filing', v_label,
          (v_end + make_interval(months => (v_rule.parameters->>'months_after_year_end_max')::integer))::date,
          v_rule.parameters->>'label_en', v_rule.parameters->>'label_fr', jsonb_build_object('year_end', v_end));
      end if;
    end if;
  end if;

  -- Direct tax returns ---------------------------------------------------------
  if v_is_independent then
    v_rule := app_private.active_compliance_rule('model_100', make_date(p_fiscal_year, 12, 31));
    if v_rule.id is not null then
      v_count := v_count + app_private.upsert_compliance_obligation(v_company, v_rule, 'model_100', v_label,
        make_date(p_fiscal_year + (v_rule.parameters->>'year_offset')::integer, 12, 31),
        v_rule.parameters->>'label_en', v_rule.parameters->>'label_fr', jsonb_build_object('tax_year', p_fiscal_year));
    end if;
  else
    v_rule := app_private.active_compliance_rule('model_500', make_date(v_tax_year, 12, 31));
    if v_rule.id is not null and v_company.legal_form in (select jsonb_array_elements_text(v_rule.parameters->'legal_forms')) then
      v_count := v_count + app_private.upsert_compliance_obligation(v_company, v_rule, 'model_500', v_label,
        make_date(v_tax_year + (v_rule.parameters->>'year_offset')::integer, 12, 31),
        v_rule.parameters->>'label_en', v_rule.parameters->>'label_fr', jsonb_build_object('tax_year', v_tax_year));
    end if;
  end if;

  -- Quarterly tax advances (only when fixed by the ACD) ------------------------
  if v_company.tax_advances_assessed then
    v_rule := app_private.active_compliance_rule('tax_advances_income', make_date(p_fiscal_year, 12, 31));
    if v_rule.id is not null then
      v_i := 0;
      for v_date in select jsonb_array_elements_text(v_rule.parameters->'dates') loop
        v_i := v_i + 1;
        v_count := v_count + app_private.upsert_compliance_obligation(v_company, v_rule, 'tax_advances_income_q' || v_i, p_fiscal_year::text || ' Q' || v_i,
          (p_fiscal_year::text || '-' || v_date)::date,
          case when v_is_independent then v_rule.parameters->>'label_en_individual' else v_rule.parameters->>'label_en_company' end || ' Q' || v_i,
          case when v_is_independent then v_rule.parameters->>'label_fr_individual' else v_rule.parameters->>'label_fr_company' end || ' T' || v_i);
      end loop;
    end if;

    v_rule := app_private.active_compliance_rule('tax_advances_business', make_date(p_fiscal_year, 12, 31));
    if v_rule.id is not null and (not v_is_independent
        or coalesce(v_profile.activity_category, '') in (select jsonb_array_elements_text(v_rule.parameters->'independent_categories'))) then
      v_i := 0;
      for v_date in select jsonb_array_elements_text(v_rule.parameters->'dates') loop
        v_i := v_i + 1;
        v_count := v_count + app_private.upsert_compliance_obligation(v_company, v_rule, 'tax_advances_business_q' || v_i, p_fiscal_year::text || ' Q' || v_i,
          (p_fiscal_year::text || '-' || v_date)::date,
          (v_rule.parameters->>'label_en') || ' Q' || v_i, (v_rule.parameters->>'label_fr') || ' T' || v_i);
      end loop;
    end if;

    if not v_is_independent then
      v_rule := app_private.active_compliance_rule('tax_advances_wealth', make_date(p_fiscal_year, 12, 31));
      if v_rule.id is not null then
        v_i := 0;
        for v_date in select jsonb_array_elements_text(v_rule.parameters->'dates') loop
          v_i := v_i + 1;
          v_count := v_count + app_private.upsert_compliance_obligation(v_company, v_rule, 'tax_advances_wealth_q' || v_i, p_fiscal_year::text || ' Q' || v_i,
            (p_fiscal_year::text || '-' || v_date)::date,
            (v_rule.parameters->>'label_en') || ' Q' || v_i, (v_rule.parameters->>'label_fr') || ' T' || v_i);
        end loop;
      end if;
    end if;
  end if;

  -- VAT returns (calendar periods) -------------------------------------------
  if v_company.vat_registered and v_company.vat_filing_frequency is not null then
    v_rule := app_private.active_compliance_rule('vat_periodic', make_date(p_fiscal_year, 12, 31));
    if v_rule.id is not null and v_company.vat_filing_frequency = 'quarterly' then
      for v_i in 1..4 loop
        v_period_start := make_date(p_fiscal_year, 1 + (v_i - 1) * 3, 1);
        v_count := v_count + app_private.upsert_compliance_obligation(v_company, v_rule, 'vat_quarterly_q' || v_i, p_fiscal_year::text || ' Q' || v_i,
          app_private.day_before((v_period_start + interval '3 months')::date + ((v_rule.parameters->>'before_day')::integer - 1)),
          v_rule.parameters->>'label_en_quarterly', v_rule.parameters->>'label_fr_quarterly', jsonb_build_object('frequency', 'quarterly'));
      end loop;
    elsif v_rule.id is not null and v_company.vat_filing_frequency = 'monthly' then
      for v_i in 1..12 loop
        v_period_start := make_date(p_fiscal_year, v_i, 1);
        v_count := v_count + app_private.upsert_compliance_obligation(v_company, v_rule, 'vat_month_' || lpad(v_i::text, 2, '0'), to_char(v_period_start, 'YYYY-MM'),
          app_private.day_before((v_period_start + interval '1 month')::date + ((v_rule.parameters->>'before_day')::integer - 1)),
          v_rule.parameters->>'label_en_monthly', v_rule.parameters->>'label_fr_monthly', jsonb_build_object('frequency', 'monthly'));
      end loop;
    end if;

    v_rule := app_private.active_compliance_rule('vat_annual', make_date(p_fiscal_year, 12, 31));
    if v_rule.id is not null then
      v_count := v_count + app_private.upsert_compliance_obligation(v_company, v_rule, 'vat_annual', v_label,
        app_private.day_before(((p_fiscal_year + 1)::text || '-' ||
          case when v_company.vat_filing_frequency = 'annual' then v_rule.parameters->>'annual_only_before' else v_rule.parameters->>'periodic_filers_before' end)::date),
        v_rule.parameters->>'label_en', v_rule.parameters->>'label_fr', jsonb_build_object('frequency', v_company.vat_filing_frequency));
    end if;

    -- EU recapitulative statements: one per period with EU B2B supplies -------
    v_rule := app_private.active_compliance_rule('eu_recap', make_date(p_fiscal_year, 12, 31));
    if v_rule.id is not null then
      for v_i in 1..(case when v_company.eu_recap_frequency = 'quarterly' then 4 else 12 end) loop
        if v_company.eu_recap_frequency = 'quarterly' then
          v_period_start := make_date(p_fiscal_year, 1 + (v_i - 1) * 3, 1);
          v_period_end := (v_period_start + interval '3 months - 1 day')::date;
        else
          v_period_start := make_date(p_fiscal_year, v_i, 1);
          v_period_end := (v_period_start + interval '1 month - 1 day')::date;
        end if;
        select exists (
          select 1 from public.sales_invoices si
          where si.company_id = v_company.id and si.status = 'issued' and si.vat_treatment = 'eu_b2b_reverse_charge'
            and si.service_date between v_period_start and v_period_end
          union all
          select 1 from public.source_transactions st
          where st.company_id = v_company.id and st.direction = 'income' and st.vat_treatment = 'eu_b2b_reverse_charge'
            and st.classification_status = 'posted' and st.occurred_on between v_period_start and v_period_end
        ) into v_has_eu;
        if v_has_eu then
          v_count := v_count + app_private.upsert_compliance_obligation(v_company, v_rule,
            'eu_recap_' || case when v_company.eu_recap_frequency = 'quarterly' then 'q' || v_i else lpad(v_i::text, 2, '0') end,
            case when v_company.eu_recap_frequency = 'quarterly' then p_fiscal_year::text || ' Q' || v_i else to_char(v_period_start, 'YYYY-MM') end,
            app_private.day_before((v_period_end + 1) + ((v_rule.parameters->>'before_day')::integer - 1)),
            v_rule.parameters->>'label_en', v_rule.parameters->>'label_fr', jsonb_build_object('frequency', v_company.eu_recap_frequency));
        end if;
      end loop;
    end if;
  end if;

  return v_count;
end;
$function$;

-- Move existing VAT deadlines generated by version 2026.1 to the last compliant day.
update public.compliance_obligations
set due_date = due_date - 1, updated_at = now()
where status not in ('filed','paid','not_applicable')
  and (
    ((rule_key like 'vat_month_%' or rule_key like 'vat_quarterly_q%') and extract(day from due_date) = 15)
    or (rule_key = 'vat_annual' and to_char(due_date, 'MM-DD') in ('03-01','05-01'))
  );
