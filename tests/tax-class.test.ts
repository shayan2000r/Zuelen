import assert from "node:assert/strict";
import test from "node:test";
import { deriveResidentTaxClass, resolveDisplayedTaxClass, type PersonalFiscalFacts } from "../src/lib/personal-fiscal/tax-class.ts";

function facts(overrides: Partial<PersonalFiscalFacts> = {}): PersonalFiscalFacts {
  return {
    taxYear: 2026,
    residencyStatus: "resident",
    civilStatus: "single",
    civilStatusEventDate: null,
    qualifyingChildrenCount: 0,
    age64AtYearStart: false,
    taxationMode: "not_applicable",
    partnershipFullYearConditionsMet: false,
    legallyRecognizedSeparation: false,
    transitionalClass2UsedInPriorFiveYears: false,
    ...overrides,
  };
}

test("single residents derive class 1, 1a for a qualifying child, and 1a at age 64", () => {
  assert.equal(deriveResidentTaxClass(facts()).taxClass, "1");
  assert.equal(deriveResidentTaxClass(facts({ qualifyingChildrenCount: 1 })).taxClass, "1a");
  assert.equal(deriveResidentTaxClass(facts({ age64AtYearStart: true })).taxClass, "1a");
});

test("married joint taxation derives class 2 while individual modes use class 1 framework", () => {
  assert.equal(deriveResidentTaxClass(facts({ civilStatus: "married", taxationMode: "joint" })).taxClass, "2");
  assert.equal(deriveResidentTaxClass(facts({ civilStatus: "married", taxationMode: "individual", qualifyingChildrenCount: 1 })).taxClass, "1");
  assert.equal(deriveResidentTaxClass(facts({ civilStatus: "married", taxationMode: "individual_reallocation" })).taxClass, "1");
});

test("registered partners derive class 2 only for eligible full-year joint assessment", () => {
  const eligible = deriveResidentTaxClass(facts({ civilStatus: "registered_partnership", taxationMode: "joint", partnershipFullYearConditionsMet: true }));
  assert.equal(eligible.taxClass, "2");
  assert.equal(eligible.assessmentOnly, true);
  assert.equal(deriveResidentTaxClass(facts({ civilStatus: "registered_partnership", taxationMode: "joint", partnershipFullYearConditionsMet: false })).taxClass, "1");
});

test("widow transition covers the event year and three following years, then class 1a", () => {
  assert.equal(deriveResidentTaxClass(facts({ civilStatus: "widowed", civilStatusEventDate: "2024-04-10", taxYear: 2027 })).taxClass, "2");
  assert.equal(deriveResidentTaxClass(facts({ civilStatus: "widowed", civilStatusEventDate: "2024-04-10", taxYear: 2028 })).taxClass, "1a");
});

test("divorce and recognized separation transitions respect the prior-five-year safeguard", () => {
  assert.equal(deriveResidentTaxClass(facts({ civilStatus: "divorced", civilStatusEventDate: "2024-02-01", taxYear: 2027 })).taxClass, "2");
  assert.equal(deriveResidentTaxClass(facts({ civilStatus: "divorced", civilStatusEventDate: "2024-02-01", taxYear: 2027, transitionalClass2UsedInPriorFiveYears: true })).taxClass, "1");
  assert.equal(deriveResidentTaxClass(facts({ civilStatus: "separated", civilStatusEventDate: "2024-02-01", taxYear: 2027, legallyRecognizedSeparation: true })).taxClass, "2");
});

test("missing event facts and non-resident cases request confirmation", () => {
  assert.equal(deriveResidentTaxClass(facts({ civilStatus: "widowed" })).taxClass, "needs_confirmation");
  assert.equal(deriveResidentTaxClass(facts({ residencyStatus: "non_resident", civilStatus: "married", taxationMode: "joint" })).taxClass, "needs_confirmation");
});

test("ACD class or rate confirmation takes display precedence without changing derivation", () => {
  const derived = deriveResidentTaxClass(facts({ residencyStatus: "non_resident" }));
  assert.deepEqual(resolveDisplayedTaxClass({ derived, manualOverride: "2" }), { value: "2", source: "acd_override" });
  assert.deepEqual(resolveDisplayedTaxClass({ derived, acdTaxRatePercent: "12.5000" }), { value: "12.5000", source: "acd_rate" });
});
