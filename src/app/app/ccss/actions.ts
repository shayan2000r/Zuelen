"use server";

import { revalidatePath } from "next/cache";
import { deriveResidentTaxClass, type CivilStatus, type FiscalResidency, type TaxationMode } from "@/lib/personal-fiscal/tax-class";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export type CcssActionState = { status: "idle" | "success" | "error"; message: string };

const residencyValues = new Set(["resident", "non_resident"]);
const civilStatusValues = new Set(["single", "married", "registered_partnership", "divorced", "separated", "widowed"]);
const taxationModeValues = new Set(["joint", "individual", "individual_reallocation", "not_applicable", "needs_confirmation"]);
const affiliationValues = new Set(["principal", "secondary", "manager"]);
const legalFormValues = new Set(["own_name", "company"]);
const incomeStatusValues = new Set(["provisional", "user_confirmed", "final_acd"]);
const incomeSourceValues = new Set(["manual", "accounting_proxy", "manager_remuneration", "acd_final"]);
const reliefValues = new Set(["not_requested", "requested", "approved"]);

function localized(workspace: Awaited<ReturnType<typeof getWorkspace>>, en: string, fr: string) {
  return workspace.profile?.locale === "fr" ? fr : en;
}

function refresh() {
  revalidatePath("/app/ccss");
  revalidatePath("/app/compliance");
  revalidatePath("/app/taxes");
}

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on" || formData.get(name) === "true";
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function validMoney(value: string) {
  return /^\d{1,11}(?:\.\d{1,2})?$/.test(value) && Number(value) >= 0;
}

function validPercent(value: string) {
  return /^\d{1,3}(?:\.\d{1,4})?$/.test(value) && Number(value) >= 0 && Number(value) <= 100;
}

