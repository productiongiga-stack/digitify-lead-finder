#!/usr/bin/env bash
# Resolve Vercel/Supabase env aliases before `prisma migrate deploy`.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/packages/db"

# Migrations must use a direct (non-pooler) connection — Supabase pooler rejects DDL.
migrate_url="${DIRECT_URL:-${POSTGRES_URL_NON_POOLING:-}}"

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
  echo "ERROR: Set DIRECT_URL, POSTGRES_URL_NON_POOLING, or DATABASE_URL for migrations." >&2
  exit 1
fi

echo "==> prisma migrate deploy"
pnpm exec prisma migrate deploy
