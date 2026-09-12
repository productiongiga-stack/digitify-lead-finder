#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$ROOT/.local-run.log"

if [[ "${NODE_ENV:-}" == "production" ]]; then
  echo "ERROR: local-run.sh may not be used with NODE_ENV=production." >&2
  exit 1
fi

cd "$ROOT"
if [[ -f "$ROOT/apps/web/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/apps/web/.env.local"
  set +a
elif [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
else
  echo "ERROR: .env or apps/web/.env.local is required for local startup." >&2
  exit 1
fi

umask 077
: > "$LOG"
log() { echo "$1" | tee -a "$LOG"; }

if [[ "${RUN_MIGRATIONS:-0}" == "1" ]]; then
  log "==> applying local migrations"
  pnpm db:migrate >> "$LOG" 2>&1
else
  log "==> migrations skipped (set RUN_MIGRATIONS=1 to apply them)"
fi

if [[ "${RUN_SEED:-0}" == "1" ]]; then
  : "${SEED_ADMIN_EMAIL:?SEED_ADMIN_EMAIL is required when RUN_SEED=1}"
  : "${SEED_ADMIN_PASSWORD:?SEED_ADMIN_PASSWORD is required when RUN_SEED=1}"
  if [[ ${#SEED_ADMIN_PASSWORD} -lt 12 ]]; then
    echo "ERROR: SEED_ADMIN_PASSWORD must contain at least 12 characters." >&2
    exit 1
  fi
  log "==> seeding local database"
  pnpm db:seed >> "$LOG" 2>&1
else
  log "==> seed skipped (set RUN_SEED=1 with explicit SEED_* credentials)"
fi

if ! curl --connect-timeout 1 --max-time 5 -fsS -o /dev/null http://localhost:3000/api/health 2>/dev/null; then
  log "==> starting development server"
  nohup pnpm dev >> "$LOG" 2>&1 &
fi

for _ in $(seq 1 20); do
  if curl --connect-timeout 1 --max-time 5 -fsS http://localhost:3000/api/health >/dev/null 2>&1; then
    log "local app ready at http://localhost:3000"
    log "log: $LOG"
    exit 0
  fi
  sleep 1
done

echo "ERROR: local app did not become healthy. See $LOG" >&2
exit 1
