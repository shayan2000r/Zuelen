import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { chooseContextDestination } from "../src/lib/context-destination.ts";
import { safeInternalDestination } from "../src/lib/safe-navigation.ts";
import { getWorkspaceCapabilities } from "../src/lib/workspace-capabilities.ts";
import { selectActiveWorkspace } from "../src/lib/workspace-selection.ts";

test("single accessible workspace is the deterministic fallback", () => {
  const only = { companyId:"owned", label:"Owned" };
  assert.equal(selectActiveWorkspace([only], null), only);
  assert.equal(selectActiveWorkspace([only], "spoofed"), only);
});

test("an unvalidated ID cannot select from multiple workspaces", () => {
  const accessible = [{ companyId:"one" }, { companyId:"two" }];
  assert.equal(selectActiveWorkspace(accessible, "outside-org"), null);
  assert.equal(selectActiveWorkspace(accessible, "two"), accessible[1]);
});

test("post-login routing honors economic and professional context without creating an account type", () => {
  assert.equal(chooseContextDestination({ hasActiveEconomicWorkspace:true, economicWorkspaceCount:2, hasProfessionalProfile:true }), "/app");
  assert.equal(chooseContextDestination({ hasActiveEconomicWorkspace:false, economicWorkspaceCount:2, hasProfessionalProfile:false }), "/contexts");
  assert.equal(chooseContextDestination({ hasActiveEconomicWorkspace:false, economicWorkspaceCount:1, hasProfessionalProfile:true }), "/contexts");
  assert.equal(chooseContextDestination({ hasActiveEconomicWorkspace:false, economicWorkspaceCount:0, hasProfessionalProfile:true }), "/professional");
  assert.equal(chooseContextDestination({ hasActiveEconomicWorkspace:false, economicWorkspaceCount:0, hasProfessionalProfile:false }), "/setup");
});

test("invitation and deep-link destinations are restricted to safe internal paths", () => {
  assert.equal(safeInternalDestination("/app/invite/abc?next=1"), "/app/invite/abc?next=1");
  assert.equal(safeInternalDestination("https://evil.example"), null);
  assert.equal(safeInternalDestination("//evil.example"), null);
  assert.equal(safeInternalDestination("/\\evil.example"), null);
  assert.equal(safeInternalDestination("/auth/resolve"), null);
  assert.equal(safeInternalDestination("/sign-in"), null);
});

test("Independent capabilities never expose corporate taxes, year-end, or eCDF", () => {
  const capabilities = getWorkspaceCapabilities({ entityKind:"independent", vatRegistered:false });
  assert.equal(capabilities.hasAccounting, true);
  assert.equal(capabilities.hasCcss, true);
  assert.equal(capabilities.hasCorporateTaxes, false);
  assert.equal(capabilities.hasCompanyYearEnd, false);
  assert.equal(capabilities.hasEcdf, false);
  assert.equal(capabilities.hasVat, false);
});

test("Independent VAT is applicability-driven", () => {
  assert.equal(getWorkspaceCapabilities({ entityKind:"independent", vatRegistered:true }).hasVat, true);
  assert.equal(getWorkspaceCapabilities({ entityKind:"independent", vatRegistered:false }).hasVat, false);
});

test("Company workspaces retain corporate workflows and CCSS", () => {
  const capabilities = getWorkspaceCapabilities({ entityKind:"company", vatRegistered:false });
  assert.equal(capabilities.hasCorporateTaxes, true);
  assert.equal(capabilities.hasCompanyYearEnd, true);
  assert.equal(capabilities.hasEcdf, true);
  assert.equal(capabilities.hasCcss, true);
});

test("migration backfills Company and creates explicit transactional workspace RPCs", () => {
  const sql = readFileSync(new URL("../db/migrations/20260825_unified_workspace_onboarding.sql", import.meta.url), "utf8");
  assert.match(sql, /set entity_kind = 'company'\s+where entity_kind is null/i);
  assert.match(sql, /check \(entity_kind in \('independent', 'company'\)\)/i);
  assert.match(sql, /create or replace function public\.create_independent_workspace_v1/i);
  assert.match(sql, /'independent'/);
  assert.match(sql, /create or replace function public\.create_company_workspace_v2/i);
  assert.match(sql, /'company'/);
});

test("normal authentication is neutral and setup exposes all three paths with visible examples", () => {
  const auth = readFileSync(new URL("../src/components/sign-in-form.tsx", import.meta.url), "utf8");
  const setup = readFileSync(new URL("../src/app/setup/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(auth, /type Audience|audienceSwitcher|Create accountant account|Start with your company/);
  assert.match(auth, /Create account/);
  assert.match(setup, /Independent/);
  assert.match(setup, /Company/);
  assert.match(setup, /Accounting professional/);
  assert.match(setup, /Freelancer · Sole trader · Consultant · Liberal profession/);
  assert.match(setup, /SARL · SARL-S · SA · SAS · SCA/);
  assert.match(setup, /Accountant · Expert-comptable · Fiduciary · Accounting firm/);
});

test("Independent tax route exits before corporate calculations", () => {
  const taxes = readFileSync(new URL("../src/app/app/taxes/page.tsx", import.meta.url), "utf8");
  const guard = taxes.indexOf('if(workspace.company.entity_kind==="independent")');
  const corporateQueries = taxes.indexOf('supabase.from("company_tax_profiles")');
  assert.ok(guard >= 0 && corporateQueries > guard);
});
