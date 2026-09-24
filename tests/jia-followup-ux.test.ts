import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

function read(relativePath:string){
  return fs.readFileSync(path.join(import.meta.dirname,relativePath),"utf8");
}

test("pending transaction rows open the exact review item with a loading state",()=>{
  const page=read("../src/app/app/transactions/page.tsx");
  const table=read("../src/components/transaction-table.tsx");
  const css=read("../src/components/transaction-table.module.css");

  assert.match(page,/review\?:string/);
  assert.match(page,/requestedReview/);
  assert.match(page,/focusedId=\{focusedId\}/);
  assert.match(table,/function openReview\(id:string\)/);
  assert.match(table,/params\.set\("review",id\)/);
  assert.match(table,/Loading…/);
  assert.match(table,/tabIndex=\{reviewable\?0:undefined\}/);
  assert.match(css,/\.focusedRow/);
  assert.match(css,/\.reviewableRow/);
});

test("evidence can be attached directly from a transaction without rewriting accounting",()=>{
  const actions=read("../src/app/app/transactions/actions.ts");
  const evidence=read("../src/components/transaction-evidence-action.tsx");
  const rowActions=read("../src/components/transaction-row-actions.tsx");

  assert.match(actions,/attachEvidenceToTransactionAction/);
  assert.match(actions,/company-documents/);
  assert.match(actions,/document_transaction_links/);
  assert.match(actions,/match_score:1/);
  assert.match(actions,/confirm_document_match/);
  assert.match(evidence,/View the documents already linked to this transaction/);
  assert.match(evidence,/Attached evidence/);
  assert.match(evidence,/\/app\/documents\/.*\/open/);
  assert.match(evidence,/Adding evidence never changes the accounting entry itself/);
  assert.match(rowActions,/TransactionEvidenceAction/);
  assert.match(rowActions,/evidence=\{row\.evidence\?\?\[\]\}/);
});

test("business details are grouped by user intent instead of one long legal form",()=>{
  const settings=read("../src/app/app/settings/page.tsx");
  const form=read("../src/components/company-settings-form.tsx");
  const css=read("../src/app/app/settings/settings.module.css");

  assert.match(settings,/Profile & access/);
  assert.match(settings,/Business details/);
  assert.match(form,/Business Identity/);
  assert.match(form,/Registrations & Identifiers/);
  assert.match(form,/Business Address|Registered Office/);
  assert.match(form,/Accounting & VAT/);
  assert.match(form,/Advanced settings/);
  assert.match(form,/Leaving a field blank does not block Zuelen/);
  assert.match(form,/RCS and business-permit details do not apply in every situation/);
  assert.match(css,/\.businessDetailsIntro/);
  assert.match(css,/\.advancedDetails/);
});


test("linked evidence is visible from Documents and navigates back to its transaction",()=>{
  const documents=read("../src/app/app/documents/page.tsx");
  const css=read("../src/components/documents.module.css");

  assert.match(documents,/match_reason/);
  assert.match(documents,/Evidence attached directly/);
  assert.match(documents,/Linked evidence/);
  assert.match(documents,/transactionHref/);
  assert.match(documents,/focus=\$\{match\.source_transaction_id\}/);
  assert.match(css,/\.linkedEvidenceTag/);
  assert.match(css,/\.transactionLink/);
});
