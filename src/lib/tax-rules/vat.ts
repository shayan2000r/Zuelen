// Luxembourg VAT rules with their validity dates.
// Mirrors public.vat_rate_periods in the database; see docs/compliance/REGULATORY_REGISTER.md (A1, A6).

export type VatRateKind = "standard" | "intermediate" | "reduced" | "super_reduced" | "zero";

export type VatRatePeriod = {
  rate: number;
  kind: VatRateKind;
  effectiveFrom: string;
  effectiveTo: string | null;
  source: string;
};

const LTVA = "https://legilux.public.lu/eli/etat/leg/loi/1979/02/12/n1/jo";
const EC_2024 =
  "https://trade.ec.europa.eu/access-to-markets/fr/news/modifications-des-taux-de-tva-applicables-au-1-janvier-2024-dans-certains-etats-membres-de-lue";

export const VAT_RATE_PERIODS: VatRatePeriod[] = [
  { rate: 17, kind: "standard", effectiveFrom: "2015-01-01", effectiveTo: "2022-12-31", source: LTVA },
  { rate: 16, kind: "standard", effectiveFrom: "2023-01-01", effectiveTo: "2023-12-31", source: EC_2024 },
  { rate: 17, kind: "standard", effectiveFrom: "2024-01-01", effectiveTo: null, source: EC_2024 },
  { rate: 14, kind: "intermediate", effectiveFrom: "2015-01-01", effectiveTo: "2022-12-31", source: LTVA },
  { rate: 13, kind: "intermediate", effectiveFrom: "2023-01-01", effectiveTo: "2023-12-31", source: EC_2024 },
  { rate: 14, kind: "intermediate", effectiveFrom: "2024-01-01", effectiveTo: null, source: EC_2024 },
  { rate: 8, kind: "reduced", effectiveFrom: "2015-01-01", effectiveTo: "2022-12-31", source: LTVA },
  { rate: 7, kind: "reduced", effectiveFrom: "2023-01-01", effectiveTo: "2023-12-31", source: EC_2024 },
  { rate: 8, kind: "reduced", effectiveFrom: "2024-01-01", effectiveTo: null, source: EC_2024 },
  { rate: 3, kind: "super_reduced", effectiveFrom: "2015-01-01", effectiveTo: null, source: LTVA },
  { rate: 0, kind: "zero", effectiveFrom: "2015-01-01", effectiveTo: null, source: LTVA },
];

function isoDay(date: string | Date | null | undefined) {
  if (!date) return new Date().toISOString().slice(0, 10);
  return typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10);
}

/** VAT rates in force on a date, highest first (0 last). */
export function vatRatesOn(date?: string | Date | null): number[] {
  const day = isoDay(date);
  return VAT_RATE_PERIODS.filter(
    period => period.effectiveFrom <= day && (!period.effectiveTo || period.effectiveTo >= day),
  )
    .map(period => period.rate)
    .sort((a, b) => b - a);
}

/** Standard rate in force on a date (17 % except in 2023). */
export function standardVatRateOn(date?: string | Date | null): number {
  return vatRatesOn(date)[0];
}

export function isVatRateAllowed(rate: number, date?: string | Date | null): boolean {
  return vatRatesOn(date).includes(rate);
}

/** Closest rate in force on the date to an observed VAT / net ratio (ignores 0 %). */
export function closestVatRate(observedPercent: number, date?: string | Date | null): number {
  const rates = vatRatesOn(date).filter(rate => rate > 0);
  return rates.reduce(
    (best, rate) => (Math.abs(rate - observedPercent) < Math.abs(best - observedPercent) ? rate : best),
    rates[0],
  );
}

// ---------------------------------------------------------------------------------------------
// Small-business franchise (LTVA art. 57bis). Source: AED, FAQ régime de franchise
// https://pfi.public.lu/dam-assets/pdf/tva/sme/faq-fr.pdf — threshold raised from EUR 35,000 to
// EUR 50,000 on 1 January 2025, with a 10 % tolerance in the year the threshold is exceeded.
// ---------------------------------------------------------------------------------------------

export const FRANCHISE_SOURCE = "https://pfi.public.lu/dam-assets/pdf/tva/sme/faq-fr.pdf";
export const FRANCHISE_MENTION = "TVA non applicable – Article 57bis de la loi modifiée du 12 février 1979";
export const EXEMPT_ACTIVITY_MENTION = "Exonération de TVA – article 44 de la loi modifiée du 12 février 1979";
/** Printed on an invoice to a business customer outside the EU (same text as the database stores at issue). */
export const OUTSIDE_EU_SERVICE_MENTION =
  "TVA non applicable – prestation de services à un preneur assujetti établi hors de l'Union européenne";

type FranchiseThreshold = {
  effectiveFromYear: number;
  effectiveToYear: number | null;
  threshold: number;
  tolerancePercent: number;
};

const FRANCHISE_THRESHOLDS: FranchiseThreshold[] = [
  // EUR 35,000 is the threshold the AED FAQ says was in force before 2025.
  { effectiveFromYear: 2020, effectiveToYear: 2024, threshold: 35000, tolerancePercent: 0 },
  { effectiveFromYear: 2025, effectiveToYear: null, threshold: 50000, tolerancePercent: 10 },
];

/** EU-wide annual turnover limit for the cross-border franchise scheme (from 2025). */
export const EU_FRANCHISE_THRESHOLD = 100000;

export function franchiseThreshold(year: number): FranchiseThreshold | null {
  return (
    FRANCHISE_THRESHOLDS.find(
      entry => entry.effectiveFromYear <= year && (entry.effectiveToYear === null || entry.effectiveToYear >= year),
    ) ?? null
  );
}

export type FranchiseStatus =
  | { state: "unknown_year" }
  | { state: "below"; threshold: number; remaining: number }
  | { state: "approaching"; threshold: number; remaining: number }
  | { state: "tolerance"; threshold: number; limit: number }
  | { state: "exceeded"; threshold: number; limit: number };

/**
 * Where a franchise business stands for the calendar year, given its turnover so far.
 * "approaching" starts at 80 % of the threshold so the user can plan ahead.
 * Exceeding the threshold within the tolerance keeps the franchise until 31 December but excludes it
 * for the next year; exceeding the tolerance ends it from the day after.
 */
export function franchiseStatus(turnover: number, year: number): FranchiseStatus {
  const rule = franchiseThreshold(year);
  if (!rule) return { state: "unknown_year" };
  const limit = Math.round(rule.threshold * (1 + rule.tolerancePercent / 100) * 100) / 100;
  if (turnover > limit) return { state: "exceeded", threshold: rule.threshold, limit };
  if (turnover > rule.threshold) return { state: "tolerance", threshold: rule.threshold, limit };
  const remaining = Math.round((rule.threshold - turnover) * 100) / 100;
  if (turnover >= rule.threshold * 0.8) return { state: "approaching", threshold: rule.threshold, remaining };
  return { state: "below", threshold: rule.threshold, remaining };
}
