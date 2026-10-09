import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { readRawSource as readSource } from "./source-text.ts";

function read(relativePath: string) {
  return readSource(path.join(import.meta.dirname, relativePath));
}

test("company settings no longer duplicates profile security and team navigation cards", () => {
  const page = read("../src/app/app/settings/page.tsx");
  assert.doesNotMatch(page, /Profile & access/);
  assert.doesNotMatch(page, /My Profile/);
  assert.doesNotMatch(page, /Team & Access/);
  assert.match(page, /Business Settings/);
  assert.match(page, /Business details/);
});

test("registration guidance follows the fields instead of appearing as a warning card above them", () => {
  const form = read("../src/components/company-settings-form.tsx");
  const css = read("../src/app/app/settings/settings.module.css");
  const fieldIndex = form.indexOf('name="rcs_number"');
  const noteIndex = form.indexOf("registrationNote");
  assert.ok(fieldIndex >= 0);
  assert.ok(noteIndex > fieldIndex);
  assert.doesNotMatch(css, /\.registrationHint\s*\{/);
  assert.match(css, /\.registrationNote\s*\{/);
});

test("billing explains owner included professional and paid seat rules", () => {
  const page = read("../src/app/app/settings/billing/page.tsx");
  assert.match(page, /Seats, explained simply/);
  assert.match(page, /workspace owner, are included automatically/);
  assert.match(page, /first Accountant or Bookkeeper is also included/);
  assert.match(page, /Admin and Viewer team members also use paid-seat capacity/);
  assert.match(page, /€9\.99/);
  assert.match(page, /purchasedPaidSeats/);
  assert.match(page, /usedPaidSeats/);
  assert.match(page, /availablePaidSeats/);
  assert.match(page, /Manage team/);
});

test("billing uses visual subscription and seat layouts instead of summary tables", () => {
  const page = read("../src/app/app/settings/billing/page.tsx");
  const css = read("../src/app/app/settings/commerce.module.css");
  assert.match(page, /planHero/);
  assert.match(page, /seatWorkspace/);
  assert.match(page, /seatTile/);
  assert.match(page, /seatGuide/);
  assert.match(css, /\.planHero\s*\{/);
  assert.match(css, /\.seatWorkspace\s*\{/);
  assert.match(css, /\.seatTile\s*\{/);
  assert.match(css, /\.seatGuide\s*\{/);
});
