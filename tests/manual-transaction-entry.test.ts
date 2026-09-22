import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

function read(relativePath:string){
  return fs.readFileSync(path.join(import.meta.dirname,relativePath),"utf8");
}

test("manual entry asks for business facts before accounting details",()=>{
  const form=read("../src/components/source-transaction-form.tsx");
  assert.match(form,/Manual entry · Step 1 of 2/);
  assert.match(form,/Total paid/);
  assert.match(form,/Paid to/);
  assert.match(form,/What was it for\?/);
  assert.match(form,/VAT details/);
  assert.match(form,/Optional · skip if you don't know/);
  assert.match(form,/value="unknown"/);
  assert.match(form,/Continue to category/);
});

test("manual entry uses the same category confirmation step before posting",()=>{
  const form=read("../src/components/source-transaction-form.tsx");
  const review=read("../src/components/transaction-upload-review.tsx");
  assert.match(form,/source="manual"/);
  assert.match(form,/postSourceTransaction/);
  assert.match(review,/Add transaction/);
  assert.match(review,/Change category/);
  assert.match(review,/manual\?\(fr\?"Annuler":"Cancel"\)/);
  assert.match(review,/never guesses VAT from a manual entry/);
});

test("closing a prepared manual entry discards its draft",()=>{
  const form=read("../src/components/source-transaction-form.tsx");
  const actions=read("../src/app/app/transactions/actions.ts");
  assert.match(form,/discardManualSourceTransactionAction/);
  assert.match(actions,/source_type!=="manual"/);
  assert.match(actions,/classification_status==="posted"/);
});

test("manual transaction modal follows light and dark theme tokens",()=>{
  const css=read("../src/components/live.module.css");
  assert.match(css,/\.formPanel\{background:var\(--z-surface-1\);color:var\(--z-text\)/);
  assert.match(css,/\.drawerClose\{[^}]*background:var\(--z-surface-2\);color:var\(--z-text\)/);
  assert.match(css,/\.field input,.field select,.field textarea\{[^}]*background:var\(--z-surface-2\);color:var\(--z-text\)/);
});
