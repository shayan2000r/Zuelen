import { cents, centsToNumber, clampMoney, divideMoney, multiplyByPercent, multiplyByPercentAndFactor } from "./decimal.ts";
import { selectParameterPeriod } from "./parameters.ts";
import type {
  AnnualCcssResult,
  CcssParameterPeriod,
  CcssSituation,
  ContributionComponent,
  ContributionKey,
  MonthlyCcssResult,
  PersonContributionResult,
} from "./types.ts";

const COMPONENT_KEYS: ContributionKey[] = ["health", "sicknessCash", "pension", "dependency", "accident", "mde"];

function zeroComponent(key: ContributionKey, rate = "0") : ContributionComponent {
  return { key, amountCents: 0, baseCents: 0, rate };
}

function mdeRate(parameters: CcssParameterPeriod, mdeClass: CcssSituation["mdeClass"]) {
  if (mdeClass === 1) return parameters.mdeClass1Rate;
  if (mdeClass === 2) return parameters.mdeClass2Rate;
  if (mdeClass === 3) return parameters.mdeClass3Rate;
  if (mdeClass === 4) return parameters.mdeClass4Rate;
  return "0";
}

function validateSituation(situation: CcssSituation) {
  if (situation.affiliationType === "manager" && situation.incomeSource === "accounting_proxy") {
    throw new Error("A manager/director CCSS profile cannot use corporate accounting profit as professional income.");
  }
  if (situation.incomeSource === "accounting_proxy" && situation.activityLegalForm !== "own_name") {
    throw new Error("An accounting-derived proxy is only allowed for an activity carried on in the person's own name.");
  }
}

export function isAssistingSpouseEligible(situation: CcssSituation) {
  return situation.assistingSpouse.enabled
    && situation.activityLegalForm === "own_name"
    && situation.assistingSpouse.qualifyingRelationship
    && situation.assistingSpouse.mainActivity;
}

function personCalculation(actualIncome: bigint, situation: CcssSituation, parameters: CcssParameterPeriod): PersonContributionResult {
  const ssm = cents(parameters.ssm);
  const secondaryMinimum = cents(parameters.secondaryActivityMinimum);
  const normalMaximum = cents(parameters.maximumContributionBase);
  const ordinaryMinimum = situation.affiliationType === "secondary" ? secondaryMinimum : ssm;
  const explicitExemption = situation.insignificantIncomeExemptionStatus !== "not_requested" && actualIncome < secondaryMinimum;
  const warnings: string[] = [];

  if (explicitExemption) {
    const components = Object.fromEntries(COMPONENT_KEYS.map((key) => [key, zeroComponent(key)])) as Record<ContributionKey, ContributionComponent>;
    warnings.push(situation.insignificantIncomeExemptionStatus === "requested" ? "insignificant_exemption_requested" : "insignificant_exemption_approved");
    return {
      actualProfessionalIncomeCents: centsToNumber(actualIncome), normalBaseCents: 0, pensionBaseCents: 0, dependencyBaseCents: 0,
      components, totalCents: 0, minimumBinding: null, maximumBinding: false, pensionReductionApplied: false,
      exemptionApplied: true, warnings,
    };
  }

  const normalBase = clampMoney(actualIncome, ordinaryMinimum, normalMaximum);
  const pensionReductionApplied = situation.pensionReductionStatus !== "not_requested" && actualIncome < ssm;
  const pensionBase = pensionReductionApplied ? clampMoney(actualIncome, secondaryMinimum, normalMaximum) : normalBase;
  const dependencyBase = actualIncome > cents(parameters.dependencyAllowance) ? actualIncome - cents(parameters.dependencyAllowance) : 0n;
  const selectedMdeRate = mdeRate(parameters, situation.mdeClass);

  if (actualIncome < secondaryMinimum && situation.insignificantIncomeExemptionStatus === "not_requested") warnings.push("insignificant_exemption_may_be_available");
  if (situation.pensionReductionStatus === "requested") warnings.push("pension_reduction_requested");

  const component = (key: ContributionKey, base: bigint, rate: string, amount: bigint, factor?: string): ContributionComponent => ({
    key, baseCents: centsToNumber(base), rate, amountCents: centsToNumber(amount), ...(factor ? { factor } : {}),
  });
  const components: Record<ContributionKey, ContributionComponent> = {
    health: component("health", normalBase, parameters.healthRate, multiplyByPercent(normalBase, parameters.healthRate)),
    sicknessCash: component("sicknessCash", normalBase, parameters.sicknessCashBenefitRate, multiplyByPercent(normalBase, parameters.sicknessCashBenefitRate)),
    pension: component("pension", pensionBase, parameters.pensionRate, multiplyByPercent(pensionBase, parameters.pensionRate)),
    dependency: component("dependency", dependencyBase, parameters.dependencyRate, multiplyByPercent(dependencyBase, parameters.dependencyRate)),
    accident: component("accident", normalBase, parameters.accidentBaseRate, multiplyByPercentAndFactor(normalBase, parameters.accidentBaseRate, situation.aaaFactor), situation.aaaFactor),
    mde: situation.mdeClass
      ? component("mde", normalBase, selectedMdeRate, multiplyByPercent(normalBase, selectedMdeRate))
      : zeroComponent("mde"),
  };
  const totalCents = COMPONENT_KEYS.reduce((total, key) => total + components[key].amountCents, 0);
  return {
    actualProfessionalIncomeCents: centsToNumber(actualIncome),
    normalBaseCents: centsToNumber(normalBase),
    pensionBaseCents: centsToNumber(pensionBase),
    dependencyBaseCents: centsToNumber(dependencyBase),
    components,
    totalCents,
    minimumBinding: actualIncome < ordinaryMinimum ? (situation.affiliationType === "secondary" ? "one_third_ssm" : "ssm") : null,
    maximumBinding: actualIncome > normalMaximum,
    pensionReductionApplied,
    exemptionApplied: false,
    warnings,
  };
}

