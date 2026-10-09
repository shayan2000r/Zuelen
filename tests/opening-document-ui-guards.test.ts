import test from "node:test";
import assert from "node:assert/strict";
import { readSource } from "./source-text.ts";

const controls = readSource("src/components/accounting-year-controls.tsx");
const documentsPage = readSource("src/app/app/documents/page.tsx");
const documentActions = readSource("src/app/app/documents/actions.ts");

test("opening-position action is rendered only before an opening is posted", () => {
  assert.match(controls, /!openingPosted\?<button[^>]+className=\{styles\.primary\}/);
});

test("posted opening sources hide generic re-analysis and are protected server-side", () => {
  assert.match(documentsPage, /aiSupported&&!openingSource/);
  assert.match(documentActions, /openingImportStatus\(doc\.extracted_data\)===\"posted\"/);
});

test("document library does not expose extraction confidence", () => {
  assert.doesNotMatch(documentsPage, /%.*confidence|confidence.*%/i);
});