export async function saveCcssConfiguration(_previous: CcssActionState, formData: FormData): Promise<CcssActionState> {
  const workspace = await getWorkspace();
  if (!workspace.authenticated || !workspace.userId || !workspace.company) {
    return { status: "error", message: localized(workspace, "Your session expired. Please sign in again.", "Votre session a expiré. Veuillez vous reconnecter.") };
  }

  const taxYear = Number(text(formData, "tax_year"));
  const residencyStatus = text(formData, "residency_status");
  const civilStatus = text(formData, "civil_status");
  const taxationMode = text(formData, "taxation_mode");
  const civilStatusEventDate = text(formData, "civil_status_event_date") || null;
  const qualifyingChildrenCount = Number(text(formData, "qualifying_children_count") || "0");
  const affiliationType = text(formData, "affiliation_type");
  const activityLegalForm = text(formData, "activity_legal_form");
  const affiliationStartDate = text(formData, "affiliation_start_date");
  const annualIncome = text(formData, "estimated_annual_professional_income");
  const incomeStatus = text(formData, "income_status");
  const incomeSource = text(formData, "income_source");
  const aaaFactor = text(formData, "aaa_factor");
  const mdeMembership = text(formData, "mde_membership");
  const mdeClassRaw = text(formData, "mde_class");
  const pensionReductionStatus = text(formData, "pension_reduction_status");
  const exemptionStatus = text(formData, "insignificant_income_exemption_status");
  const manualOverrideRaw = text(formData, "manual_tax_class_override");
  const acdRateRaw = text(formData, "acd_tax_rate_percent");
  const overrideSource = text(formData, "override_source");
  const overrideReason = text(formData, "override_reason");

  if (!Number.isInteger(taxYear) || taxYear < 2000 || taxYear > 2100
      || !residencyValues.has(residencyStatus) || !civilStatusValues.has(civilStatus) || !taxationModeValues.has(taxationMode)
      || !Number.isInteger(qualifyingChildrenCount) || qualifyingChildrenCount < 0 || qualifyingChildrenCount > 30
      || !affiliationValues.has(affiliationType) || !legalFormValues.has(activityLegalForm) || !validDate(affiliationStartDate)
      || !validMoney(annualIncome) || !incomeStatusValues.has(incomeStatus) || !incomeSourceValues.has(incomeSource)
      || !/^\d(?:\.\d{1,4})?$/.test(aaaFactor) || Number(aaaFactor) < 0.1 || Number(aaaFactor) > 5
      || !["not_affiliated", "affiliated"].includes(mdeMembership) || !reliefValues.has(pensionReductionStatus) || !reliefValues.has(exemptionStatus)) {
    return { status: "error", message: localized(workspace, "Review the highlighted CCSS and fiscal-profile values.", "Vérifiez les valeurs du profil CCSS et fiscal.") };
  }
  if (civilStatusEventDate && !validDate(civilStatusEventDate)) {
    return { status: "error", message: localized(workspace, "Enter a valid civil-status event date.", "Saisissez une date d’événement d’état civil valide.") };
  }
  if (affiliationType === "manager" && incomeSource === "accounting_proxy" || incomeSource === "accounting_proxy" && activityLegalForm !== "own_name") {
    return { status: "error", message: localized(workspace, "Company turnover or profit cannot be used as a manager’s personal CCSS income.", "Le chiffre d’affaires ou le bénéfice de la société ne peut pas servir de revenu CCSS personnel du dirigeant.") };
  }

  const mdeClass = mdeMembership === "affiliated" ? Number(mdeClassRaw) : null;
  if (mdeMembership === "affiliated" && (![1, 2, 3, 4].includes(mdeClass ?? 0))) {
    return { status: "error", message: localized(workspace, "Confirm the MDE class shown by CCSS.", "Confirmez la classe MDE indiquée par le CCSS.") };
  }
  const manualOverride = manualOverrideRaw ? manualOverrideRaw : null;
  if (manualOverride && !["1", "1a", "2"].includes(manualOverride) || manualOverride && !overrideSource) {
    return { status: "error", message: localized(workspace, "An ACD source is required for a manual tax-class override.", "Une source ACD est requise pour remplacer manuellement la classe d’impôt.") };
  }
  if (acdRateRaw && !validPercent(acdRateRaw)) {
    return { status: "error", message: localized(workspace, "Enter the ACD rate exactly as shown on the tax document.", "Saisissez le taux ACD exactement comme indiqué sur le document fiscal.") };
  }

  const assistingEnabled = checked(formData, "assisting_spouse_enabled");
  const qualifyingRelationship = civilStatus === "married" || civilStatus === "registered_partnership";
  const spouseMainActivity = checked(formData, "assisting_spouse_main_activity");
  if (assistingEnabled && (!qualifyingRelationship || activityLegalForm !== "own_name" || !spouseMainActivity)) {
    return { status: "error", message: localized(workspace, "Assisting-spouse treatment requires a qualifying relationship, genuine main assistance, and an activity in your own name.", "Le statut de conjoint aidant exige une relation admissible, une aide constituant l’activité principale et une activité exercée en nom propre.") };
  }

  const fiscalFacts = {
    taxYear,
    residencyStatus: residencyStatus as FiscalResidency,
    civilStatus: civilStatus as CivilStatus,
    civilStatusEventDate,
    qualifyingChildrenCount,
    age64AtYearStart: checked(formData, "age_64_at_year_start"),
    taxationMode: taxationMode as TaxationMode,
    partnershipFullYearConditionsMet: checked(formData, "partnership_full_year_conditions_met"),
    legallyRecognizedSeparation: checked(formData, "legally_recognized_separation"),
    transitionalClass2UsedInPriorFiveYears: checked(formData, "transitional_class_2_used_in_prior_five_years"),
  };
  const derivation = deriveResidentTaxClass(fiscalFacts);
  const confirmedAt = new Date().toISOString();
  const supabase = await createClient();
  const fiscalPayload = {
    user_id: workspace.userId,
    tax_year: taxYear,
    residency_status: residencyStatus,
    civil_status: civilStatus,
    civil_status_event_date: civilStatusEventDate,
    qualifying_children_count: qualifyingChildrenCount,
    age_64_at_year_start: fiscalFacts.age64AtYearStart,
    taxation_mode: taxationMode,
    partnership_full_year_conditions_met: fiscalFacts.partnershipFullYearConditionsMet,
    legally_recognized_separation: fiscalFacts.legallyRecognizedSeparation,
    transitional_class_2_used_in_prior_five_years: fiscalFacts.transitionalClass2UsedInPriorFiveYears,
    derived_tax_class: derivation.taxClass,
    derivation_version: "lu-resident-2026-v1",
    manual_tax_class_override: manualOverride,
    acd_tax_rate_percent: acdRateRaw || null,
    override_source: overrideSource || null,
    override_reason: overrideReason || null,
    last_confirmed_at: confirmedAt,
  };
  const ccssPayload = {
    user_id: workspace.userId,
    tax_year: taxYear,
    affiliation_type: affiliationType,
    activity_legal_form: activityLegalForm,
    affiliation_start_date: affiliationStartDate,
    estimated_annual_professional_income: annualIncome,
    income_status: incomeStatus,
    income_source: incomeSource,
    aaa_factor: aaaFactor,
    mde_membership: mdeMembership,
    mde_class: mdeClass,
    pension_reduction_status: pensionReductionStatus,
    insignificant_income_exemption_status: exemptionStatus,
    assisting_spouse_enabled: assistingEnabled,
    assisting_spouse_qualifying_relationship: qualifyingRelationship,
    assisting_spouse_main_activity: spouseMainActivity,
    last_confirmed_at: confirmedAt,
  };
  const [fiscalResult, ccssResult] = await Promise.all([
    supabase.from("personal_fiscal_profiles").upsert(fiscalPayload, { onConflict: "user_id,tax_year" }),
    supabase.from("ccss_profiles").upsert(ccssPayload, { onConflict: "user_id,tax_year" }),
  ]);
  const error = fiscalResult.error ?? ccssResult.error;
  if (error) return { status: "error", message: error.message };
  refresh();
  return { status: "success", message: localized(workspace, "Your CCSS and personal fiscal profiles are confirmed.", "Vos profils CCSS et fiscal personnel sont confirmés.") };
}

