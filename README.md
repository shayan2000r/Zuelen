# Zuelen

Accounting, tax and compliance workspace for businesses and independents in Luxembourg.

- Public website: https://zuelen.lu
- Application: https://app.zuelen.lu (see [docs/DOMAIN_ARCHITECTURE.md](docs/DOMAIN_ARCHITECTURE.md))

## Workspaces

| Workspace | Who it is for | Entry point |
| --- | --- | --- |
| Company | SARL-S, SARL, SA and other companies | `/setup/company`, `/app` |
| Independent | Activity carried on in the person's own name | `/setup/independent`, `/app` |
| Accountant (Professional) | Accountants listed in the directory and serving clients | `/professional`, `/accountants` |

## Stack

- Next.js 16 (App Router) + React 19, TypeScript
- Supabase (Postgres, Auth, Storage) — project region `eu-north-1`
- Vercel hosting (`fra1`)
- Stripe (billing), Resend (transactional email), OpenAI (document extraction and bookkeeping suggestions)

> This Next.js version has breaking changes compared with older releases. Read the relevant guide in
> `node_modules/next/dist/docs/` before changing framework-level code (see [AGENTS.md](AGENTS.md)).

## Getting started

```bash
corepack enable
pnpm install
cp .env.example .env.local   # fill in Supabase, Stripe and Resend values
pnpm dev
```

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Node test runner over `tests/**/*.test.ts` |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests and build on every pull request to `main`.

## Repository layout

```
src/
  app/            Routes (App Router)
    app/          Authenticated product: transactions, banking, accounting, vat, ccss,
                  taxes, compliance, reports, documents, invoices, year-end, copilot, settings
    professional/ Accountant workspace
    accountants/  Public accountant directory and onboarding
    admin/        Internal admin (users, early access, accountant review)
    setup/        Company and independent onboarding
    api/          Route handlers (Stripe webhook, early access)
  components/     UI components and their CSS modules
  lib/            Domain logic and server helpers
    ccss/         CCSS contribution calculator and dated parameter periods
    personal-fiscal/  Tax-class derivation
    supabase/     Supabase clients (browser, server, admin)
db/
  migrations/     SQL migrations (see note below)
  tests/          SQL security tests (run against a non-production database)
docs/
  compliance/     Regulatory register: every rule, rate and deadline with its official source
  audit/          Audit reports
tests/            Unit tests
```

## Database migrations

`db/migrations` does **not** yet contain the full schema: the base schema (August 2026) was applied
directly to Supabase, and several later changes were applied without a matching entry in the
Supabase migration history. See [docs/audit/PHASE_0A_REPO_AUDIT.md](docs/audit/PHASE_0A_REPO_AUDIT.md)
before relying on these files to recreate a database.

## Regulatory rules

Every tax rate, threshold, deadline and accounting mapping used by Zuelen is listed with its official
Luxembourg source in [docs/compliance/REGULATORY_REGISTER.md](docs/compliance/REGULATORY_REGISTER.md).
Update the register in the same change whenever a rule changes in code or in the database.
