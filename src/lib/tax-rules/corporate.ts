// Luxembourg corporate direct taxes, by tax year.
// See docs/compliance/REGULATORY_REGISTER.md (B1–B5).

export const IRC_SOURCE = "https://impotsdirects.public.lu/fr/az/t/tarif-applicable-collectivites/tarif-collect.html";
export const ICC_SOURCE = "https://impotsdirects.public.lu/fr/az/c/calc_comm.html";
export const NWT_SOURCE = "https://impotsdirects.public.lu/fr/az/t/tarif-applicable-collectivites/tarif-collect-if.html";

type IrcScale = {
  fromTaxYear: number;
  toTaxYear: number;
  /** Rate up to lowerBracket. */
  lowRate: number;
  lowerBracket: number;
  /** Tax = base + marginalRate × (income − lowerBracket) up to upperBracket. */
  middleBase: number;
  marginalRate: number;
  upperBracket: number;
  /** Rate on the whole income above upperBracket. */
  normalRate: number;
};

// The last tax year with a confirmed scale. A further cut for 2027 has been announced but is not law
// yet (Chamber of Deputies, QP 62533, March 2026); estimates for later years are not shown.
export const LAST_VERIFIED_IRC_TAX_YEAR = 2026;

const IRC_SCALES: IrcScale[] = [
  { fromTaxYear: 2019, toTaxYear: 2024, lowRate: 0.15, lowerBracket: 175000, middleBase: 26250, marginalRate: 0.31, upperBracket: 200001, normalRate: 0.17 },
  { fromTaxYear: 2025, toTaxYear: LAST_VERIFIED_IRC_TAX_YEAR, lowRate: 0.14, lowerBracket: 175000, middleBase: 24500, marginalRate: 0.3, upperBracket: 200001, normalRate: 0.16 },
];

/** Corporate income tax (IRC) before the employment-fund surcharge, or null when no verified scale exists. */
export function corporateIncomeTax(taxableIncome: number, taxYear: number): number | null {
  const scale = IRC_SCALES.find((entry) => entry.fromTaxYear <= taxYear && entry.toTaxYear >= taxYear);
  if (!scale) return null;
  if (taxableIncome <= 0) return 0;
  if (taxableIncome <= scale.lowerBracket) return cents(taxableIncome * scale.lowRate);
  if (taxableIncome <= scale.upperBracket) return cents(scale.middleBase + (taxableIncome - scale.lowerBracket) * scale.marginalRate);
  return cents(taxableIncome * scale.normalRate);
}

function cents(amount: number) {
  return Math.round(amount * 100) / 100;
}

/** Employment-fund surcharge for companies: 7 % of the IRC. */
export const EMPLOYMENT_FUND_RATE = 0.07;

/** Municipal business tax (ICC) base rate and the deduction for IRC taxpayers. */
export const ICC_BASE_RATE = 0.03;
export const ICC_DEDUCTION_COMPANIES = 17500;

/** Municipal business tax for a company, given the commune's multiplier (e.g. 2.25 for 225 %). */
export function municipalBusinessTax(operatingProfit: number, multiplier: number): number {
  return cents(Math.max(operatingProfit - ICC_DEDUCTION_COMPANIES, 0) * ICC_BASE_RATE * multiplier);
}

/**
 * Minimum net wealth tax of a resident capital company from tax year 2025 (§ 8 VStG as amended after
 * the Constitutional Court ruling of 10 November 2023): based only on the total balance sheet.
 * Earlier years also depended on the share of financial assets, which Zuelen does not know, so no
 * figure is given for them.
 */
export function minimumNetWealthTax(totalBalanceSheet: number, taxYear: number): number | null {
  if (taxYear < 2025) return null;
  if (totalBalanceSheet <= 350000) return 535;
  if (totalBalanceSheet <= 2000000) return 1605;
  return 4815;
}
