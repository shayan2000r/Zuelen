import assert from "node:assert/strict";
import test from "node:test";
import {
  computeVatReturn,
  type VatCompanyProfile,
  type VatPurchase,
  type VatSale,
} from "../src/lib/vat-return/compute.ts";

const full: VatCompanyProfile = {
  vatRegistered: true,
  exemptionBasis: null,
  deductionMode: "full",
  deductionRatio: null,
};
let n = 0;
const sale = (s: Partial<VatSale>): VatSale => ({
  id: `s${++n}`,
  source: "transaction",
  label: "sale",
  date: "2026-03-10",
  treatment: "domestic",
  country: "LU",
  rate: 17,
  base: 0,
  vat: 0,
  accountCode: "7033",
  ...s,
});
const purchase = (p: Partial<VatPurchase>): VatPurchase => ({
  id: `p${++n}`,
  label: "purchase",
  date: "2026-03-10",
  treatment: "domestic",
  country: "LU",
  rate: 17,
  base: 0,
  vat: 0,
  accountCode: "6132",
  ...p,
});

test("monthly return: sales by rate, EU services, reverse charge from the EU and from outside the EU", () => {
  const { boxes, issues } = computeVatReturn({
    form: "DECM",
    company: full,
    sales: [
      sale({ source: "invoice", base: 1000, vat: 170 }),
      sale({ rate: 8, base: 100, vat: 8 }),
      sale({ source: "invoice", treatment: "eu_b2b_reverse_charge", country: "FR", rate: 0, base: 2000 }),
    ],
    purchases: [
      purchase({ base: 200, vat: 34 }),
      purchase({ treatment: "eu_b2b_reverse_charge", country: "DE", base: 500, vat: 85 }),
      purchase({ treatment: "eu_b2b_reverse_charge", country: "US", base: 100, vat: 17 }),
      purchase({ treatment: "non_eu", country: "CH", rate: null, base: 100, vat: 8.1 }),
    ],
  });
  assert.deepEqual(issues, []);
  const expected: Record<string, number> = {
    "701": 1000,
    "702": 170,
    "705": 100,
    "706": 8,
    "472": 3100,
    "454": 3100,
    "012": 3100,
    "423": 2000,
    "021": 2000,
    "022": 1100,
    "037": 1100,
    "046": 178,
    "741": 500,
    "742": 85,
    "436": 500,
    "462": 85,
    "751": 100,
    "752": 17,
    "463": 100,
    "464": 17,
    "409": 600,
    "410": 102,
    "076": 280,
    "458": 34,
    "461": 102,
    "093": 136,
    "097": 0,
    "102": 136,
    "103": 280,
    "104": 136,
    "105": 144,
  };
  for (const [box, amount] of Object.entries(expected)) assert.equal(boxes[box] ?? 0, amount, `box ${box}`);
  assert.equal(boxes["022"], boxes["037"], "taxable turnover equals the breakdown by rate");
});

test("non-deductible input VAT goes to 095 (pro-rata) or 094 (exempt activity)", () => {
  const partial = computeVatReturn({
    form: "DECM",
    company: { ...full, deductionMode: "partial", deductionRatio: 60 },
    sales: [],
    purchases: [
      purchase({ base: 1000, vat: 170 }),
      purchase({ treatment: "eu_b2b_reverse_charge", country: "IE", base: 1000, vat: 170 }),
    ],
  }).boxes;
  assert.equal(partial["093"], 340);
  assert.equal(partial["095"], 136);
  assert.equal(partial["102"], 204);
  assert.equal(partial["105"], 170 - 204);
  const exempt = computeVatReturn({
    form: "DECM",
    company: { ...full, exemptionBasis: "exempt_activity", deductionMode: "none" },
    sales: [sale({ rate: 0, base: 5000 })],
    purchases: [purchase({ base: 100, vat: 17 })],
  }).boxes;
  assert.equal(exempt["016"], 5000);
  assert.equal(exempt["022"], 0);
  assert.equal(exempt["094"], 17);
  assert.equal(exempt["102"], 0);
});

