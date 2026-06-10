#!/usr/bin/env bash
# Resolve Vercel/Supabase env aliases before `prisma migrate deploy`.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/packages/db"

# Migrations must use a direct (non-pooler) connection — Supabase pooler rejects DDL.
migrate_url="${DIRECT_URL:-${POSTGRES_URL_NON_POOLING:-${POSTGRES_URL:-}}}"
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

if [[ "$DATABASE_URL" == *"pooler"* ]]; then
  echo "ERROR: DATABASE_URL points at a pooler. Set DIRECT_URL or POSTGRES_URL_NON_POOLING to the direct Supabase host (db.*.supabase.co:5432)." >&2
  exit 1
fi

echo "==> prisma migrate deploy"
pnpm exec prisma migrate deploy
