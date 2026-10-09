import assert from "node:assert/strict";
import test from "node:test";
import {
  closestVatRate,
  franchiseStatus,
  isVatRateAllowed,
  standardVatRateOn,
  vatRatesOn,
} from "../src/lib/tax-rules/vat.ts";
import { corporateIncomeTax, minimumNetWealthTax, municipalBusinessTax } from "../src/lib/tax-rules/corporate.ts";

test("VAT rates follow the supply date, including the temporary 2023 rates", () => {
  assert.deepEqual(vatRatesOn("2026-05-01"), [17, 14, 8, 3, 0]);
  assert.deepEqual(vatRatesOn("2023-06-30"), [16, 13, 7, 3, 0]);
  assert.deepEqual(vatRatesOn("2022-12-31"), [17, 14, 8, 3, 0]);
  assert.deepEqual(vatRatesOn("2024-01-01"), [17, 14, 8, 3, 0]);
  assert.equal(standardVatRateOn("2023-03-01"), 16);
  assert.equal(isVatRateAllowed(17, "2023-03-01"), false);
  assert.equal(isVatRateAllowed(16, "2025-03-01"), false);
  assert.equal(closestVatRate(16.6, "2026-01-10"), 17);
  assert.equal(closestVatRate(7.2, "2023-01-10"), 7);
});

test("small-business franchise: EUR 50,000 from 2025 with a 10 % tolerance", () => {
  assert.deepEqual(franchiseStatus(30000, 2026), { state: "below", threshold: 50000, remaining: 20000 });
  assert.equal(franchiseStatus(40000, 2026).state, "approaching");
  assert.deepEqual(franchiseStatus(51000, 2025), { state: "tolerance", threshold: 50000, limit: 55000 });
  assert.equal(franchiseStatus(56000, 2025).state, "exceeded");
  assert.equal(franchiseStatus(36000, 2024).state, "exceeded");
  assert.equal(franchiseStatus(10000, 2019).state, "unknown_year");
});

test("corporate income tax scale by tax year", () => {
  assert.equal(corporateIncomeTax(100000, 2026), 14000);
  assert.equal(corporateIncomeTax(175000, 2025), 24500);
  assert.equal(corporateIncomeTax(190000, 2025), 24500 + 15000 * 0.3);
  assert.equal(corporateIncomeTax(300000, 2026), 48000);
  assert.equal(corporateIncomeTax(100000, 2024), 15000);
  assert.equal(corporateIncomeTax(300000, 2023), 51000);
  assert.equal(corporateIncomeTax(-5, 2026), 0);
  assert.equal(corporateIncomeTax(100000, 2027), null, "no confirmed scale for 2027 yet");
});

test("municipal business tax and minimum net wealth tax", () => {
  assert.equal(municipalBusinessTax(117500, 2.25), 100000 * 0.03 * 2.25);
  assert.equal(municipalBusinessTax(10000, 2.25), 0);
  assert.equal(minimumNetWealthTax(350000, 2026), 535);
  assert.equal(minimumNetWealthTax(350001, 2026), 1605);
  assert.equal(minimumNetWealthTax(2000001, 2025), 4815);
  assert.equal(minimumNetWealthTax(100000, 2024), null);
});

test("CCSS 2026 parameters match the IGSS / CCSS publications", async () => {
  const { CCSS_2026_PARAMETER_PERIODS } = await import("../src/lib/ccss/parameters.ts");
  const [january, june] = CCSS_2026_PARAMETER_PERIODS;
  // IGSS, Paramètres sociaux 01.01.2026 (index 968.04) and 01.06.2026 (index 992.24)
  assert.equal(january.ssm, "2703.74");
  assert.equal(january.dependencyAllowance, "675.93");
  assert.equal(january.maximumContributionBase, "13518.68");
  assert.equal(june.ssm, "2771.33");
  assert.equal(june.dependencyAllowance, "692.83");
  assert.equal(june.maximumContributionBase, "13856.63");
  // CCSS, Avis aux non-salariés, taux au 01.01.2026
  assert.equal(january.pensionRate, "17.000000");
  assert.equal(january.healthRate, "5.600000");
  assert.equal(january.accidentBaseRate, "0.650000");
});
