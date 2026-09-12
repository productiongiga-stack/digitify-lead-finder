#!/usr/bin/env bash
# One-time (or idempotent) production/staging database setup.
# Requires DATABASE_URL and DIRECT_URL in environment or .env.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
elif [[ -f "$ROOT/apps/web/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/apps/web/.env.local"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set. Export it or create .env from .env.example."
  exit 1
fi

if [[ "${NODE_ENV:-}" == "production" && -z "${DIRECT_URL:-}" ]]; then
  echo "ERROR: DIRECT_URL is required for production database setup."
  exit 1
fi

database_host="$(DATABASE_URL="$DATABASE_URL" node -e 'try { console.log(new URL(process.env.DATABASE_URL).host) } catch { process.exit(1) }')" || {
  echo "ERROR: DATABASE_URL is not a valid URL."
  exit 1
}
echo "==> Database target: $database_host"

if [[ "${SETUP_DB_PREFLIGHT:-}" == "1" ]]; then
  echo "==> Preflight only: checking database connectivity and migration state"
  pnpm --filter @digitify/db exec prisma migrate status
  echo "Preflight passed. No schema, data, or seed changes were made."
  exit 0
fi

echo "==> Generate Prisma client"
pnpm db:generate

echo "==> Apply migrations (init schema + RLS policies)"
pnpm db:migrate

echo "==> Migrate workspace settings (user:* → workspace:*)"
pnpm db:migrate-workspace-settings -- --dry-run
pnpm db:migrate-workspace-settings

echo "==> Migrate legacy workspace JSON data (dry-run first)"
pnpm db:migrate-legacy-workspace-data -- --dry-run
read -r -p "Run legacy workspace data migration for real? [y/N] " confirm
if [[ "${confirm,,}" == "y" ]]; then
  pnpm db:migrate-legacy-workspace-data
fi

echo "==> Migrate legacy template library JSON (dry-run first)"
pnpm db:migrate-legacy-templates -- --dry-run
read -r -p "Run legacy template migration for real? [y/N] " confirm
if [[ "${confirm,,}" == "y" ]]; then
  pnpm db:migrate-legacy-templates
fi

if [[ "${RUN_SEED:-}" == "1" ]]; then
  echo "==> Seed (staging only — set SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)"
  pnpm db:seed
else
  echo "==> Skipping seed (set RUN_SEED=1 for staging)"
fi

if [[ "${ENABLE_WORKSPACE_RLS:-}" == "true" ]]; then
  echo "==> RLS staging smoke"
  pnpm rls:smoke
else
  echo "==> Skipping RLS smoke (set ENABLE_WORKSPACE_RLS=true after staging sign-off)"
fi

echo "Done. Next: set Vercel env vars (see docs/VERCEL.md) and hit GET /api/health"
