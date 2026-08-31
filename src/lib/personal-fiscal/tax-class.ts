export type TaxClass = "1" | "1a" | "2" | "needs_confirmation";
export type FiscalResidency = "resident" | "non_resident";
export type CivilStatus = "single" | "married" | "registered_partnership" | "divorced" | "separated" | "widowed";
export type TaxationMode = "joint" | "individual" | "individual_reallocation" | "not_applicable" | "needs_confirmation";

export type PersonalFiscalFacts = {
  taxYear: number;
  residencyStatus: FiscalResidency;
  civilStatus: CivilStatus;
  civilStatusEventDate: string | null;
  qualifyingChildrenCount: number;
  age64AtYearStart: boolean;
  taxationMode: TaxationMode;
  partnershipFullYearConditionsMet: boolean;
  legallyRecognizedSeparation: boolean;
  transitionalClass2UsedInPriorFiveYears: boolean;
};

export type TaxClassDerivation = { taxClass: TaxClass; reason: string; assessmentOnly?: boolean };

function fallbackClass(facts: PersonalFiscalFacts): TaxClassDerivation {
  return facts.qualifyingChildrenCount > 0 || facts.age64AtYearStart
    ? { taxClass: "1a", reason: facts.qualifyingChildrenCount > 0 ? "qualifying_child" : "age_64" }
    : { taxClass: "1", reason: "resident_default" };
}

function eventYear(facts: PersonalFiscalFacts) {
  if (!facts.civilStatusEventDate) return null;
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(facts.civilStatusEventDate);
  return match ? Number(match[1]) : null;
}

export function deriveResidentTaxClass(facts: PersonalFiscalFacts): TaxClassDerivation {
  if (facts.residencyStatus !== "resident") return { taxClass: "needs_confirmation", reason: "non_resident_requires_acd_confirmation" };
  if (!Number.isInteger(facts.taxYear) || facts.taxYear < 2000 || facts.taxYear > 2100) return { taxClass: "needs_confirmation", reason: "invalid_tax_year" };

  if (facts.civilStatus === "married") {
    if (facts.taxationMode === "joint") return { taxClass: "2", reason: "married_joint_taxation" };
    if (facts.taxationMode === "individual" || facts.taxationMode === "individual_reallocation") return { taxClass: "1", reason: "married_individual_class_1_framework" };
    return { taxClass: "needs_confirmation", reason: "married_taxation_mode_required" };
  }

  if (facts.civilStatus === "registered_partnership") {
    if (facts.taxationMode === "joint" && facts.partnershipFullYearConditionsMet) {
      return { taxClass: "2", reason: "partners_joint_assessment_full_year", assessmentOnly: true };
    }
    return fallbackClass(facts);
  }

  if (["widowed", "divorced", "separated"].includes(facts.civilStatus)) {
    const year = eventYear(facts);
    if (year === null || year > facts.taxYear) return { taxClass: "needs_confirmation", reason: "civil_status_event_date_required" };
    const recognized = facts.civilStatus !== "separated" || facts.legallyRecognizedSeparation;
    const priorUseBlocks = facts.civilStatus !== "widowed" && facts.transitionalClass2UsedInPriorFiveYears;
    if (recognized && !priorUseBlocks && facts.taxYear <= year + 3) {
      return { taxClass: "2", reason: "transitional_class_2" };
    }
    if (facts.civilStatus === "widowed") return { taxClass: "1a", reason: "widowed_class_1a" };
    return fallbackClass(facts);
  }

  return fallbackClass(facts);
}

export function resolveDisplayedTaxClass(input: {
  derived: TaxClassDerivation;
  manualOverride?: "1" | "1a" | "2" | null;
  acdTaxRatePercent?: string | null;
}) {
  if (input.manualOverride) return { value: input.manualOverride, source: "acd_override" as const };
  if (input.derived.taxClass === "needs_confirmation" && input.acdTaxRatePercent) return { value: input.acdTaxRatePercent, source: "acd_rate" as const };
  return { value: input.derived.taxClass, source: "derived" as const };
}
