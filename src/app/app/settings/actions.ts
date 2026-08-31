"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { canManageOrganization } from "@/lib/permissions";

export type SettingsState = { status: "idle" | "success" | "error"; message: string };
function text(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim(); }

export async function saveCompanySettings(_previous: SettingsState, formData: FormData): Promise<SettingsState> {
  const workspace = await getWorkspace();
  const fr = workspace.profile?.locale === "fr";
  const m = (en: string, french: string) => fr ? french : en;
  if (!workspace.authenticated || !workspace.company || !workspace.organization) return { status: "error", message: m("Your session expired. Please sign in again.", "Votre session a expiré. Veuillez vous reconnecter.") };
  if (!canManageOrganization(workspace.role)) return { status: "error", message: m("Only an Owner or Admin can change the company profile.", "Seul un propriétaire ou administrateur peut modifier ce profil.") };

  const legalName = text(formData, "legal_name");
  const legalForm = workspace.company.entity_kind === "independent" ? workspace.company.legal_form : text(formData, "legal_form");
  const tradingName = text(formData, "trading_name");
  const rcs = text(formData, "rcs_number");
  const vat = text(formData, "vat_number");
  const tax = text(formData, "tax_number");
  const permit = text(formData, "business_permit_number");
  const municipality = text(formData, "municipality");
  const activity = text(formData, "activity");
  const street = text(formData, "street");
  const postal = text(formData, "postal_code");
  const city = text(formData, "city");
  const country = text(formData, "country_code").toUpperCase() || "LU";
  const currency = text(formData, "base_currency").toUpperCase() || "EUR";
  const frequency = text(formData, "vat_filing_frequency");
  const fiscalMonth = Number(formData.get("fiscal_year_start_month") ?? 1);
  const vatRegistered = formData.get("vat_registered") === "on";

  if (legalName.length < 2) return { status: "error", message: m("Enter the legal name.", "Saisissez le nom légal.") };
  if (!legalForm) return { status: "error", message: m("Choose the legal form.", "Choisissez la forme juridique.") };
  if (!Number.isInteger(fiscalMonth) || fiscalMonth < 1 || fiscalMonth > 12) return { status: "error", message: m("Choose a valid fiscal-year start month.", "Choisissez un mois de début d’exercice valide.") };
  if (!/^[A-Z]{3}$/.test(currency)) return { status: "error", message: m("Use a valid 3-letter base currency.", "Utilisez un code devise valide à trois lettres.") };
  if (vatRegistered && !vat) return { status: "error", message: m("Enter the VAT number or turn off VAT registration.", "Saisissez le numéro de TVA ou désactivez l’assujettissement.") };
  if (frequency && !["annual", "quarterly", "monthly"].includes(frequency)) return { status: "error", message: m("Choose a valid VAT filing frequency.", "Choisissez une fréquence de déclaration TVA valide.") };
  if (!/^[A-Z]{2}$/.test(country)) return { status: "error", message: m("Use a two-letter country code.", "Utilisez un code pays à deux lettres.") };

  const independent = workspace.company.entity_kind === "independent";
  const category = text(formData, "activity_category");
  const activityStart = text(formData, "activity_start_date");
  const accountingStart = text(formData, "accounting_start_date");
  if (independent && (!["liberal_profession", "commercial", "craft", "consultant_freelancer", "other"].includes(category) || !/^\d{4}-\d{2}-\d{2}$/.test(activityStart) || !/^\d{4}-\d{2}-\d{2}$/.test(accountingStart))) {
    return { status: "error", message: m("Review the Independent activity category and start dates.", "Vérifiez la catégorie de l’activité indépendante et ses dates de début.") };
  }

  const multiplierRaw = text(formData, "icc_multiplier_percent");
  const multiplierYearRaw = text(formData, "icc_multiplier_year");
  const priorBalanceRaw = text(formData, "prior_balance_total");
  const hasTaxProfile = !independent && (Boolean(multiplierRaw) || Boolean(priorBalanceRaw));
  const multiplierPercent = Number(multiplierRaw);
  const multiplierYear = Number(multiplierYearRaw);
  const priorBalance = priorBalanceRaw ? Number(priorBalanceRaw) : null;
  if (hasTaxProfile && (!Number.isFinite(multiplierPercent) || multiplierPercent <= 0 || multiplierPercent > 1000)) return { status: "error", message: m("Enter the municipal multiplier as a percentage, for example 225.", "Saisissez le multiplicateur communal en pourcentage, par exemple 225.") };
  if (hasTaxProfile && (!Number.isInteger(multiplierYear) || multiplierYear < 2025 || multiplierYear > 2100)) return { status: "error", message: m("Choose a valid multiplier year.", "Choisissez une année de multiplicateur valide.") };
  if (hasTaxProfile && priorBalance !== null && (!Number.isFinite(priorBalance) || priorBalance < 0)) return { status: "error", message: m("Prior closing balance total must be zero or greater.", "Le total du bilan de clôture précédent doit être positif ou nul.") };

  const supabase = await createClient();
  const companyResult = await supabase.from("companies").update({
    legal_name: legalName,
    trading_name: tradingName || null,
    legal_form: legalForm,
    rcs_number: rcs || null,
    vat_number: vat || null,
    tax_number: tax || null,
    business_permit_number: permit || null,
    municipality: municipality || city || null,
    activity: activity || null,
    fiscal_year_start_month: fiscalMonth,
    base_currency: currency,
    vat_registered: vatRegistered,
    vat_filing_frequency: vatRegistered ? (frequency || null) : null,
    registered_address: { street, postal_code: postal, city, country_code: country },
    updated_at: new Date().toISOString(),
  }).eq("id", workspace.company.id);
  if (companyResult.error) return { status: "error", message: companyResult.error.message };

  if (hasTaxProfile) {
    const taxProfileResult = await supabase.from("company_tax_profiles").upsert({
      company_id: workspace.company.id,
      organization_id: workspace.organization.id,
      municipality: municipality || city || null,
      icc_multiplier: multiplierPercent / 100,
      icc_multiplier_year: multiplierYear,
      icc_source: "User-confirmed municipality rate",
      icc_verified_at: new Date().toISOString(),
      prior_closing_balance_total: priorBalance,
      prior_balance_year: priorBalance !== null ? multiplierYear - 1 : null,
      updated_by: workspace.userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "company_id" });
    if (taxProfileResult.error) return { status: "error", message: taxProfileResult.error.message };
  }

  if (independent) {
    const profileResult = await supabase.from("independent_activity_profiles").update({
      personal_legal_name: legalName,
      activity_name: tradingName || null,
      activity_category: category,
      activity_start_date: activityStart,
      accounting_start_date: accountingStart,
      location: municipality || city || "Luxembourg",
      rcs_registered: Boolean(rcs),
      business_permit_held: Boolean(permit),
    }).eq("company_id", workspace.company.id).eq("user_id", workspace.userId);
    if (profileResult.error) return { status: "error", message: profileResult.error.message };
  }

  for (const path of ["/app", "/app/settings", "/app/invoices", "/app/taxes", "/app/vat", "/app/compliance", "/app/copilot"]) revalidatePath(path);
  return { status: "success", message: m("Profile saved.", "Profil enregistré.") };
}
