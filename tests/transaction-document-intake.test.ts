import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

function read(relativePath:string){
  return fs.readFileSync(path.join(import.meta.dirname, relativePath),"utf8");
}

test("transaction document intake creates a review transaction and links its evidence",()=>{
  const migration=read("../db/migrations/20260922114500_transaction_document_intake.sql");
  const uploader=read("../src/components/document-uploader.tsx");
  const actions=read("../src/app/app/transactions/actions.ts");

  assert.match(migration,/source_type='document'/);
  assert.match(migration,/classification_status/);
  assert.match(migration,/'review'/);
  assert.match(migration,/upper\(st\.currency\)=v_currency/);
  assert.match(migration,/perform public\.confirm_document_match\(v_link_id\)/);
  assert.match(uploader,/createTransactionFromDocumentAction\(inserted\.id\)/);
  assert.match(uploader,/TransactionUploadReview/);
  assert.match(uploader,/postSourceTransaction/);
  assert.match(actions,/create_source_transaction_from_document/);
});

test("document extraction asks for the underlying transaction counterparty",()=>{
  const actions=read("../src/app/app/documents/actions.ts");
  assert.match(actions,/transaction_counterparty/);
  assert.match(actions,/transaction_direction/);
  assert.match(actions,/do not use the bank or payment provider as the counterparty/);
});

test("invoice compliance stays inline and does not open an issue confirmation dialog",()=>{
  const composer=read("../src/components/invoice-composer.tsx");
  const recordActions=read("../src/components/invoice-record-actions.tsx");

  assert.match(composer,/Compliance check/);
  assert.doesNotMatch(composer,/confirmCompliance/);
  assert.doesNotMatch(composer,/Issue the invoice anyway/);
  assert.doesNotMatch(recordActions,/Issue the invoice anyway/);
});


test("document-origin transactions are valid journal sources and preserve the merchant",()=>{
  const migration=read("../db/migrations/20260922185800_fix_document_transaction_posting.sql");
  assert.match(migration,/'document'::text/);
  assert.match(migration,/transaction_counterparty/);
  assert.match(migration,/counterparty_name=coalesce\(v_counterparty,counterparty_name\)/);
});

test("confirmed document links render as linked instead of showing Apply & link again",()=>{
  const workflow=read("../src/components/document-workflow-actions.tsx");
  const page=read("../src/app/app/documents/page.tsx");
  assert.match(workflow,/status==="confirmed"/);
  assert.match(workflow,/>Linked</);
  assert.match(page,/status=\{match\?\.status\}/);
});


test("transaction intake trusts the user-selected receipt category over AI document kind",()=>{
  const migration=read("../db/migrations/20260922190500_respect_transaction_upload_category.sql");
  assert.match(migration,/v_doc\.type not in \('receipt','purchase_invoice','sales_invoice'\)/);
  assert.match(migration,/v_kind='bank_statement'/);
  assert.match(migration,/v_line_count=1/);
  assert.doesNotMatch(migration,/This document type cannot create a transaction automatically/);
});
