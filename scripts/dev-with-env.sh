#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/apps/web/.env.local" ]]; then
  # Next.js gives app-local development settings precedence over the shared env.
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

exec pnpm exec turbo dev "$@"
