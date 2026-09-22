import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

function read(relativePath:string){
  return fs.readFileSync(path.join(import.meta.dirname, relativePath),"utf8");
}

test("document match confirmation uses the supported terminal extraction state",()=>{
  const migration=read("../db/migrations/20260922111800_fix_document_linking_constraint.sql");
  const extractionButton=read("../src/components/document-extraction-button.tsx");

  assert.match(migration,/when extraction_status = 'needs_review' then 'complete'/);
  assert.doesNotMatch(migration,/then 'reviewed'/);
  assert.match(extractionButton,/status==="complete"/);
});

test("document match actions keep confirmed evidence separate from bookkeeping mutation",()=>{
  const actions=read("../src/app/app/documents/actions.ts");
  const workflow=read("../src/components/document-workflow-actions.tsx");

  assert.match(actions,/confirm_document_match/);
  assert.match(actions,/apply_document_facts_to_transaction/);
  assert.match(workflow,/posted\?<form action=\{confirmAction\}/);
  assert.match(workflow,/Apply & link/);
});