export async function saveCcssStatement(_previous: CcssActionState, formData: FormData): Promise<CcssActionState> {
  const workspace = await getWorkspace();
  if (!workspace.authenticated || !workspace.userId || !workspace.company) {
    return { status: "error", message: localized(workspace, "Your session expired. Please sign in again.", "Votre session a expiré. Veuillez vous reconnecter.") };
  }
  const taxYear = Number(text(formData, "tax_year"));
  const contributionPeriod = text(formData, "contribution_period");
  const issueDate = text(formData, "statement_issue_date");
  const amountDue = text(formData, "amount_due");
  const paymentStatus = text(formData, "payment_status");
  const paidDate = text(formData, "paid_date") || null;
  const sourceDocumentId = text(formData, "source_document_id") || null;
  if (!Number.isInteger(taxYear) || !/^\d{4}-\d{2}$/.test(contributionPeriod) || !validDate(issueDate) || !validMoney(amountDue)
      || !["unpaid", "paid", "disputed"].includes(paymentStatus) || paymentStatus === "paid" && (!paidDate || !validDate(paidDate))
      || paymentStatus !== "paid" && paidDate) {
    return { status: "error", message: localized(workspace, "Review the CCSS statement dates, amount and payment status.", "Vérifiez les dates, le montant et le statut de paiement de l’extrait CCSS.") };
  }
  if (sourceDocumentId && !/^[0-9a-f-]{36}$/i.test(sourceDocumentId)) {
    return { status: "error", message: localized(workspace, "Choose a valid source document.", "Choisissez un document source valide.") };
  }
  const supabase = await createClient();
  const [{ data: profile, error: profileError }, documentResult] = await Promise.all([
    supabase.from("ccss_profiles").select("id").eq("user_id", workspace.userId).eq("tax_year", taxYear).maybeSingle(),
    sourceDocumentId
      ? supabase.from("documents").select("id").eq("id", sourceDocumentId).eq("company_id", workspace.company.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (profileError || !profile) return { status: "error", message: localized(workspace, "Configure your CCSS situation before recording a statement.", "Configurez votre situation CCSS avant d’enregistrer un extrait.") };
  if (sourceDocumentId && (documentResult.error || !documentResult.data)) return { status: "error", message: localized(workspace, "The selected document is not available in this workspace.", "Le document sélectionné n’est pas disponible dans cet espace.") };
  const due = new Date(`${issueDate}T12:00:00Z`);
  due.setUTCDate(due.getUTCDate() + 10);
  const contributionMonth = `${contributionPeriod}-01`;
  const { error } = await supabase.from("ccss_statements").upsert({
    user_id: workspace.userId,
    ccss_profile_id: profile.id,
    company_id: workspace.company.id,
    contribution_month: contributionMonth,
    statement_issue_date: issueDate,
    amount_due: amountDue,
    due_date: due.toISOString().slice(0, 10),
    payment_status: paymentStatus,
    paid_date: paymentStatus === "paid" ? paidDate : null,
    source_document_id: sourceDocumentId,
  }, { onConflict: "user_id,company_id,contribution_month" });
  if (error) return { status: "error", message: error.message };
  refresh();
  return { status: "success", message: localized(workspace, "CCSS statement recorded with its official payment deadline.", "L’extrait CCSS et son échéance officielle ont été enregistrés.") };
}

