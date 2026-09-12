#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Make the release check behave like local dev: root .env wins, app-local env is
# a fallback. Never copy either file or print its values.
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

command -v pnpm >/dev/null || { echo "ERROR: pnpm is required" >&2; exit 1; }

echo "==> generate + migrate (local DATABASE_URL required)"
pnpm db:generate
pnpm db:migrate
pnpm --filter @digitify/db db:check-domain-schema

echo "==> model cost sync check"
node packages/media-studio/scripts/sync-model-costs.mjs --check

echo "==> unit tests + typecheck + build"
pnpm test
pnpm typecheck
pnpm lint
# The web production build can exceed Node's default heap on this monorepo.
NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}" pnpm build

echo "==> release checks passed"
