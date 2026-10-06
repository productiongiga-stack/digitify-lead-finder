#!/usr/bin/env bash
# Resolve Vercel/Supabase env aliases before `prisma migrate deploy`.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/packages/db"

# Keep the application URL as a fallback. Some Supabase projects expose a
# direct hostname that is IPv6-only from Vercel build machines, while the
# session pooler used by the app remains reachable.
application_url="${DATABASE_URL:-${POSTGRES_PRISMA_URL:-${POSTGRES_URL:-}}}"

# Migrations must use a direct (non-pooler) connection — Supabase pooler rejects DDL.
# Vercel's Supabase integration may expose the direct connection under the
# lowercase `database` key; prefer it when the explicit aliases are absent.
migrate_url="${DIRECT_URL:-${POSTGRES_URL_NON_POOLING:-${database:-${POSTGRES_URL:-}}}}"
if [[ "$migrate_url" == *"pooler"* ]]; then
  migrate_url="${POSTGRES_URL_NON_POOLING:-}"
fi
if [[ "$migrate_url" == *"pooler"* || "$migrate_url" == *"localhost"* || "$migrate_url" == *"127.0.0.1"* ]]; then
  migrate_url=""
fi

# Vercel + Supabase: build direct URL from host/user/password when only pooler URLs are set.
if [[ -z "$migrate_url" && -n "${POSTGRES_HOST:-}" && -n "${POSTGRES_USER:-}" && -n "${POSTGRES_PASSWORD:-}" ]]; then
  db_name="${POSTGRES_DATABASE:-postgres}"
  migrate_url="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${db_name}"
fi

if [[ -n "$migrate_url" ]]; then
  export DATABASE_URL="$migrate_url"
  export DIRECT_URL="$migrate_url"
else
  if [[ -z "${DATABASE_URL:-}" ]]; then
    export DATABASE_URL="${POSTGRES_PRISMA_URL:-${POSTGRES_URL:-}}"
  fi
  if [[ -z "${DIRECT_URL:-}" ]]; then
    export DIRECT_URL="${POSTGRES_URL_NON_POOLING:-}"
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ "${SKIP_DB_MIGRATE:-}" == "1" || "${VERCEL:-}" == "1" ]]; then
    echo "WARN: Skipping prisma migrate deploy (no DATABASE_URL on this runner)." >&2
    exit 0
  fi
  echo "ERROR: Set DIRECT_URL, POSTGRES_URL_NON_POOLING, or DATABASE_URL for migrations." >&2
  exit 1
fi

echo "==> prisma migrate deploy"
migration_output=""
set +e
migration_output="$(pnpm exec prisma migrate deploy 2>&1)"
migration_status=$?
set -e
printf '%s\n' "$migration_output"

if [[ "$migration_status" -eq 0 ]]; then
  exit 0
fi

# Retry only for an unreachable direct host. Other migration errors must stop
# the deployment instead of risking a second, non-idempotent attempt.
if [[ "$migration_output" == *"P1001"* && -n "$application_url" && "$application_url" != "$migrate_url" ]]; then
  echo "==> direct host unreachable; retrying through the configured application connection"
  export DATABASE_URL="$application_url"
  export DIRECT_URL="$application_url"
  export PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK="1"
  set +e
  migration_output="$(pnpm exec prisma migrate deploy 2>&1)"
  migration_status=$?
  set -e
  printf '%s\n' "$migration_output"
fi

# Some early production databases were created from idempotent catch-up SQL
# before Prisma migration history was introduced. Prisma reports those
# databases as P3005 (non-empty schema). Baseline the original schema, then
# continue with normal migrations. If a historical migration is already
# represented in that schema, Prisma can fail only because an object already
# exists; record that migration as applied and continue. Any other error still
# fails the build.
if [[ "$migration_output" == *"P3005"* ]]; then
  echo "==> existing schema detected without Prisma history; baselining init migration"
  pnpm exec prisma migrate resolve --applied 20260522100000_init
  migration_status=1
  migration_output=""
fi

for attempt in $(seq 1 80); do
  [[ "$migration_status" -eq 0 ]] && exit 0

  set +e
  migration_output="$(pnpm exec prisma migrate deploy 2>&1)"
  migration_status=$?
  set -e
  printf '%s\n' "$migration_output"
  [[ "$migration_status" -eq 0 ]] && exit 0

  if [[ "$migration_output" == *"P3005"* ]]; then
    pnpm exec prisma migrate resolve --applied 20260522100000_init
    continue
  fi

  if [[ "$migration_output" == *"P3018"* && ( "$migration_output" == *"already exists"* || "$migration_output" == *"duplicate key"* || "$migration_output" == *"42701"* || "$migration_output" == *"42710"* || "$migration_output" == *"42P07"* ) ]]; then
    failed_migration="$(printf '%s\n' "$migration_output" | sed -n 's/.*Applying migration `\([^`]*\)`.*$/\1/p' | tail -1)"
    if [[ -z "$failed_migration" ]]; then
      echo "ERROR: Prisma reported a duplicate object but did not expose the migration name." >&2
      exit "$migration_status"
    fi
    echo "==> migration $failed_migration is already represented in the existing schema; recording it as applied"
    pnpm exec prisma migrate resolve --applied "$failed_migration"
    continue
  fi

  exit "$migration_status"
done

echo "ERROR: Prisma migration recovery exceeded its safety limit." >&2
exit 1

exit "$migration_status"
