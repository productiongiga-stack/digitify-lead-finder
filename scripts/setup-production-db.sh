#!/usr/bin/env bash
# One-time (or idempotent) production/staging database setup.
# Requires DATABASE_URL and DIRECT_URL in environment or .env.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set. Export it or use: set -a && source .env && set +a"
  exit 1
fi

echo "==> Generate Prisma client"
pnpm db:generate

echo "==> Apply migrations (init schema + RLS policies)"
pnpm db:migrate

echo "==> Migrate workspace settings (user:* → workspace:*)"
pnpm db:migrate-workspace-settings -- --dry-run
pnpm db:migrate-workspace-settings

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
