import type { CcssParameterPeriod } from "./types.ts";

export const CCSS_2026_PARAMETER_PERIODS: CcssParameterPeriod[] = [
  {
    effectiveFrom: "2026-01-01",
    effectiveTo: "2026-05-31",
    ssm: "2703.74",
    secondaryActivityMinimum: "901.25",
    maximumContributionBase: "13518.68",
    assistingSpouseMaximum: "5407.47",
    dependencyAllowance: "675.94",
    healthRate: "5.600000",
    sicknessCashBenefitRate: "0.500000",
    pensionRate: "17.000000",
    dependencyRate: "1.400000",
    accidentBaseRate: "0.650000",
    mdeClass1Rate: "0.230000",
    mdeClass2Rate: "0.950000",
    mdeClass3Rate: "1.560000",
    mdeClass4Rate: "2.660000",
    sourceAuthority: "CCSS",
    sourceReference: "https://ccss.public.lu/fr/publications/avis/2026/20260313-avis-60.html",
    verifiedAt: "2026-08-25T00:00:00Z",
  },
  {
    effectiveFrom: "2026-06-01",
    effectiveTo: "2026-12-31",
    ssm: "2771.33",
    secondaryActivityMinimum: "923.78",
    maximumContributionBase: "13856.63",
    assistingSpouseMaximum: "5542.65",
    dependencyAllowance: "692.83",
    healthRate: "5.600000",
    sicknessCashBenefitRate: "0.500000",
    pensionRate: "17.000000",
    dependencyRate: "1.400000",
    accidentBaseRate: "0.650000",
    mdeClass1Rate: "0.230000",
    mdeClass2Rate: "0.950000",
    mdeClass3Rate: "1.560000",
    mdeClass4Rate: "2.660000",
    sourceAuthority: "CCSS",
    sourceReference: "https://ccss.public.lu/fr/parametres-sociaux.html",
    verifiedAt: "2026-08-25T00:00:00Z",
  },
];

export function selectParameterPeriod(periods: CcssParameterPeriod[], month: string) {
  const selected = periods.find((period) => period.effectiveFrom <= month && (!period.effectiveTo || period.effectiveTo >= month));
  if (!selected) throw new Error(`No verified CCSS parameter period covers ${month}.`);
  return selected;
}
