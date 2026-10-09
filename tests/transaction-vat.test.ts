import assert from "node:assert/strict";
import test from "node:test";
import { computeTransactionVat, type TransactionVatInput } from "../src/lib/tax-rules/transaction-vat.ts";

const base: TransactionVatInput = {
  amount: 117,
  rate: 17,
  included: true,
  treatment: "domestic",
  direction: "expense",
  occurredOn: "2026-05-01",
  vatRegistered: true,
};

test("Luxembourg VAT is split from a gross or a net amount", () => {
  assert.deepEqual(computeTransactionVat(base), {
    ok: true,
    gross: 117,
    net: 100,
    storedNet: 100,
    vat: 17,
    rate: 17,
    treatment: "domestic",
    selfAssessed: false,
  });
  const fromNet = computeTransactionVat({ ...base, amount: 100, included: false });
  assert.equal(fromNet.ok && fromNet.gross, 117);
});

test("rates are checked against the transaction date", () => {
  assert.deepEqual(computeTransactionVat({ ...base, rate: 16 }), { ok: false, error: "rate" });
  const in2023 = computeTransactionVat({ ...base, amount: 116, rate: 16, occurredOn: "2023-06-01" });
  assert.equal(in2023.ok && in2023.vat, 16);
  assert.deepEqual(computeTransactionVat({ ...base, occurredOn: "2023-06-01" }), { ok: false, error: "rate" });
});

test("an EU purchase self-assesses VAT on the amount paid, with no separate net amount", () => {
  const result = computeTransactionVat({ ...base, amount: 1000, treatment: "eu_b2b_reverse_charge" });
  assert.deepEqual(result, {
    ok: true,
    gross: 1000,
    net: 1000,
    storedNet: null,
    vat: 170,
    rate: 17,
    treatment: "eu_b2b_reverse_charge",
    selfAssessed: true,
  });
  const goods = computeTransactionVat({ ...base, amount: 200, treatment: "eu_acquisition" });
  assert.equal(goods.ok && goods.vat, 34);
  assert.deepEqual(computeTransactionVat({ ...base, rate: 0, treatment: "eu_b2b_reverse_charge" }), {
    ok: false,
    error: "reverse_charge_rate",
  });
});

test("a sale to an EU business customer carries no Luxembourg VAT", () => {
  const result = computeTransactionVat({
    ...base,
    amount: 1000,
    direction: "income",
    treatment: "eu_b2b_reverse_charge",
  });
  assert.equal(result.ok && result.vat, 0);
  assert.equal(result.ok && result.gross, 1000);
  assert.deepEqual(computeTransactionVat({ ...base, direction: "income", treatment: "eu_acquisition" }), {
    ok: false,
    error: "treatment",
  });
});

test("no VAT is recorded for imports, exempt items or an unconfirmed treatment", () => {
  for (const treatment of ["non_eu", "exempt_or_zero", "outside_scope", "unknown"]) {
    const result = computeTransactionVat({ ...base, treatment });
    assert.equal(result.ok && result.vat, 0, treatment);
    assert.equal(result.ok && result.gross, 117, treatment);
  }
});

test("a business that is not VAT registered can pay VAT but cannot charge it", () => {
  const purchase = computeTransactionVat({ ...base, vatRegistered: false });
  assert.equal(purchase.ok && purchase.vat, 17);
  assert.deepEqual(computeTransactionVat({ ...base, direction: "income", vatRegistered: false }), {
    ok: false,
    error: "income_vat_not_registered",
  });
  const exemptSale = computeTransactionVat({ ...base, direction: "income", vatRegistered: false, rate: 0 });
  assert.equal(exemptSale.ok && exemptSale.vat, 0);
});

test("invalid amounts and treatments are refused", () => {
  assert.deepEqual(computeTransactionVat({ ...base, amount: 0 }), { ok: false, error: "amount" });
  assert.deepEqual(computeTransactionVat({ ...base, amount: Number.NaN }), { ok: false, error: "amount" });
  assert.deepEqual(computeTransactionVat({ ...base, treatment: "made_up" }), { ok: false, error: "treatment" });
});
