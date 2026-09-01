import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const controls=readFileSync("src/components/accounting-year-controls.tsx","utf8");
const documentsPage=readFileSync("src/app/app/documents/page.tsx","utf8");
const documentActions=readFileSync("src/app/app/documents/actions.ts","utf8");

test("opening-position action is rendered only before an opening is posted",()=>{
 assert.match(controls,/!openingPosted\?<button[^>]+className=\{styles\.primary\}/);
});

test("posted opening sources hide generic re-analysis and are protected server-side",()=>{
 assert.match(documentsPage,/aiSupported&&!openingSource/);
 assert.match(documentActions,/openingImportStatus\(doc\.extracted_data\)===\"posted\"/);
});

test("document library does not expose extraction confidence",()=>{
 assert.doesNotMatch(documentsPage,/%.*confidence|confidence.*%/i);
});
