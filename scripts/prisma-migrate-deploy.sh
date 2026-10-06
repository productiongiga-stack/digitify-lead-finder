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
  pnpm exec prisma migrate deploy
  exit 0
fi

exit "$migration_status"
