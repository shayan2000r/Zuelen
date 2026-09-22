import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

function read(relativePath:string){
  return fs.readFileSync(path.join(import.meta.dirname,relativePath),"utf8");
}

test("technical backend errors are filtered before reaching accounting UI",()=>{
  const sanitizer=read("../src/lib/public-error-message.ts");
  const transactions=read("../src/app/app/transactions/actions.ts");
  const documents=read("../src/app/app/documents/actions.ts");
  const uploader=read("../src/components/document-uploader.tsx");
  const boundary=read("../src/app/app/error.tsx");

  assert.match(sanitizer,/violates .*constraint/);
  assert.match(sanitizer,/PGRST/);
  assert.match(transactions,/userFacingDataError/);
  assert.match(documents,/userFacingDataError/);
  assert.match(uploader,/sanitizePublicErrorMessage/);
  assert.doesNotMatch(transactions,/message:error\.message/);
  assert.doesNotMatch(documents,/message:error\.message/);
  assert.doesNotMatch(boundary,/error\.message/);
});

test("document matching requires the same currency when currency is known",()=>{
  const migration=read("../db/migrations/20260922192500_currency_safe_document_matching.sql");
  assert.match(migration,/v_currency:=upper/);
  assert.match(migration,/upper\(st\.currency\)=v_currency/);
  assert.match(migration,/Matched using currency, amount, date and counterparty evidence/);
});

test("transaction review states explain the required user input",()=>{
  const card=read("../src/components/transaction-review-card.tsx");
  const table=read("../src/components/transaction-table.tsx");
  const page=read("../src/app/app/transactions/page.tsx");

  assert.match(card,/Accounting category required/);
  assert.match(card,/Confirm accounting category/);
  assert.match(card,/before it can be posted/);
  assert.match(table,/Category needed/);
  assert.match(table,/Confirm category/);
  assert.match(page,/Needs Input/);
  assert.match(page,/Choose or confirm the accounting category/);
});
