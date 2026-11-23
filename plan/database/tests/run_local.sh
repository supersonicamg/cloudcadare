#!/usr/bin/env bash
# Validate the whole schema on a throwaway Supabase Postgres container.
#   ./plan/database/tests/run_local.sh            (needs podman or docker)
# Steps: fresh container → storage stubs → migrations 00..99 → smoke test → lints.
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="${IMAGE:-public.ecr.aws/supabase/postgres:17.11.0.011}"
NAME="edu-plan-pg"
RT="$(command -v podman || command -v docker)"

"$RT" rm -f "$NAME" >/dev/null 2>&1 || true
"$RT" run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
for _ in $(seq 1 60); do
  "$RT" exec "$NAME" psql -U postgres -d postgres -Atc "select 1 from pg_namespace where nspname='extensions'" 2>/dev/null | grep -q 1 && break
  sleep 2
done
sleep 4

run() { # $1 = file, $2 = db user
  "$RT" cp "$1" "$NAME:/tmp/$(basename "$1")"
  "$RT" exec "$NAME" psql -U "$2" -d postgres -v ON_ERROR_STOP=1 -q -f "/tmp/$(basename "$1")"
}

run "$DIR/tests/00_local_stubs.sql" supabase_admin 2>&1 | grep -v NOTICE || true
for f in $(ls "$DIR"/*.sql | sort); do
  run "$f" postgres >/dev/null 2>&1 || { echo "FAIL $(basename "$f")"; run "$f" postgres 2>&1 | tail -15; exit 1; }
  echo "applied $(basename "$f")"
done

run "$DIR/tests/smoke_test.sql" postgres 2>&1 | grep -E "PASS|ERROR|PASSED|CONTEXT"
run "$DIR/tests/lint.sql" postgres

echo "Container '$NAME' left running for inspection:  $RT exec -it $NAME psql -U postgres"
