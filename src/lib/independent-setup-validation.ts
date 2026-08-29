export type IndependentSetupValidation =
  | { ok: true; annualIncome: string; aaaFactor: string; openingCash: string }
  | { ok: false; step: number; message: string };

const allowedCategories = new Set(["liberal_profession", "commercial", "craft", "consultant_freelancer", "other"]);
const allowedCivil = new Set(["single", "married", "registered_partnership", "divorced", "separated", "widowed"]);
const allowedTaxationModes = new Set(["joint", "individual", "individual_reallocation", "not_applicable", "needs_confirmation"]);

function value(data: FormData, name: string) {
  return String(data.get(name) ?? "").trim();
}

function checked(data: FormData, name: string) {
  return data.get(name) === "on";
}

function validDate(input: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) return false;
  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return parsed.getUTCFullYear() === Number(year)
    && parsed.getUTCMonth() === Number(month) - 1
    && parsed.getUTCDate() === Number(day);
}

function decimal(input: string, maximumDecimals: number) {
  const normalized = input.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  if (!new RegExp(`^\\d{1,11}(?:\\.\\d{1,${maximumDecimals}})?$`).test(normalized)) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? { numeric, normalized } : null;
}

export function validateIndependentSetup(data: FormData): IndependentSetupValidation {
  const personalName = value(data, "personal_legal_name");
  const activityDescription = value(data, "activity_description");
  const activityCategory = value(data, "activity_category");
  const activityStart = value(data, "activity_start_date");
  const location = value(data, "location");
  if (personalName.length < 2 || activityDescription.length < 3 || !allowedCategories.has(activityCategory) || !validDate(activityStart) || location.length < 2) {
    return { ok: false, step: 1, message: "Complete the required activity details. / Complétez les informations obligatoires sur l’activité." };
  }

  const vatRegistered = checked(data, "vat_registered");
  const rcsRegistered = checked(data, "rcs_registered");
  const permitHeld = checked(data, "business_permit_held");
  if (vatRegistered && (value(data, "vat_number").length < 4 || !["annual", "quarterly", "monthly"].includes(value(data, "vat_filing_frequency")))) {
    return { ok: false, step: 3, message: "Complete the required VAT information. / Complétez les informations TVA obligatoires." };
  }
  if (rcsRegistered && value(data, "rcs_number").length < 2) {
    return { ok: false, step: 3, message: "Enter the RCS registration number. / Saisissez le numéro d’immatriculation RCS." };
  }
  if (permitHeld && value(data, "business_permit_number").length < 2) {
    return { ok: false, step: 3, message: "Enter the business permit reference. / Saisissez la référence de l’autorisation d’établissement." };
  }

  const taxYear = Number(value(data, "tax_year"));
  const civilStatus = value(data, "civil_status");
  const eventDate = value(data, "civil_status_event_date");
  const children = Number(value(data, "qualifying_children_count") || 0);
  if (!Number.isInteger(taxYear) || taxYear < 2000 || taxYear > 2200
      || !["resident", "non_resident"].includes(value(data, "residency_status"))
      || !allowedCivil.has(civilStatus)
      || (["divorced", "separated", "widowed"].includes(civilStatus) && !validDate(eventDate))
      || !Number.isInteger(children) || children < 0 || children > 30
      || !allowedTaxationModes.has(value(data, "taxation_mode"))) {
    return { ok: false, step: 4, message: "Review the required fiscal information. / Vérifiez les informations fiscales obligatoires." };
  }

  const annualIncome = decimal(value(data, "estimated_annual_professional_income"), 2);
  const aaaFactor = decimal(value(data, "aaa_factor"), 4);
  const mdeMembership = value(data, "mde_membership");
  const mdeClass = Number(value(data, "mde_class"));
  if (!annualIncome || annualIncome.numeric < 0
      || !aaaFactor || aaaFactor.numeric < 0.1 || aaaFactor.numeric > 5
      || !["principal", "secondary"].includes(value(data, "affiliation_type"))
      || !["not_affiliated", "affiliated"].includes(mdeMembership)
      || (mdeMembership === "affiliated" && ![1, 2, 3, 4].includes(mdeClass))) {
    return { ok: false, step: 5, message: "Review the required CCSS information. / Vérifiez les informations CCSS obligatoires." };
  }

  const accountingStart = value(data, "accounting_start_date");
  const openingCash = decimal(value(data, "opening_cash_amount") || "0", 2);
  if (!validDate(accountingStart) || !openingCash || openingCash.numeric < 0) {
    return { ok: false, step: 6, message: "Review the accounting opening date and amount. / Vérifiez la date et le montant de la situation d’ouverture." };
  }

  return { ok: true, annualIncome: annualIncome.normalized, aaaFactor: aaaFactor.normalized, openingCash: openingCash.normalized };
}
