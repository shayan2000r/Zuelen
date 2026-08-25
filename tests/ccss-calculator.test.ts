import assert from "node:assert/strict";
import test from "node:test";
import { calculateAnnualCcss, calculateMonthlyCcss, isAssistingSpouseEligible } from "../src/lib/ccss/calculator.ts";
import { multiplyByPercent } from "../src/lib/ccss/decimal.ts";
import { CCSS_2026_PARAMETER_PERIODS } from "../src/lib/ccss/parameters.ts";
import type { CcssSituation } from "../src/lib/ccss/types.ts";

const january = CCSS_2026_PARAMETER_PERIODS[0];
const june = CCSS_2026_PARAMETER_PERIODS[1];

function situation(overrides: Partial<CcssSituation> = {}): CcssSituation {
  return {
    affiliationType: "principal",
    activityLegalForm: "own_name",
    incomeStatus: "user_confirmed",
    incomeSource: "manual",
    aaaFactor: "1.0000",
    mdeClass: null,
    pensionReductionStatus: "not_requested",
    insignificantIncomeExemptionStatus: "not_requested",
    assistingSpouse: { enabled: false, qualifyingRelationship: false, mainActivity: false },
    ...overrides,
  };
}

function monthly(income: string, options: Partial<CcssSituation> = {}, parameters = june) {
  return calculateMonthlyCcss({ month: parameters.effectiveFrom, monthlyProfessionalIncome: income, situation: situation(options), parameters });
}

test("post-June 2026 reference fixture at SSM is rounded component by component", () => {
  const result = monthly("2771.33");
  assert.equal(result.principal.components.health.amountCents, 15519);
  assert.equal(result.principal.components.sicknessCash.amountCents, 1386);
  assert.equal(result.principal.components.pension.amountCents, 47113);
  assert.equal(result.principal.components.accident.amountCents, 1801);
  assert.equal(result.principal.components.dependency.amountCents, 2910);
  assert.equal(result.combinedTotalCents, 68729);
});

test("MDE class 2 adds the official rounded amount to the reference fixture", () => {
  const result = monthly("2771.33", { mdeClass: 2 });
  assert.equal(result.principal.components.mde.amountCents, 2633);
  assert.equal(result.combinedTotalCents, 71362);
});

test("principal income above SSM uses actual professional income", () => {
  const result = monthly("5000.00");
  assert.equal(result.principal.normalBaseCents, 500000);
  assert.equal(result.principal.minimumBinding, null);
});

test("ordinary risks cap at 5x SSM while dependency remains uncapped", () => {
  const result = monthly("20000.00");
  assert.equal(result.principal.normalBaseCents, 1385663);
  assert.equal(result.principal.maximumBinding, true);
  assert.equal(result.principal.dependencyBaseCents, 1930717);
  assert.equal(result.principal.components.dependency.amountCents, 27030);
});

test("secondary activity uses the one-third SSM ordinary minimum", () => {
  const result = monthly("100.00", { affiliationType: "secondary" });
  assert.equal(result.principal.normalBaseCents, 92378);
  assert.equal(result.principal.minimumBinding, "one_third_ssm");
});

test("dependency is never raised to either ordinary minimum", () => {
  const result = monthly("1000.00");
  assert.equal(result.principal.normalBaseCents, 277133);
  assert.equal(result.principal.dependencyBaseCents, 30717);
  assert.equal(result.principal.components.dependency.amountCents, 430);
});

test("income below the dependency allowance produces no dependency contribution", () => {
  assert.equal(monthly("500.00").principal.components.dependency.amountCents, 0);
});

test("pension reduction changes only the pension base and preserves other bases", () => {
  const result = monthly("1000.00", { pensionReductionStatus: "approved" });
  assert.equal(result.principal.normalBaseCents, 277133);
  assert.equal(result.principal.pensionBaseCents, 100000);
  assert.equal(result.principal.components.health.baseCents, 277133);
  assert.equal(result.principal.components.accident.baseCents, 277133);
  assert.equal(result.principal.pensionReductionApplied, true);
});

test("pension reduction cannot go below one-third SSM", () => {
  const result = monthly("500.00", { pensionReductionStatus: "requested" });
  assert.equal(result.principal.pensionBaseCents, 92378);
});

test("insignificant-income exemption only applies after explicit configuration", () => {
  const ordinary = monthly("500.00");
  const requested = monthly("500.00", { insignificantIncomeExemptionStatus: "requested" });
  const approved = monthly("500.00", { insignificantIncomeExemptionStatus: "approved" });
  assert.ok(ordinary.combinedTotalCents > 0);
  assert.ok(ordinary.principal.warnings.includes("insignificant_exemption_may_be_available"));
  assert.equal(requested.combinedTotalCents, 0);
  assert.equal(approved.combinedTotalCents, 0);
});

