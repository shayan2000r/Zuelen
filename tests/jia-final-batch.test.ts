import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

function read(relativePath:string){
  return fs.readFileSync(path.join(import.meta.dirname,relativePath),"utf8");
}

test("VAT page explains output VAT recoverable VAT and what still needs review",()=>{
  const page=read("../src/app/app/vat/page.tsx");
  assert.match(page,/What this page is telling you/);
  assert.match(page,/Output VAT/);
  assert.match(page,/Recoverable input VAT/);
  assert.match(page,/bank transaction on its own does not prove deductible VAT/);
  assert.match(page,/17%, 14%, 8% and 3%/);
});

test("CCSS page distinguishes estimates from official CCSS amounts",()=>{
  const page=read("../src/app/app/ccss/page.tsx");
  assert.match(page,/How to read this estimate/);
  assert.match(page,/planning estimate — not your CCSS invoice/);
  assert.match(page,/provisional-income adjustment/);
  assert.match(page,/Actual amounts due always come from your CCSS account statements/);
});

test("manual transaction creation optionally accepts an accounting category",()=>{
  const form=read("../src/components/source-transaction-form.tsx");
  const actions=read("../src/app/app/transactions/actions.ts");
  assert.match(form,/Accounting category · optional/);
  assert.match(form,/Let Zuelen suggest a category/);
  assert.match(actions,/selectedAccountCode/);
  assert.match(actions,/manual_selected/);
  assert.match(actions,/if\(!selectedAccount\)await supabase\.rpc\("apply_source_transaction_suggestion"/);
});

test("accountant directory explains discovery contact and workspace access",()=>{
  const page=read("../src/app/app/accountants/page.tsx");
  assert.match(page,/How the directory works/);
  assert.match(page,/Viewing or contacting a profile never gives them access/);
  assert.match(page,/Team & Access/);
  assert.match(page,/not an endorsement or a guarantee of service/);
});

test("foreign currency requires an explicit FX rate and posts journals in base currency",()=>{
  const form=read("../src/components/source-transaction-form.tsx");
  const actions=read("../src/app/app/transactions/actions.ts");
  const migration=read("../db/migrations/20260924170000_foreign_currency_audit_and_ai_guards.sql");
  assert.match(form,/Exchange rate · 1/);
  assert.match(form,/never assumes a 1:1 exchange rate/);
  assert.match(actions,/exchange_rate_to_base/);
  assert.match(migration,/original_currency/);
  assert.match(migration,/v_base_gross:=round\(v_tx\.amount_gross\*v_fx,2\)/);
  assert.match(migration,/v_base_currency/);
});

test("foreign currency also works for invoices and settlements",()=>{
  const composer=read("../src/components/invoice-composer.tsx");
  const actions=read("../src/app/app/invoices/actions.ts");
  const payments=read("../src/components/invoice-payment-panel.tsx");
  const migration=read("../db/migrations/20260924173000_invoice_foreign_currency.sql");
  assert.match(composer,/Invoice currency/);
  assert.match(composer,/Exchange rate · 1/);
  assert.match(composer,/never assumes 1:1/);
  assert.match(actions,/p_exchange_rate_to_base/);
  assert.match(payments,/Payment-date rate/);
  assert.match(payments,/FX gain or loss automatically/);
  assert.match(migration,/Foreign exchange gain/);
  assert.match(migration,/Foreign exchange loss/);
  assert.match(migration,/original_currency/);
  assert.match(migration,/upper\(trim\(currency\)\)=upper\(trim\(v\.currency\)\)/);
});

test("transaction audit history is visible and records creation posting and FX changes",()=>{
  const page=read("../src/app/app/transactions/page.tsx");
  const action=read("../src/components/transaction-history-action.tsx");
  const migration=read("../db/migrations/20260924170000_foreign_currency_audit_and_ai_guards.sql");
  assert.match(page,/audit_events/);
  assert.match(page,/historyByTransaction/);
  assert.match(action,/Transaction history/);
  assert.match(action,/Posted accounting is never silently overwritten/);
  assert.match(migration,/source_transaction\.created/);
  assert.match(migration,/source_transaction\.posted/);
  assert.match(migration,/source_transaction\.exchange_rate_set/);
});

test("AI document type conflicts stop automatic transaction creation until resolved",()=>{
  const actions=read("../src/app/app/documents/actions.ts");
  const uploader=read("../src/components/document-uploader.tsx");
  const migration=read("../db/migrations/20260924170000_foreign_currency_audit_and_ai_guards.sql");
  assert.match(actions,/bank_statement/);
  assert.match(actions,/typeSafeguard/);
  assert.match(actions,/oppositeInvoice/);
  assert.match(actions,/multiStatement/);
  assert.match(uploader,/AI safety check/);
  assert.match(uploader,/Confirm document type/);
  assert.match(uploader,/Keep my selection/);
  assert.match(migration,/Confirm the document type before creating a transaction/);
});
