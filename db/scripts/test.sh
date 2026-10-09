#!/usr/bin/env bash
# Build a database from db/baseline + db/migrations and run the SQL regression tests.
#
# Requires a Supabase Postgres image (supabase/postgres:17.6.1.155, same as production) reachable
# with the connection settings below. Locally:
#   docker run -d --name zuelen-db -e POSTGRES_PASSWORD=postgres -p 54322:5432 supabase/postgres:17.6.1.155
#   db/scripts/test.sh
set -euo pipefail

cd "$(dirname "$0")/../.."
export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-54322}" PGPASSWORD="${PGPASSWORD:-postgres}" PGDATABASE="${PGDATABASE:-postgres}"
WITH_PENDING="${WITH_PENDING:-1}"

run() { psql -U "$1" -v ON_ERROR_STOP=1 -q -f "$2" >/dev/null 2>"$3" || { cat "$3"; echo "FAILED: $2"; exit 1; }; }
log="$(mktemp)"

run supabase_admin db/tests/storage_shim.sql "$log"
psql -U supabase_admin -q -c "alter table storage.buckets owner to postgres; alter table storage.objects owner to postgres;"
run postgres db/baseline/00_schema.sql "$log"
run postgres db/baseline/01_reference_data.sql "$log"
for f in db/migrations/*.sql; do run postgres "$f" "$log"; echo "applied $f"; done
if [ "$WITH_PENDING" = "1" ] && [ -d db/pending ]; then
  for f in db/pending/*.sql; do run postgres "$f" "$log"; echo "applied $f (pending in production)"; done
fi

run postgres db/tests/fixtures.sql "$log"
for t in db/tests/cross_tenant_isolation.sql db/tests/independent_workspace_ccss.sql db/tests/regulatory_rules.sql; do
  out="$(psql -U postgres -v ON_ERROR_STOP=1 -q -f "$t" 2>&1)" || { echo "$out" | grep -E "ERROR|FAIL|CONTEXT" ; echo "FAILED: $t"; exit 1; }
  echo "passed $t ($(echo "$out" | grep -c 'ok   ' || true) assertions)"
done