test("intra-Community acquisition of goods: 051/056 and 459", () => {
  const { boxes } = computeVatReturn({
    form: "DECT",
    company: full,
    sales: [],
    purchases: [purchase({ treatment: "eu_acquisition", country: "NL", base: 200, vat: 34, accountCode: "606" })],
  });
  assert.equal(boxes["711"], 200);
  assert.equal(boxes["712"], 34);
  assert.equal(boxes["051"], 200);
  assert.equal(boxes["056"], 34);
  assert.equal(boxes["459"], 34);
  assert.equal(boxes["105"], 0);
});

test("annual return splits turnover by branch and input VAT by type of expense", () => {
  const { boxes, issues } = computeVatReturn({
    form: "DECA",
    company: full,
    sales: [
      sale({ source: "invoice", base: 1000, vat: 170 }),
      sale({ base: 500, vat: 85, accountCode: "706" }),
      sale({ treatment: "eu_b2b_reverse_charge", country: "BE", rate: 0, base: 300, accountCode: "706" }),
    ],
    purchases: [
      purchase({ base: 1000, vat: 170, accountCode: "2232" }),
      purchase({ base: 100, vat: 17, accountCode: "606" }),
      purchase({ base: 50, vat: 8.5, accountCode: "6132" }),
      purchase({ treatment: "eu_b2b_reverse_charge", country: "DE", base: 200, vat: 34, accountCode: "6132" }),
    ],
  });
  assert.deepEqual(issues, []);
  assert.equal(boxes["004"], 1000);
  assert.equal(boxes["002"], 800);
  assert.equal(boxes["012"], 1800);
  assert.equal(boxes["013"], 300);
  assert.equal(boxes["457"], undefined);
  assert.equal(boxes["081"], 170);
  assert.equal(boxes["077"], 17);
  assert.equal(boxes["085"], 8.5);
  assert.equal(boxes["406"], 34);
  assert.equal(boxes["093"], 229.5);
  assert.equal(boxes["102"], 229.5);
  assert.equal(boxes["076"], 289);
});

test("items the books cannot place are reported, not guessed", () => {
  const { boxes, issues } = computeVatReturn({
    form: "DECM",
    company: full,
    sales: [
      sale({ rate: 0, base: 400 }),
      sale({ treatment: "non_eu", country: "US", rate: 0, base: 900 }),
      sale({ treatment: "unknown", base: 50 }),
    ],
    purchases: [purchase({ treatment: "eu_b2b_reverse_charge", country: null, base: 100, vat: 17 })],
  });
  assert.deepEqual(
    issues.map(i => i.code),
    ["zero_rate_sale", "sale_abroad_unclear", "unknown_treatment", "country_missing"],
  );
  assert.equal(boxes["012"], 0);
  assert.equal(boxes["093"], 0);
});

test("franchise business: turnover in 481, nothing deductible", () => {
  const { boxes } = computeVatReturn({
    form: "DECA",
    company: { vatRegistered: false, exemptionBasis: "franchise", deductionMode: "full", deductionRatio: null },
    sales: [sale({ source: "invoice", rate: 0, base: 30000 })],
    purchases: [],
  });
  assert.equal(boxes["481"], 30000);
  assert.equal(boxes["022"], 0);
  assert.equal(boxes["105"], 0);
});

test("services to a business outside the EU are supplied abroad (019); exports of goods are 014", () => {
  const { boxes } = computeVatReturn({
    form: "DECM",
    company: full,
    sales: [
      sale({ source: "invoice", treatment: "eu_b2b_reverse_charge", country: "US", rate: 0, base: 700 }),
      sale({ treatment: "non_eu", country: "CH", rate: 0, base: 250, accountCode: "706" }),
    ],
    purchases: [],
  });
  assert.equal(boxes["019"], 700);
  assert.equal(boxes["014"], 250);
  assert.equal(boxes["022"], 0);
});
