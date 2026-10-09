# Phase 0A — Repository audit

Date: 2026-10-09 · Branch: `claude/dazzling-bell-3qs1rs` · Base: `main` @ `ce4bcff`

## 1. Health checks

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | OK |
| `pnpm lint` | 0 errors, 67 warnings before cleanup (mostly `react-hooks/set-state-in-effect`, `no-explicit-any`, `<img>` instead of `next/image`) |
| `pnpm typecheck` | OK |
| `pnpm test` | 89/89 pass |
| `pnpm build` | OK |
| Secrets committed to git | None found (Stripe, Supabase, Resend, OpenAI key patterns searched) |
| `TODO` / `FIXME` / `console.log` in `src` | None |

## 2. Cleanup done in this branch

| Change | Why |
| --- | --- |
| Deleted `src/components/dashboard-shell.tsx`, `overview-assistant.tsx`, `overview-chart.tsx` (+ `.module.css`), `bookkeeping-reset.tsx`, `generated-financial-documents.tsx` (+ `.module.css`) | Not imported anywhere (confirmed with `knip` and a name search) |
| Deleted `src/lib/demo-data.ts` | Only used by the deleted `dashboard-shell.tsx` |
| Deleted `src/app/app/tax-reserve/actions.ts` | Never imported; the tax-reserve page only redirects |
| Removed unused server actions `saveVatProfile`, `bulkPostSuggestedTransactions`, `bulkIgnorePendingTransactions`, `aiReanalyzePendingTransactions`, `ignorePendingForActiveYear` | Exported from `"use server"` files but never called. Unused server actions are dead code and unnecessary attack surface (`saveVatProfile` did not check the member's role). |
| Deleted root `Zuelen - Icon - Gradient - Resized.png` | Byte-identical duplicate of `public/zuelen-icon.png`, not referenced |
| Moved `DOMAIN_ARCHITECTURE.md` to `docs/` | Keep the root for project entry points only |
| Rewrote `README.md` | Was a single heading; now covers stack, setup, scripts, layout, migrations caveat and the regulatory register |
| `prefer-const` fix in `src/lib/ai-transaction-pipeline.ts` | Lint warning |

All checks above still pass after the cleanup.

## 3. Findings not fixed yet (need a decision or belong to a later phase)

### High

1. **The repository cannot rebuild the database.** Supabase has 97 recorded migrations, starting with
   `compta_core_foundation` (2026-08-16). `db/migrations` has 43 files starting 2026-08-20, so the base
   schema (companies, journal, VAT posting, invoicing, compliance calendar, etc.) exists only in the live
   database. In addition, at least 8 repo migrations dated 2026-09-13 to 2026-09-24 (early access,
   document intake, foreign currency, etc.) **are applied in production but missing from the Supabase
   migration history** (last recorded version: `20260922105445`). They were most likely run by hand.
   *Recommendation:* take a schema baseline from production (`supabase db pull` or `pg_dump --schema-only`)
   into the repo, mark it as applied, and from then on apply every change through migrations only.
   Most of the accounting, VAT and calendar logic Phase 1 must audit lives in these Postgres functions.

2. **More than half of the source files are written as minified one-liners.** 169 of 297 files under `src` contain
   lines over 400 characters (some CSS modules are a single 13,000-character line). This makes code review,
   diffs and the Phase 1 audit much harder and error-prone.
   *Recommendation:* adopt Prettier and format the codebase in a dedicated commit. Blocker: 11 of the 14
   test files assert on the **source text** with regexes (e.g. `/message:error\.message/`) instead of
   testing behaviour, so they would fail after formatting. They should be rewritten as behavioural tests
   first (Phase 2), or relaxed to be whitespace-insensitive.

3. **Regulatory values are duplicated and hard-coded in many places.** For example, VAT rates
   `17/14/8/3` are hard-coded in at least five components plus database functions; corporate tax brackets
   live inside `src/app/app/taxes/page.tsx`; calendar deadlines are hard-coded in
   `sync_core_compliance_calendar` while the same values also sit in the `compliance_rules` table, which
   the function does not read. CCSS is the exception (dated parameter periods with sources); the same
   pattern should be applied to all rules. See `docs/compliance/REGULATORY_REGISTER.md`.

### Medium

4. **Layered "fix-up" stylesheets.** 77 CSS modules plus `final-ux-cleanup.css`, `*-polish.module.css`,
   `*-v2.module.css`, `*-upgrades.module.css`, `*-final-responsive.module.css`, and ~100 inline
   `style={{…}}` blocks. These overrides stack on top of each other. Consolidate into the design system
   (`docs/ZUELEN_UI_DESIGN_SYSTEM_V2.md`) during Phase 4.
5. **`server-only` is imported but not declared** in `package.json` (10 files). It works because Next.js
   bundles it, but the Next.js docs recommend installing it. Adding the dependency was not done in this
   session (package installs were blocked); run `pnpm add server-only`.
6. **PCN reproducible seed downloads from a third party at migration time.** `20260901140100_pcn2020_catalog_seed.sql`
   uses the Postgres `http` extension to fetch Odoo's Luxembourg chart from GitHub. Production labels and
   hierarchy were verified against the official eCDF mapping, but a fresh environment would depend on a
   non-official source and on network access from the database. Store the verified eCDF snapshot in the repo instead.
7. **Supabase security advisor:** leaked-password protection is disabled (enable in Auth settings), and 32
   `SECURITY DEFINER` RPCs are callable by signed-in users. The latter is the intended design (each function
   checks permissions itself) but every one must be reviewed in Phase 3.
8. **67 lint warnings**, mainly `set-state-in-effect` (cascading re-renders) and `no-explicit-any`.
9. **Unused exports** remain in the UI kit and helpers (`EmptyState`, `TrendChip`, `Field`, `prettyRole`,
   `currentFiscalYear`…). Left in place: UI-kit primitives are likely to be used in Phase 4.

### Low

10. `db/tests/*.sql` are not run in CI.
11. CI does not run on pushes to non-`main` branches (only PRs to `main`), which is fine, but there is no
    separate check for migrations.

## 4. Structure

The top-level layout (`src/app`, `src/components`, `src/lib`, `db`, `docs`, `tests`) is sound. Domain logic
is mostly inside page and action files rather than `src/lib`; only CCSS and tax-class are isolated and
tested. Moving VAT, corporate-tax and calendar logic into `src/lib/<domain>` with dated parameters (like
`src/lib/ccss`) is the main structural improvement for Phase 1.
