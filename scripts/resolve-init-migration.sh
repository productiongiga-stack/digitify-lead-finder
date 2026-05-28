#!/usr/bin/env bash
# Mark 20260522100000_init as applied without running SQL (existing DBs from db:push era).
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm --filter @digitify/db exec prisma migrate resolve --applied 20260522100000_init
echo "OK — run pnpm db:migrate for any pending migrations (e.g. RLS)."
