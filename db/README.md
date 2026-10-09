# Database

Zuelen runs on Supabase (Postgres 17.6, project region `eu-north-1`).

| Path | What it is |
| --- | --- |
| `baseline/00_schema.sql` | Full schema of `public` and `app_private` as in production on 2026-10-09 (tables, functions, constraints, indexes, triggers, RLS policies, grants, storage buckets and policies). |
| `baseline/01_reference_data.sql` | Reference data: PCN 2020 catalogue (from the official eCDF mapping), compliance rules, CCSS parameter periods. |
| `migrations/` | Every change after the baseline, named with the version production recorded (`<version>_<name>.sql`). |
| `archive/pre-baseline-migrations/` | The partial migration files kept before the baseline existed. History only; do not apply. |
| `tests/` | SQL regression tests and fixtures. |
| `scripts/test.sh` | Builds a database from the baseline + migrations and runs the tests. |

## How the baseline was made

Production had 97 recorded migrations, while the repository held only 43 partial files, and some
changes had been applied without a history entry. The baseline was generated from production's system
catalogs and verified by loading it into a fresh `supabase/postgres:17.6.1.155` database. Its
fingerprint (`tests/schema_fingerprint.sql`: columns, constraints, indexes, function bodies, policies,
triggers, grants, PCN catalogue) was identical to production.

## Making a change

1. Write the migration in `migrations/` and run `scripts/test.sh` locally (Docker command in the script).
2. Apply it to production through Supabase (migration tool or CLI). Rename the file to the version
   production records.
3. Run `tests/schema_fingerprint.sql` on production and locally; every row must match.
4. If the change touches a rule in `docs/compliance/REGULATORY_REGISTER.md`, update the register.

## Changes that need a person's confirmation

The Supabase connector used by Claude asks for confirmation before SQL that removes rows or objects
(DROP, or function bodies containing DELETE), and that prompt cannot be answered from a cloud session.
Put such a change in `pending/`, test it (`scripts/test.sh` applies `pending/` after `migrations/`;
`WITH_PENDING=0` tests the production state), run it in the Supabase SQL editor, record it in the
migration history and move it to `migrations/`. `20261009120000_requires_approval_bundle.sql` went
through this path.
