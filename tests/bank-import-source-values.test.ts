import test from "node:test";
import assert from "node:assert/strict";
import { readSource } from "./source-text.ts";

const migration = readSource("db/archive/pre-baseline-migrations/20260901163000_bank_import_sources.sql");
const bankingAction = readSource("src/app/app/banking/actions.ts");

test("bank import constraint accepts every application ingestion value", () => {
  for (const value of ["csv", "xlsx", "pdf_ai"]) {
    assert.match(migration, new RegExp(`['\"]${value}['\"]`));
    assert.match(bankingAction, new RegExp(`${value}`));
  }
});

test("bank classification is deferred until after the import response", () => {
  assert.match(bankingAction, /\bafter\s*\(/);
  assert.match(bankingAction, /scheduleBankClassification/);
});
