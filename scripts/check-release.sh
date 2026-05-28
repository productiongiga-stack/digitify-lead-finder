#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> generate + migrate (local DATABASE_URL required)"
pnpm db:generate
pnpm db:migrate

echo "==> unit tests + typecheck + build"
pnpm test
pnpm typecheck
pnpm build

echo "==> release checks passed"
