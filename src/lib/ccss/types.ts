export type AffiliationType = "principal" | "secondary" | "manager";
export type ActivityLegalForm = "own_name" | "company";
export type IncomeStatus = "provisional" | "user_confirmed" | "final_acd";
export type IncomeSource = "manual" | "accounting_proxy" | "manager_remuneration" | "acd_final";
export type ExplicitReliefStatus = "not_requested" | "requested" | "approved";
export type MdeClass = 1 | 2 | 3 | 4;

export type CcssParameterPeriod = {
  id?: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  ssm: string;
  secondaryActivityMinimum: string;
  maximumContributionBase: string;
  assistingSpouseMaximum: string;
  dependencyAllowance: string;
  healthRate: string;
  sicknessCashBenefitRate: string;
  pensionRate: string;
  dependencyRate: string;
  accidentBaseRate: string;
  mdeClass1Rate: string;
  mdeClass2Rate: string;
  mdeClass3Rate: string;
  mdeClass4Rate: string;
  sourceAuthority: string;
  sourceReference: string;
  verifiedAt: string;
};

export type CcssSituation = {
  affiliationType: AffiliationType;
  activityLegalForm: ActivityLegalForm;
  incomeStatus: IncomeStatus;
  incomeSource: IncomeSource;
  aaaFactor: string;
  mdeClass: MdeClass | null;
  confirmedMonthlyNormalBase: string | null;
  confirmedMonthlyPensionBase: string | null;
  confirmedMonthlyDependencyBase: string | null;
  pensionReductionStatus: ExplicitReliefStatus;
  insignificantIncomeExemptionStatus: ExplicitReliefStatus;
  assistingSpouse: {
    enabled: boolean;
    qualifyingRelationship: boolean;
    mainActivity: boolean;
  };
};

export type ContributionKey = "health" | "sicknessCash" | "pension" | "dependency" | "accident" | "mde";

export type ContributionComponent = {
  key: ContributionKey;
  amountCents: number;
  baseCents: number;
  rate: string;
  factor?: string;
};

export type PersonContributionResult = {
  actualProfessionalIncomeCents: number;
  normalBaseCents: number;
  pensionBaseCents: number;
  dependencyBaseCents: number;
  components: Record<ContributionKey, ContributionComponent>;
  totalCents: number;
  minimumBinding: "ssm" | "one_third_ssm" | null;
  maximumBinding: boolean;
  pensionReductionApplied: boolean;
  exemptionApplied: boolean;
  warnings: string[];
};

export type MonthlyCcssResult = {
  month: string;
  parameterPeriodId?: string;
  parameterEffectiveFrom: string;
  parameterEffectiveTo: string | null;
  principal: PersonContributionResult;
  assistingSpouse: PersonContributionResult | null;
  combinedTotalCents: number;
  assistingSpouseEstimate: boolean;
  inactive: boolean;
};

export type AnnualCcssResult = {
  year: number;
  monthlyProfessionalIncomeCents: number;
  months: MonthlyCcssResult[];
  totalCents: number;
  parameterChanges: string[];
};
