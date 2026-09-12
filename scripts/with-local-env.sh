#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# CI and production callers keep their explicitly supplied environment. Local checks
# get the same database configuration as `pnpm dev` when none was supplied.
if [[ -z "${DATABASE_URL:-}" ]]; then
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
  fi
fi

exec "$@"
