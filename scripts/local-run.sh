#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$ROOT/.local-run.log"
: > "$LOG"

log() { echo "$1" | tee -a "$LOG"; }

cd "$ROOT"
set -a
source .env
set +a

export SEED_ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@digitify.local}"
export SEED_ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:-DigitifyLocal1!}"

log "==> migrate resolve"
cd "$ROOT/packages/db"
pnpm exec prisma migrate resolve --applied 20260607120000_media_generations >> "$LOG" 2>&1 || true
pnpm exec prisma migrate deploy >> "$LOG" 2>&1 || true

USER_COUNT=$(pnpm exec prisma db execute --stdin <<'SQL' 2>/dev/null | tail -1 || echo 0
SELECT COUNT(*)::text FROM users;
SQL
)
log "users: $USER_COUNT"

if [[ "${USER_COUNT:-0}" == "0" ]] || [[ "$USER_COUNT" == *"0"* && ${#USER_COUNT} -lt 3 ]]; then
  log "==> seeding"
  cd "$ROOT"
  pnpm db:seed >> "$LOG" 2>&1 || true
fi

cd "$ROOT"
if ! curl -sf -o /dev/null http://localhost:3000 2>/dev/null; then
  log "==> starting dev"
  nohup pnpm dev >> "$LOG" 2>&1 &
  sleep 10
fi

HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")
log "health: HTTP $HTTP"
log "login: $SEED_ADMIN_EMAIL / $SEED_ADMIN_PASSWORD"
log "DONE"
