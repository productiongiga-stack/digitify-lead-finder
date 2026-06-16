#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
  if [[ ! -f "$ROOT/apps/web/.env.local" ]]; then
    cp "$ROOT/.env" "$ROOT/apps/web/.env.local"
  fi
fi

exec pnpm exec turbo dev "$@"
