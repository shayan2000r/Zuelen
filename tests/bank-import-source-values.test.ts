import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration=readFileSync("db/migrations/20260901163000_bank_import_sources.sql","utf8");
const bankingAction=readFileSync("src/app/app/banking/actions.ts","utf8");

test("bank import constraint accepts every application ingestion value",()=>{
 for(const value of ["csv","xlsx","pdf_ai"]){
  assert.match(migration,new RegExp(`['\"]${value}['\"]`));
  assert.match(bankingAction,new RegExp(`${value}`));
 }
});

test("bank classification is deferred until after the import response",()=>{
 assert.match(bankingAction,/\bafter\s*\(/);
 assert.match(bankingAction,/scheduleBankClassification/);
});
