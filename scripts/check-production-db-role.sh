#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is required; use the production app connection." >&2
  exit 1
fi

database_host="$(DATABASE_URL="$DATABASE_URL" node -e 'try { console.log(new URL(process.env.DATABASE_URL).hostname) } catch { process.exit(1) }')" || {
  echo "ERROR: DATABASE_URL is not a valid URL." >&2
  exit 1
}

case "$database_host" in
  localhost|127.0.0.1|::1)
    echo "ERROR: refusing local DATABASE_URL; production role check requires the production database." >&2
    exit 1
    ;;
esac

pnpm --filter @digitify/db db:check-role
