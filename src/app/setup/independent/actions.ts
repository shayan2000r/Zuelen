"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { deriveResidentTaxClass, type CivilStatus, type FiscalResidency, type TaxationMode } from "@/lib/personal-fiscal/tax-class";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace";
import { validateIndependentSetup } from "@/lib/independent-setup-validation";

export type IndependentSetupState = { status: "idle" | "error"; message: string; step?: number };
const text = (data: FormData, name: string) => String(data.get(name) ?? "").trim();
const checked = (data: FormData, name: string) => data.get(name) === "on";
const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "activity";

export async function createIndependentWorkspaceAction(_state: IndependentSetupState, formData: FormData): Promise<IndependentSetupState> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) return { status:"error", message:"Your session expired. Please sign in again. / Votre session a expiré. Veuillez vous reconnecter." };
  const validation = validateIndependentSetup(formData);
  if (!validation.ok) {
    const locale = text(formData, "locale") === "fr" ? "fr" : "en";
    const [english, french] = validation.message.split(" / ");
    return { status: "error", message: locale === "fr" ? french || english : english, step: validation.step };
  }

  const personalName = text(formData, "personal_legal_name");
  const activityName = text(formData, "activity_name");
  const activityDescription = text(formData, "activity_description");
  const activityCategory = text(formData, "activity_category");
  const activityStart = text(formData, "activity_start_date");
  const accountingStart = text(formData, "accounting_start_date");
  const location = text(formData, "location") || "Luxembourg";
  const taxYear = Number(text(formData, "tax_year"));
  const residency = text(formData, "residency_status");
  const civilStatus = text(formData, "civil_status");
  const eventDate = text(formData, "civil_status_event_date") || null;
  const children = Number(text(formData, "qualifying_children_count") || 0);
  const taxationMode = text(formData, "taxation_mode");
  const affiliationType = text(formData, "affiliation_type");
  const annualIncome = validation.annualIncome;
  const aaaFactor = validation.aaaFactor;
  const openingCash = validation.openingCash;
  const mdeMembership = text(formData, "mde_membership");
  const mdeClass = mdeMembership === "affiliated" ? Number(text(formData, "mde_class")) : null;
  const vatRegistered = checked(formData, "vat_registered");
  const rcsRegistered = checked(formData, "rcs_registered");
  const permitHeld = checked(formData, "business_permit_held");
  const vatNumber = text(formData, "vat_number");
  const vatFrequency = text(formData, "vat_filing_frequency");
  const rcsNumber = text(formData, "rcs_number");
  const permitNumber = text(formData, "business_permit_number");

  const fiscalFacts = {
    taxYear,
    residencyStatus: residency as FiscalResidency,
    civilStatus: civilStatus as CivilStatus,
    civilStatusEventDate: eventDate,
    qualifyingChildrenCount: children,
    age64AtYearStart: checked(formData, "age_64_at_year_start"),
    taxationMode: taxationMode as TaxationMode,
    partnershipFullYearConditionsMet: checked(formData, "partnership_full_year_conditions_met"),
    legallyRecognizedSeparation: checked(formData, "legally_recognized_separation"),
    transitionalClass2UsedInPriorFiveYears: checked(formData, "transitional_class_2_used_in_prior_five_years"),
  };
  const derived = deriveResidentTaxClass(fiscalFacts);
  const slug = `${slugify(activityName || personalName)}-${userId.slice(0,6)}-${randomUUID().slice(0,6)}`;
  const { data: companyId, error } = await supabase.rpc("create_independent_workspace_v1", {
    p_personal_legal_name:personalName, p_activity_name:activityName || null, p_slug:slug,
    p_activity_description:activityDescription, p_activity_category:activityCategory,
    p_activity_start_date:activityStart, p_accounting_start_date:accountingStart, p_location:location,
    p_vat_registered:vatRegistered, p_vat_number:vatRegistered ? vatNumber : null,
    p_vat_filing_frequency:vatRegistered ? vatFrequency : null,
    p_rcs_registered:rcsRegistered, p_rcs_number:rcsRegistered ? rcsNumber : null,
    p_business_permit_held:permitHeld, p_business_permit_number:permitHeld ? permitNumber : null,
    p_opening_cash_amount:openingCash, p_tax_year:taxYear, p_residency_status:residency, p_civil_status:civilStatus,
    p_civil_status_event_date:eventDate, p_qualifying_children_count:children, p_age_64_at_year_start:fiscalFacts.age64AtYearStart,
    p_taxation_mode:taxationMode, p_partnership_full_year_conditions_met:fiscalFacts.partnershipFullYearConditionsMet,
    p_legally_recognized_separation:fiscalFacts.legallyRecognizedSeparation,
    p_transitional_class_2_used_in_prior_five_years:fiscalFacts.transitionalClass2UsedInPriorFiveYears,
    p_derived_tax_class:derived.taxClass, p_affiliation_type:affiliationType,
    p_estimated_annual_professional_income:annualIncome, p_aaa_factor:aaaFactor,
    p_mde_membership:mdeMembership, p_mde_class:mdeClass,
  });
  if (error || typeof companyId !== "string") return { status:"error", message:error?.message ?? "The Independent workspace could not be created." };

  const { data: company } = await supabase.from("companies").select("organization_id").eq("id", companyId).maybeSingle();
  const { data: membership } = company ? await supabase.from("organization_members").select("organization_id").eq("organization_id", company.organization_id).eq("user_id", userId).maybeSingle() : { data:null };
  if (!membership) return { status:"error", message:"The workspace was created but could not be selected securely." };
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, companyId, { httpOnly:true, sameSite:"lax", secure:process.env.NODE_ENV === "production", path:"/", maxAge:60*60*24*365 });
  redirect("/app");
}