test("MDE is zero when disabled and uses each exact class rate when enabled", () => {
  assert.equal(monthly("2771.33").principal.components.mde.amountCents, 0);
  const expected = new Map([[1, 637], [2, 2633], [3, 4323], [4, 7372]]);
  for (const [mdeClass, amount] of expected) {
    assert.equal(monthly("2771.33", { mdeClass: mdeClass as 1 | 2 | 3 | 4 }).principal.components.mde.amountCents, amount);
  }
});

test("AAA factors multiply only the accident rate", () => {
  const expected = new Map([["0.8500", 1531], ["1.0000", 1801], ["1.1000", 1982], ["1.3000", 2342], ["1.5000", 2702]]);
  for (const [aaaFactor, accidentAmount] of expected) {
    const result = monthly("2771.33", { aaaFactor });
    assert.equal(result.principal.components.accident.amountCents, accidentAmount);
    assert.equal(result.principal.components.health.amountCents, 15519);
  }
});

test("Jan-May and June-December select their own exact minimums", () => {
  assert.equal(monthly("1000.00", {}, january).principal.normalBaseCents, 270374);
  assert.equal(monthly("1000.00", {}, june).principal.normalBaseCents, 277133);
});

test("annual calculation spans June indexation month by month", () => {
  const result = calculateAnnualCcss({
    year: 2026,
    annualProfessionalIncome: "12000.00",
    affiliationStartDate: "2026-01-01",
    situation: situation(),
    parameterPeriods: CCSS_2026_PARAMETER_PERIODS,
  });
  assert.equal(result.months.length, 12);
  assert.equal(result.parameterChanges.length, 1);
  assert.equal(result.parameterChanges[0], "2026-06-01");
  assert.equal(result.months[0].principal.normalBaseCents, 270374);
  assert.equal(result.months[5].principal.normalBaseCents, 277133);
  assert.equal(result.totalCents, result.months.reduce((total, month) => total + month.combinedTotalCents, 0));
});

test("months before affiliation remain inactive instead of manufacturing contributions", () => {
  const result = calculateAnnualCcss({
    year: 2026,
    annualProfessionalIncome: "33255.96",
    affiliationStartDate: "2026-03-10",
    situation: situation(),
    parameterPeriods: CCSS_2026_PARAMETER_PERIODS,
  });
  assert.equal(result.months[0].inactive, true);
  assert.equal(result.months[1].inactive, true);
  assert.equal(result.months[2].inactive, false);
});

test("assisting-spouse treatment is gated and caps the spouse allocation at 2x SSM", () => {
  const eligible = situation({ assistingSpouse: { enabled: true, qualifyingRelationship: true, mainActivity: true } });
  assert.equal(isAssistingSpouseEligible(eligible), true);
  const result = calculateMonthlyCcss({ month: "2026-06-01", monthlyProfessionalIncome: "12000.00", situation: eligible, parameters: june });
  assert.equal(result.assistingSpouse?.actualProfessionalIncomeCents, 554265);
  assert.equal(result.principal.actualProfessionalIncomeCents, 645735);
  assert.equal(result.combinedTotalCents, result.principal.totalCents + (result.assistingSpouse?.totalCents ?? 0));
});

test("a company spouse cannot use assisting-spouse treatment", () => {
  assert.throws(() => monthly("5000.00", {
    activityLegalForm: "company",
    incomeSource: "manager_remuneration",
    assistingSpouse: { enabled: true, qualifyingRelationship: true, mainActivity: true },
  }), /must not be calculated as an assisting spouse/);
});

test("manager/director income can never be sourced from corporate accounting profit", () => {
  assert.throws(() => monthly("5000.00", { affiliationType: "manager", activityLegalForm: "company", incomeSource: "accounting_proxy" }), /cannot use corporate accounting profit/);
});

test("tax class is technically absent from the CCSS input and cannot change a result", () => {
  const class1 = monthly("2771.33");
  const class2 = monthly("2771.33");
  assert.deepEqual(class1, class2);
});

test("monetary rounding is deterministic and half-up at the cent", () => {
  const result = monthly("2771.33", { mdeClass: 1 });
  assert.equal(result.principal.components.mde.amountCents, 637);
  assert.equal(multiplyByPercent(1n, "50.000000"), 1n);
});
