import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { safeInternalDestination } from "../src/lib/safe-navigation.ts";

function read(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("OAuth and email confirmation destinations reject external redirects", () => {
  assert.equal(safeInternalDestination("//evil.example/steal"), null);
  assert.equal(safeInternalDestination("/%2f%2fevil.example"), null);
  assert.equal(safeInternalDestination("/\\evil.example"), null);
  assert.equal(safeInternalDestination("/app/settings/security"), "/app/settings/security");
  assert.match(read("../src/components/sign-in-form.tsx"), /signInWithOAuth\(\{ provider: "google"/);
  assert.match(read("../src/app/auth/confirm/route.ts"), /safeInternalDestination/);
  assert.match(read("../src/app/auth/callback/route.ts"), /new URL\("\/auth\/resolve"/);
});

test("verified TOTP factors are challenged before protected workspace access", () => {
  const proxy = read("../src/lib/supabase/proxy.ts");
  assert.match(proxy, /getAuthenticatorAssuranceLevel/);
  assert.match(proxy, /currentLevel === "aal1"/);
  assert.match(proxy, /nextLevel === "aal2"/);
  assert.match(proxy, /url\.pathname = "\/auth\/mfa"/);
  assert.match(read("../src/components/mfa-settings.tsx"), /factorType: "totp"/);
  assert.match(read("../src/components/mfa-challenge.tsx"), /mfa\.verify/);
});

test("expensive authenticated actions use the database-backed limiter", () => {
  for (const path of [
    "../src/app/app/banking/actions.ts",
    "../src/app/app/documents/actions.ts",
    "../src/app/app/copilot/actions.ts",
    "../src/app/app/transactions/ai-actions.ts",
    "../src/app/app/settings/billing/actions.ts",
    "../src/app/accountants/manage/actions.ts",
  ]) assert.match(read(path), /assertActionRateLimit/);
  const migration = read("../db/migrations/20260828073949_security_hardening.sql");
  assert.match(migration, /primary key \(user_id, action\)/i);
  assert.match(migration, /security definer\s+set search_path = ''/i);
  assert.match(migration, /grant execute on function public\.consume_security_rate_limit\(text\) to authenticated/i);
  assert.doesNotMatch(migration, /grant execute[^;]+to anon/i);
});

test("cross-tenant regression script covers every sensitive data family", () => {
  const sql = read("../db/tests/cross_tenant_isolation.sql");
  for (const table of ["organization_members", "source_transactions", "bank_transactions", "sales_invoices", "documents", "journal_entries"]) {
    assert.match(sql, new RegExp(`public\\.${table}`));
  }
  assert.match(sql, /set local role authenticated/i);
  assert.match(sql, /rollback;/i);
});

test("Stripe webhook claims an event before processing and makes failed or stale claims retryable", () => {
  const webhook = read("../src/app/api/stripe/webhook/route.ts");
  const claim = webhook.indexOf('from("stripe_webhook_events").insert');
  const process = webhook.indexOf('eventType === "checkout.session.completed"');
  assert.ok(claim >= 0 && process > claim);
  assert.match(webhook, /claimError\?\.code === "23505"/);
  assert.match(webhook, /status: "failed"/);
  assert.match(webhook, /processing_started_at\.lt/);
  assert.match(webhook, /status: "processed"/);
});

test("browser hardening headers and patched spreadsheet parser are configured", () => {
  const config = read("../next.config.ts");
  assert.match(config, /poweredByHeader:\s*false/);
  for (const header of ["Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "X-Frame-Options"]) assert.match(config, new RegExp(header));
  assert.match(config, /frame-ancestors 'none'/);
  assert.match(read("../package.json"), /xlsx-0\.20\.3/);
});

test("CI validates lint, types, tests, and the production build", () => {
  const workflow = read("../.github/workflows/ci.yml");
  for (const command of ["pnpm lint", "pnpm typecheck", "pnpm test", "pnpm build"]) assert.match(workflow, new RegExp(command));
  assert.match(workflow, /pnpm install --frozen-lockfile/);
});
