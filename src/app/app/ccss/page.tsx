import {
  Activity,
  BadgeEuro,
  CalendarClock,
  CircleDollarSign,
  ExternalLink,
  FileCheck2,
  HeartPulse,
  Landmark,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  Umbrella,
  WalletCards,
} from "lucide-react";
import { redirect } from "next/navigation";
import { CcssConfigurator } from "@/components/ccss-configurator";
import { DataPanel, DataPanelHeader, DataSummary } from "@/components/zuelen-data-ui-v2";
import { PageHeader, StatusBadge, V2Page } from "@/components/zuelen-ui-v2";
import { calculateAnnualCcss } from "@/lib/ccss/calculator";
import type { CcssParameterPeriod, CcssSituation, ContributionKey, MdeClass } from "@/lib/ccss/types";
import { getActiveFiscalYear } from "@/lib/fiscal-year";
import { intlLocale, normalizeLocale, type Locale } from "@/lib/i18n";
import { deriveResidentTaxClass, resolveDisplayedTaxClass, type PersonalFiscalFacts } from "@/lib/personal-fiscal/tax-class";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import styles from "./ccss.module.css";

export const dynamic = "force-dynamic";

const componentIcons = { health: HeartPulse, sicknessCash: Umbrella, pension: Landmark, dependency: ShieldCheck, accident: Activity, mde: Stethoscope };

function asExact(value: string | number | null | undefined, fallback = "0") {
  return value === null || value === undefined ? fallback : String(value);
}

function moneyFromCents(value: number, locale: Locale) {
  return new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(value / 100);
}

function money(value: string | number, locale: Locale) {
  return new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(Number(value));
}

function mapParameter(row: Record<string, unknown>): CcssParameterPeriod {
  return {
    id: String(row.id), effectiveFrom: String(row.effective_from), effectiveTo: row.effective_to ? String(row.effective_to) : null,
    ssm: asExact(row.ssm as string | number), secondaryActivityMinimum: asExact(row.secondary_activity_minimum as string | number),
    maximumContributionBase: asExact(row.maximum_contribution_base as string | number), assistingSpouseMaximum: asExact(row.assisting_spouse_maximum as string | number),
    dependencyAllowance: asExact(row.dependency_allowance as string | number), healthRate: asExact(row.health_rate as string | number),
    sicknessCashBenefitRate: asExact(row.sickness_cash_benefit_rate as string | number), pensionRate: asExact(row.pension_rate as string | number),
    dependencyRate: asExact(row.dependency_rate as string | number), accidentBaseRate: asExact(row.accident_base_rate as string | number),
    mdeClass1Rate: asExact(row.mde_class_1_rate as string | number), mdeClass2Rate: asExact(row.mde_class_2_rate as string | number),
    mdeClass3Rate: asExact(row.mde_class_3_rate as string | number), mdeClass4Rate: asExact(row.mde_class_4_rate as string | number),
    sourceAuthority: String(row.source_authority), sourceReference: String(row.source_reference), verifiedAt: String(row.verified_at),
  };
}

function addDays(date: string, days: number) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function civilStatusLabel(value: string, fr: boolean) {
  const labels: Record<string, [string, string]> = {
    single: ["Single", "Célibataire"], married: ["Married", "Marié(e)"], registered_partnership: ["Registered partnership", "Partenariat enregistré"],
    divorced: ["Divorced", "Divorcé(e)"], separated: ["Legally separated", "Séparé(e) légalement"], widowed: ["Widowed", "Veuf / veuve"],
  };
  return labels[value]?.[fr ? 1 : 0] ?? value;
}

