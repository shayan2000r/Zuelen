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

## 3. Findings and their status (updated 2026-10-09)

| # | Finding | Status |
| --- | --- | --- |
| 1 | The repository could not rebuild the database (43 partial migration files vs 97 recorded in production; 8+ changes applied by hand) | **Fixed.** `db/baseline` was generated from production's catalogs and verified by fingerprint (identical columns, constraints, indexes, function bodies, policies, triggers, grants, PCN catalogue). New changes go in `db/migrations` with the version production records. A CI job builds the database from the baseline on the production Postgres image and runs the SQL tests. See `db/README.md`. |
| 2 | More than half of the source files were minified one-liners | **Fixed.** Prettier (printWidth 120) formats the codebase; `pnpm format:check` runs in CI. Source-text tests read through `tests/source-text.ts`, so formatting does not affect them. |
| 3 | Regulatory values duplicated and hard-coded | **Fixed.** VAT rates, the franchise threshold and corporate tax rules live in `src/lib/tax-rules/*` (dated); the database uses `vat_rate_periods` and `compliance_rules` (the calendar now reads its rules from there). See `docs/compliance/REGULATORY_REGISTER.md`. |
| 4 | Layered "fix-up" stylesheets and inline styles | Open, planned for Phase 4 (design-system consolidation). |
| 5 | `server-only` imported but not declared | **Fixed.** |
| 6 | PCN seed downloaded from a third party at migration time | **Fixed.** The verified catalogue is in `db/baseline/01_reference_data.sql`; the old migration is archived. |
| 7 | Supabase advisors: leaked-password protection disabled; 32 `SECURITY DEFINER` RPCs callable by signed-in users | Open. Leaked-password protection is a dashboard setting (Authentication → Policies); the RPC review belongs to Phase 3. |
| 8 | Lint warnings | Reduced from 67 to 55. The rest (`<img>` vs `next/image`, React hook patterns) change rendering behaviour and are planned with Phase 4. |
| 9 | Unused exports in the UI kit | Kept on purpose (design-system primitives). |
| 10 | SQL tests not run in CI | **Fixed** (database job). The cross-tenant test had a missing grant and could not have run; fixed. |

### Database changes that needed a person's approval

The retention guard, dated rate validation for drafts, removal of the hard-coded rate checks and the
cleanup of the temporary export function were applied in the Supabase SQL editor on 2026-10-09
(`db/migrations/20261009120000_requires_approval_bundle.sql`) and verified against the tested version.

## 4. Structure

The top-level layout (`src/app`, `src/components`, `src/lib`, `db`, `docs`, `tests`) is sound. Domain logic
is mostly inside page and action files rather than `src/lib`; only CCSS and tax-class are isolated and
tested. Moving VAT, corporate-tax and calendar logic into `src/lib/<domain>` with dated parameters (like
`src/lib/ccss`) is the main structural improvement for Phase 1.
