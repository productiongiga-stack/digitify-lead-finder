#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> generate + migrate (local DATABASE_URL required)"
pnpm db:generate
pnpm db:migrate

echo "==> model cost sync check"
node packages/media-studio/scripts/sync-model-costs.mjs --check

echo "==> unit tests + typecheck + build"
pnpm test
pnpm typecheck
pnpm build

echo "==> release checks passed"