function statusLabel(value: string, fr: boolean) {
  const labels: Record<string, [string, string]> = {
    provisional: ["Provisional", "Provisoire"], user_confirmed: ["Confirmed", "Confirmé"], final_acd: ["Final / ACD-confirmed", "Définitif / confirmé ACD"],
    unpaid: ["Unpaid", "À payer"], paid: ["Paid", "Payé"], disputed: ["Verify", "À vérifier"],
    principal: ["Principal activity", "Activité principale"], secondary: ["Accessory activity", "Activité accessoire"], manager: ["Company manager/director", "Dirigeant de société"],
    manual: ["Manual confirmation", "Confirmation manuelle"], accounting_proxy: ["Accounting net-profit proxy", "Indicateur de bénéfice net comptable"], manager_remuneration: ["Manager remuneration", "Rémunération de dirigeant"], acd_final: ["ACD final income", "Revenu définitif ACD"],
    not_requested: ["Not requested", "Non demandé(e)"], requested: ["Requested — assumption", "Demandé(e) — hypothèse"], approved: ["Approved", "Approuvé(e)"],
    joint: ["Joint / collective", "Collective"], individual: ["Individual", "Individuelle"], individual_reallocation: ["Individual with reallocation", "Individuelle avec réallocation"], not_applicable: ["Not applicable", "Non applicable"], needs_confirmation: ["Needs confirmation", "À confirmer"],
  };
  return labels[value]?.[fr ? 1 : 0] ?? value.replaceAll("_", " ");
}

function taxReasonLabel(value: string | null, fr: boolean) {
  const labels: Record<string, [string, string]> = {
    qualifying_child: ["Qualifying child", "Enfant ouvrant droit à la modération"], age_64: ["Age 64+", "Âge de 64 ans ou plus"], resident_default: ["Resident default", "Règle générale des résidents"],
    married_joint_taxation: ["Married, joint taxation", "Mariage, imposition collective"], married_individual_class_1_framework: ["Married, individual class 1 framework", "Mariage, régime individuel de classe 1"],
    partners_joint_assessment_full_year: ["Eligible partners, joint assessment", "Partenaires admissibles, imposition collective"], transitional_class_2: ["Transitional class 2 rule", "Règle transitoire de classe 2"],
    widowed_class_1a: ["Widowhood class 1a rule", "Règle de classe 1a pour veuvage"], non_resident_requires_acd_confirmation: ["ACD confirmation required", "Confirmation ACD requise"],
    civil_status_event_date_required: ["Event date required", "Date de l’événement requise"], married_taxation_mode_required: ["Taxation mode required", "Mode d’imposition requis"],
  };
  return value ? labels[value]?.[fr ? 1 : 0] ?? (fr ? "Confirmation requise" : "Confirmation required") : "—";
}