export function calculateMonthlyCcss(input: {
  month: string;
  monthlyProfessionalIncome: string;
  situation: CcssSituation;
  parameters: CcssParameterPeriod;
  inactive?: boolean;
}): MonthlyCcssResult {
  validateSituation(input.situation);
  const actualIncome = input.inactive ? 0n : cents(input.monthlyProfessionalIncome);
  if (input.inactive) {
    const principal = personCalculation(0n, { ...input.situation, insignificantIncomeExemptionStatus: "approved" }, input.parameters);
    return {
      month: input.month, parameterPeriodId: input.parameters.id, parameterEffectiveFrom: input.parameters.effectiveFrom,
      parameterEffectiveTo: input.parameters.effectiveTo, principal, assistingSpouse: null, combinedTotalCents: 0,
      assistingSpouseEstimate: false, inactive: true,
    };
  }

  const spouseEligible = isAssistingSpouseEligible(input.situation);
  if (input.situation.assistingSpouse.enabled && !spouseEligible) {
    throw new Error(input.situation.activityLegalForm === "company"
      ? "A spouse or partner working for a company must not be calculated as an assisting spouse."
      : "The assisting-spouse conditions are incomplete.");
  }
  if (!spouseEligible) {
    const principal = personCalculation(actualIncome, input.situation, input.parameters);
    return {
      month: input.month, parameterPeriodId: input.parameters.id, parameterEffectiveFrom: input.parameters.effectiveFrom,
      parameterEffectiveTo: input.parameters.effectiveTo, principal, assistingSpouse: null,
      combinedTotalCents: principal.totalCents, assistingSpouseEstimate: false, inactive: false,
    };
  }

  const assistingMaximum = cents(input.parameters.assistingSpouseMaximum);
  const half = actualIncome / 2n;
  const spouseIncome = half > assistingMaximum ? assistingMaximum : half;
  const principalIncome = actualIncome - spouseIncome;
  const withoutSpouse = { ...input.situation, assistingSpouse: { enabled: false, qualifyingRelationship: false, mainActivity: false } };
  const principal = personCalculation(principalIncome, withoutSpouse, input.parameters);
  const assistingSpouse = personCalculation(spouseIncome, { ...withoutSpouse, affiliationType: "principal" }, input.parameters);
  return {
    month: input.month, parameterPeriodId: input.parameters.id, parameterEffectiveFrom: input.parameters.effectiveFrom,
    parameterEffectiveTo: input.parameters.effectiveTo, principal, assistingSpouse,
    combinedTotalCents: principal.totalCents + assistingSpouse.totalCents,
    assistingSpouseEstimate: true, inactive: false,
  };
}

export function calculateAnnualCcss(input: {
  year: number;
  annualProfessionalIncome: string;
  affiliationStartDate: string;
  situation: CcssSituation;
  parameterPeriods: CcssParameterPeriod[];
}): AnnualCcssResult {
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) throw new Error("Invalid CCSS projection year.");
  const monthlyIncome = divideMoney(cents(input.annualProfessionalIncome), 12);
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = `${input.year}-${String(index + 1).padStart(2, "0")}-01`;
    const parameters = selectParameterPeriod(input.parameterPeriods, month);
    const monthEnd = new Date(Date.UTC(input.year, index + 1, 0)).toISOString().slice(0, 10);
    return calculateMonthlyCcss({
      month,
      monthlyProfessionalIncome: `${monthlyIncome / 100n}.${String(monthlyIncome % 100n).padStart(2, "0")}`,
      situation: input.situation,
      parameters,
      inactive: input.affiliationStartDate > monthEnd,
    });
  });
  const parameterChanges = months.filter((month, index) => index > 0 && month.parameterEffectiveFrom !== months[index - 1].parameterEffectiveFrom).map((month) => month.month);
  return {
    year: input.year,
    monthlyProfessionalIncomeCents: centsToNumber(monthlyIncome),
    months,
    totalCents: months.reduce((total, month) => total + month.combinedTotalCents, 0),
    parameterChanges,
  };
}
