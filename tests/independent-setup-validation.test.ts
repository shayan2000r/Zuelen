import assert from "node:assert/strict";
import test from "node:test";
import { validateIndependentSetup } from "../src/lib/independent-setup-validation.ts";

function validForm() {
  const form = new FormData();
  const values: Record<string, string> = {
    personal_legal_name: "Alex Martin",
    activity_description: "Independent advisory services",
    activity_category: "consultant_freelancer",
    activity_start_date: "2026-01-01",
    location: "Luxembourg",
    tax_year: "2026",
    residency_status: "resident",
    civil_status: "single",
    qualifying_children_count: "0",
    taxation_mode: "not_applicable",
    affiliation_type: "principal",
    estimated_annual_professional_income: "33255.96",
    aaa_factor: "1.0000",
    mde_membership: "not_affiliated",
    accounting_start_date: "2026-01-01",
    opening_cash_amount: "0",
  };
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

test("accepts a complete independent setup", () => {
  const result = validateIndependentSetup(validForm());
  assert.equal(result.ok, true);
});

test("normalizes French decimal separators without weakening amount checks", () => {
  const form = validForm();
  form.set("estimated_annual_professional_income", "33 255,96");
  form.set("opening_cash_amount", "1 250,50");
  const result = validateIndependentSetup(form);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.annualIncome, "33255.96");
    assert.equal(result.openingCash, "1250.50");
  }
});

test("returns users to CCSS when required income is missing", () => {
  const form = validForm();
  form.delete("estimated_annual_professional_income");
  assert.deepEqual(validateIndependentSetup(form), {
    ok: false,
    step: 5,
    message: "Review the required CCSS information. / Vérifiez les informations CCSS obligatoires.",
  });
});

test("returns users to opening position for an invalid calendar date", () => {
  const form = validForm();
  form.set("accounting_start_date", "2026-02-31");
  const result = validateIndependentSetup(form);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.step, 6);
});