export default async function CcssPage() {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in");
  if (!workspace.company || !workspace.userId) redirect("/setup");
  const locale = normalizeLocale(workspace.profile?.locale);
  const fr = locale === "fr";
  const l = (en: string, french: string) => fr ? french : en;
  const year = await getActiveFiscalYear(workspace.company.fiscal_year_start_month);
  const supabase = await createClient();
  const [fiscalResult, profileResult, parameterResult, statementResult, documentResult] = await Promise.all([
    supabase.from("personal_fiscal_profiles").select("*").eq("user_id", workspace.userId).eq("tax_year", year).maybeSingle(),
    supabase.from("ccss_profiles").select("*").eq("user_id", workspace.userId).eq("tax_year", year).maybeSingle(),
    supabase.from("ccss_parameter_periods").select("*").lte("effective_from", `${year}-12-31`).or(`effective_to.is.null,effective_to.gte.${year}-01-01`).order("effective_from", { ascending: true }),
    supabase.from("ccss_statements").select("id,contribution_month,statement_issue_date,amount_due,due_date,payment_status,paid_date,source_document_id").eq("user_id", workspace.userId).eq("company_id", workspace.company.id).gte("contribution_month", `${year}-01-01`).lte("contribution_month", `${year}-12-01`).order("due_date", { ascending: true }),
    supabase.from("documents").select("id,file_name").eq("company_id", workspace.company.id).order("created_at", { ascending: false }).limit(40),
  ]);
  const firstError = fiscalResult.error ?? profileResult.error ?? parameterResult.error ?? statementResult.error ?? documentResult.error;
  if (firstError) throw new Error(`${l("Could not load the CCSS workspace", "Impossible de charger l’espace CCSS")}: ${firstError.message}`);

  const fiscalProfile = fiscalResult.data;
  const ccssProfile = profileResult.data;
  const parameters = (parameterResult.data ?? []).map((row) => mapParameter(row as Record<string, unknown>));
  const statements = statementResult.data ?? [];
  const documents = documentResult.data ?? [];
  let projection: ReturnType<typeof calculateAnnualCcss> | null = null;
  let projectionError: string | null = null;
  if (ccssProfile && parameters.length) {
    const situation: CcssSituation = {
      affiliationType: ccssProfile.affiliation_type as CcssSituation["affiliationType"],
      activityLegalForm: ccssProfile.activity_legal_form as CcssSituation["activityLegalForm"],
      incomeStatus: ccssProfile.income_status as CcssSituation["incomeStatus"],
      incomeSource: ccssProfile.income_source as CcssSituation["incomeSource"],
      aaaFactor: asExact(ccssProfile.aaa_factor),
      mdeClass: ccssProfile.mde_membership === "affiliated" ? ccssProfile.mde_class as MdeClass : null,
      pensionReductionStatus: ccssProfile.pension_reduction_status as CcssSituation["pensionReductionStatus"],
      insignificantIncomeExemptionStatus: ccssProfile.insignificant_income_exemption_status as CcssSituation["insignificantIncomeExemptionStatus"],
      assistingSpouse: {
        enabled: ccssProfile.assisting_spouse_enabled,
        qualifyingRelationship: ccssProfile.assisting_spouse_qualifying_relationship,
        mainActivity: ccssProfile.assisting_spouse_main_activity,
      },
    };
    try {
      projection = calculateAnnualCcss({ year, annualProfessionalIncome: asExact(ccssProfile.estimated_annual_professional_income), affiliationStartDate: ccssProfile.affiliation_start_date, situation, parameterPeriods: parameters });
    } catch (error) {
      projectionError = error instanceof Error ? error.message : l("The projection could not be calculated.", "La projection n’a pas pu être calculée.");
    }
  }

  const monthIndex = year === new Date().getFullYear() ? new Date().getMonth() : 11;
  const current = projection?.months[monthIndex] ?? null;
  const openStatement = statements.find((statement) => statement.payment_status !== "paid") ?? null;
  const currentParameter = parameters.find((parameter) => parameter.effectiveFrom <= `${year}-${String(monthIndex + 1).padStart(2, "0")}-01` && (!parameter.effectiveTo || parameter.effectiveTo >= `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`)) ?? parameters.at(-1) ?? null;
  const monthlyIncomeCents = projection?.monthlyProfessionalIncomeCents ?? 0;
  const maximumMonth = Math.max(...(projection?.months.map((month) => month.combinedTotalCents) ?? [1]), 1);
  const dateLocale = intlLocale(locale);

  let taxClass: ReturnType<typeof resolveDisplayedTaxClass> | null = null;
  let taxReason: string | null = null;
  if (fiscalProfile) {
    const facts: PersonalFiscalFacts = {
      taxYear: fiscalProfile.tax_year,
      residencyStatus: fiscalProfile.residency_status as PersonalFiscalFacts["residencyStatus"],
      civilStatus: fiscalProfile.civil_status as PersonalFiscalFacts["civilStatus"],
      civilStatusEventDate: fiscalProfile.civil_status_event_date,
      qualifyingChildrenCount: fiscalProfile.qualifying_children_count,
      age64AtYearStart: fiscalProfile.age_64_at_year_start,
      taxationMode: fiscalProfile.taxation_mode as PersonalFiscalFacts["taxationMode"],
      partnershipFullYearConditionsMet: fiscalProfile.partnership_full_year_conditions_met,
      legallyRecognizedSeparation: fiscalProfile.legally_recognized_separation,
      transitionalClass2UsedInPriorFiveYears: fiscalProfile.transitional_class_2_used_in_prior_five_years,
    };
    const derived = deriveResidentTaxClass(facts);
    taxClass = resolveDisplayedTaxClass({ derived, manualOverride: fiscalProfile.manual_tax_class_override, acdTaxRatePercent: fiscalProfile.acd_tax_rate_percent === null ? null : asExact(fiscalProfile.acd_tax_rate_percent) });
    taxReason = derived.reason;
  }

  const breakdownLabels: Record<ContributionKey, [string, string]> = {
    health: ["Health / maternity", "Maladie-maternité"], sicknessCash: ["Cash sickness benefits", "Prestations en espèces"], pension: ["Pension", "Pension"],
    dependency: ["Dependency", "Dépendance"], accident: ["Accident", "Accident"], mde: ["MDE", "MDE"],
  };
  const keys: ContributionKey[] = ["health", "sicknessCash", "pension", "dependency", "accident", "mde"];
  const sourcePeriod = current ? `${new Date(`${current.parameterEffectiveFrom}T12:00:00`).toLocaleDateString(dateLocale)} – ${current.parameterEffectiveTo ? new Date(`${current.parameterEffectiveTo}T12:00:00`).toLocaleDateString(dateLocale) : "∞"}` : "—";

  return <V2Page className={styles.page}>
    <PageHeader
      eyebrow={`CCSS · ${year}`}
      title={l("Know what to set aside for social security.", "Sachez combien mettre de côté pour votre sécurité sociale.")}
      description={l("A month-by-month Luxembourg estimate built from professional income, verified CCSS parameters and your affiliation situation.", "Une estimation luxembourgeoise mois par mois, fondée sur le revenu professionnel, les paramètres CCSS vérifiés et votre situation d’affiliation.")}
      meta={<CcssConfigurator year={year} locale={locale} fiscalProfile={fiscalProfile} ccssProfile={ccssProfile} defaultLegalForm={/sarl|s\.à r\.l|sa|s\.a\./i.test(workspace.company.legal_form) ? "company" : "own_name"} documents={documents}/>} 
    />

    {openStatement ? <section className={styles.actualBanner}><div className={styles.actualIcon}><FileCheck2 size={19}/></div><div><span>{l("From CCSS statement", "Depuis l’extrait CCSS")}</span><strong>{money(openStatement.amount_due, locale)}</strong><small>{l("Payment deadline", "Échéance de paiement")} · {new Date(`${openStatement.due_date}T12:00:00`).toLocaleDateString(dateLocale, { day: "2-digit", month: "long", year: "numeric" })}</small></div><StatusBadge tone={openStatement.payment_status === "disputed" ? "warning" : "danger"}>{statusLabel(openStatement.payment_status, fr)}</StatusBadge></section> : null}

    <DataSummary label={l("CCSS estimate summary", "Résumé de l’estimation CCSS")} items={[
      { label: l("Current monthly estimate", "Estimation mensuelle actuelle"), value: current ? moneyFromCents(current.combinedTotalCents, locale) : "—", description: l("Zuelen estimate", "Estimation Zuelen"), icon: WalletCards, tone: current ? "info" : "neutral" },
      { label: l("Projected full year", "Projection annuelle"), value: projection ? moneyFromCents(projection.totalCents, locale) : "—", description: l("Calculated month by month", "Calculée mois par mois"), icon: TrendingUp, tone: projection ? "neutral" : "warning" },
      { label: l("Professional income used", "Revenu professionnel utilisé"), value: projection ? moneyFromCents(monthlyIncomeCents, locale) : "—", description: l("Monthly input — not turnover", "Entrée mensuelle — pas le chiffre d’affaires"), icon: CircleDollarSign, tone: projection ? "success" : "warning" },
      { label: l("Next actual deadline", "Prochaine échéance réelle"), value: openStatement ? new Date(`${openStatement.due_date}T12:00:00`).toLocaleDateString(dateLocale, { day: "2-digit", month: "short" }) : "—", description: openStatement ? l("From CCSS statement", "Depuis l’extrait CCSS") : l("No recorded statement", "Aucun extrait enregistré"), icon: CalendarClock, tone: openStatement ? "warning" : "neutral" },
    ]}/>

    {projectionError ? <div className={styles.error}>{projectionError}</div> : null}
    {!ccssProfile ? <section className={styles.empty}><span><BadgeEuro size={25}/></span><div><h2>{l("Confirm your professional situation to start the estimate.", "Confirmez votre situation professionnelle pour démarrer l’estimation.")}</h2><p>{l("Zuelen will not infer CCSS income from company turnover or corporate profit. Configure a safe, confirmed professional-income source first.", "Zuelen ne déduira pas le revenu CCSS du chiffre d’affaires ni du bénéfice de la société. Configurez d’abord une source de revenu professionnel sûre et confirmée.")}</p></div></section> : null}

    {current && projection ? <>
      <section className={styles.primaryGrid}>
        <DataPanel className={styles.breakdownPanel}>
          <DataPanelHeader eyebrow={l("Zuelen estimate", "Estimation Zuelen")} title={l("Current contribution breakdown", "Détail des cotisations actuelles")} meta={current.assistingSpouse ? l("Principal + assisting spouse estimate", "Estimation principal + conjoint aidant") : undefined}/>
          <div className={styles.breakdown}>
            {keys.filter((key) => key !== "mde" || current.principal.components.mde.amountCents > 0 || (current.assistingSpouse?.components.mde.amountCents ?? 0) > 0).map((key) => {
              const Icon = componentIcons[key];
              const principalComponent = current.principal.components[key];
              const spouseComponent = current.assistingSpouse?.components[key];
              const amountCents = principalComponent.amountCents + (spouseComponent?.amountCents ?? 0);
              const baseCents = principalComponent.baseCents + (spouseComponent?.baseCents ?? 0);
              const effectiveRate = key === "accident" ? `${principalComponent.rate}% × ${principalComponent.factor}` : `${principalComponent.rate}%`;
              return <div className={styles.breakdownRow} key={key}><span className={styles.riskIcon}><Icon size={16}/></span><div><strong>{breakdownLabels[key][fr ? 1 : 0]}</strong><small>{moneyFromCents(baseCents, locale)} × {effectiveRate}</small></div><b>{moneyFromCents(amountCents, locale)}</b></div>;
            })}
            <div className={styles.breakdownTotal}><span>{l("Estimated total", "Total estimé")}</span><strong>{moneyFromCents(current.combinedTotalCents, locale)}</strong></div>
          </div>
        </DataPanel>

        <DataPanel className={styles.projectionPanel}>
          <DataPanelHeader eyebrow={`${year} · ${l("month by month", "mois par mois")}`} title={l("Annual projection", "Projection annuelle")} meta={moneyFromCents(projection.totalCents, locale)}/>
          <div className={styles.chart} aria-label={l("Estimated monthly CCSS contributions", "Cotisations CCSS mensuelles estimées")}>
            {projection.months.map((month) => {
              const change = projection.parameterChanges.includes(month.month);
              const label = new Date(`${month.month}T12:00:00`).toLocaleDateString(dateLocale, { month: "short" });
              return <div className={`${styles.chartMonth} ${change ? styles.parameterChange : ""}`} key={month.month} title={`${label}: ${moneyFromCents(month.combinedTotalCents, locale)}`}><div className={styles.barTrack}><i style={{ height: `${month.inactive ? 0 : Math.max(7, month.combinedTotalCents / maximumMonth * 100)}%` }}/></div><span>{label}</span>{change ? <em>{l("Index", "Indice")}</em> : null}</div>;
            })}
          </div>
          <div className={styles.indexation}><Activity size={15}/><div><strong>{l("June 2026 indexation is applied", "L’indexation de juin 2026 est appliquée")}</strong><span>{l("Jan–May use the €2,703.74 SSM; Jun–Dec use €2,771.33. Historic months are not overwritten.", "Janv.–mai utilisent le SSM de 2 703,74 € ; juin–déc. celui de 2 771,33 €. Les mois historiques ne sont pas écrasés.")}</span></div></div>
        </DataPanel>
      </section>

      <section className={styles.detailGrid}>
        <DataPanel>
          <DataPanelHeader eyebrow={l("Assumption", "Hypothèse")} title={l("How CCSS sees your income", "Comment le CCSS voit votre revenu")}/>
          <dl className={styles.factList}>
            <div><dt>{l("Professional income", "Revenu professionnel")}</dt><dd>{money(ccssProfile.estimated_annual_professional_income, locale)} / {l("year", "an")}</dd></div>
            <div><dt>{l("Source", "Source")}</dt><dd>{statusLabel(ccssProfile.income_source, fr)}</dd></div>
            <div><dt>{l("Status", "Statut")}</dt><dd><StatusBadge tone={ccssProfile.income_status === "final_acd" ? "success" : ccssProfile.income_status === "user_confirmed" ? "info" : "warning"}>{statusLabel(ccssProfile.income_status, fr)}</StatusBadge></dd></div>
            <div><dt>{l("Affiliation", "Affiliation")}</dt><dd>{statusLabel(ccssProfile.affiliation_type, fr)}</dd></div>
            <div><dt>{l("Ordinary minimum", "Minimum ordinaire")}</dt><dd>{current.principal.minimumBinding === "ssm" ? l("SSM minimum is binding", "Le minimum SSM s’applique") : current.principal.minimumBinding === "one_third_ssm" ? l("⅓ SSM minimum is binding", "Le minimum de ⅓ SSM s’applique") : l("Actual income is used", "Le revenu réel est utilisé")}</dd></div>
            <div><dt>{l("Maximum", "Maximum")}</dt><dd>{current.principal.maximumBinding ? l("5 × SSM cap is binding for ordinary risks", "Le plafond de 5 × SSM s’applique aux risques ordinaires") : l("Not binding", "Non applicable")}</dd></div>
            <div><dt>{l("Pension reduction", "Réduction pension")}</dt><dd>{statusLabel(ccssProfile.pension_reduction_status, fr)}</dd></div>
            <div><dt>{l("Income exemption", "Dispense de revenu")}</dt><dd>{statusLabel(ccssProfile.insignificant_income_exemption_status, fr)}</dd></div>
          </dl>
        </DataPanel>

        <DataPanel>
          <DataPanelHeader eyebrow={l("Context only", "Contexte uniquement")} title={l("Personal tax situation", "Situation fiscale personnelle")}/>
          {fiscalProfile ? <>
            <div className={styles.taxClass}><div><span>{l("Derived / confirmed tax class", "Classe d’impôt déterminée / confirmée")}</span><strong>{taxClass?.source === "acd_rate" ? `${taxClass.value}%` : taxClass?.value === "needs_confirmation" ? l("Needs confirmation", "À confirmer") : taxClass?.value}</strong></div><StatusBadge tone={taxClass?.source === "derived" && taxClass.value === "needs_confirmation" ? "warning" : "info"}>{taxClass?.source === "derived" ? l("Derived", "Déterminée") : l("Confirmed", "Confirmée")}</StatusBadge></div>
            <dl className={styles.factList}><div><dt>{l("Civil status", "État civil")}</dt><dd>{civilStatusLabel(fiscalProfile.civil_status, fr)}</dd></div><div><dt>{l("Taxation mode", "Mode d’imposition")}</dt><dd>{statusLabel(fiscalProfile.taxation_mode, fr)}</dd></div><div><dt>{l("Tax residency", "Résidence fiscale")}</dt><dd>{fiscalProfile.residency_status === "resident" ? l("Resident", "Résident") : l("Non-resident", "Non-résident")}</dd></div><div><dt>{l("Derivation", "Détermination")}</dt><dd>{taxReasonLabel(taxReason, fr)}</dd></div></dl>
          </> : <p className={styles.muted}>{l("No personal fiscal profile confirmed for this year.", "Aucun profil fiscal personnel confirmé pour cette année.")}</p>}
          <div className={styles.taxNote}><ShieldCheck size={16}/><span>{l("Your tax class is used for personal income-tax planning. It does not change your CCSS contribution estimate.", "Votre classe d’impôt sert à planifier l’impôt sur le revenu des personnes physiques. Elle ne modifie pas votre estimation des cotisations CCSS.")}</span></div>
        </DataPanel>
      </section>

      <DataPanel className={styles.assumptionsPanel}>
        <DataPanelHeader eyebrow={l("Regulatory source", "Source réglementaire")} title={l("Assumptions and verification", "Hypothèses et vérification")} meta={<a href={currentParameter?.sourceReference} target="_blank" rel="noreferrer">CCSS <ExternalLink size={11}/></a>}/>
        <div className={styles.assumptionGrid}>
          <div><span>{l("Parameter period", "Période des paramètres")}</span><strong>{sourcePeriod}</strong></div>
          <div><span>{l("Last verified", "Dernière vérification")}</span><strong>{currentParameter ? new Date(currentParameter.verifiedAt).toLocaleDateString(dateLocale) : "—"}</strong></div>
          <div><span>{l("AAA factor", "Facteur AAA")}</span><strong>{asExact(ccssProfile.aaa_factor)}</strong></div>
          <div><span>MDE</span><strong>{ccssProfile.mde_membership === "affiliated" ? `${l("Class", "Classe")} ${ccssProfile.mde_class}` : l("Not affiliated", "Non affilié")}</strong></div>
          <div><span>{l("Income status", "Statut du revenu")}</span><strong>{statusLabel(ccssProfile.income_status, fr)}</strong></div>
          <div><span>{l("Semantic state", "État sémantique")}</span><strong>{l("Estimate — not an invoice", "Estimation — pas une facture")}</strong></div>
        </div>
      </DataPanel>
    </> : null}

    <DataPanel className={styles.statementsPanel}>
      <DataPanelHeader eyebrow={l("Actual evidence", "Justificatifs réels")} title={l("CCSS statements", "Extraits CCSS")} meta={`${statements.length} · ${year}`}/>
      {statements.length ? <div className={styles.statementList}>{statements.map((statement) => <div className={styles.statementRow} key={statement.id}><div><span>{new Date(`${statement.contribution_month}T12:00:00`).toLocaleDateString(dateLocale, { month: "long", year: "numeric" })}</span><strong>{money(statement.amount_due, locale)}</strong><small>{l("Issued", "Émis")} {new Date(`${statement.statement_issue_date}T12:00:00`).toLocaleDateString(dateLocale)} · {l("due", "échéance")} {new Date(`${statement.due_date}T12:00:00`).toLocaleDateString(dateLocale)}</small></div><StatusBadge tone={statement.payment_status === "paid" ? "success" : statement.payment_status === "disputed" ? "warning" : "danger"}>{l("From CCSS statement", "Depuis l’extrait CCSS")} · {statusLabel(statement.payment_status, fr)}</StatusBadge></div>)}</div> : <div className={styles.statementEmpty}><FileCheck2 size={20}/><span>{l("No actual CCSS statement recorded yet. Estimates remain clearly separate from official amounts due.", "Aucun extrait CCSS réel n’est encore enregistré. Les estimations restent clairement séparées des montants officiels dus.")}</span></div>}
    </DataPanel>

    {ccssProfile ? <div className={styles.deadlineHint}><CalendarClock size={15}/><span>{l("Initial affiliation is due no later than 8 days after activity starts", "L’affiliation initiale doit être effectuée au plus tard 8 jours après le début de l’activité")} · {new Date(`${addDays(ccssProfile.affiliation_start_date, 8)}T12:00:00`).toLocaleDateString(dateLocale)}</span></div> : null}
    <div className={styles.disclaimer}><ShieldCheck size={15}/><span>{l("Zuelen estimates your contributions from the information available. CCSS may recalculate contributions when your definitive professional income is communicated by the tax administration.", "Zuelen estime vos cotisations à partir des informations disponibles. Le CCSS peut les recalculer lorsque votre revenu professionnel définitif lui est communiqué par l’administration fiscale.")}</span></div>
  </V2Page>;
}
