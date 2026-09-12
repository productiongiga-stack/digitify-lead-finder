#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${PRODUCTION_ENV_FILE:-${1:-$ROOT/.env.production.local}}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: production env file not found: $ENV_FILE" >&2
  echo "Set PRODUCTION_ENV_FILE or pass the file path as the first argument." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

failed=0

require_value() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "ERROR: $name is required." >&2
    failed=1
  fi
}

require_min_length() {
  local name="$1"
  local minimum="$2"
  local value="${!name:-}"
  if [[ ${#value} -lt "$minimum" ]]; then
    echo "ERROR: $name must contain at least $minimum characters." >&2
    failed=1
  fi
}

reject_placeholder() {
  local name="$1"
  local value="${!name:-}"
  if [[ "$value" == change-me-in-production || "$value" == replace-with-* || "$value" == GENEREER_* ]]; then
    echo "ERROR: $name must not use an example placeholder." >&2
    failed=1
  fi
}

require_url() {
  local name="$1"
  local allowed_protocols="$2"
  if ! node -e '
    const [name, protocols] = process.argv.slice(1);
    try {
      const url = new URL(process.env[name]);
      if (!protocols.split(",").includes(url.protocol)) process.exit(1);
    } catch { process.exit(1); }
  ' "$name" "$allowed_protocols"; then
    echo "ERROR: $name must be a valid URL with an approved protocol." >&2
    failed=1
  fi
}

require_value DATABASE_URL
require_value DIRECT_URL
require_value NEXTAUTH_URL
require_value NEXT_PUBLIC_APP_URL
require_value NEXTAUTH_SECRET
require_value SETTINGS_ENCRYPTION_KEY
require_value CRON_SECRET

# Credential and public-form protection must be shared across Vercel
# instances. A local in-memory bucket is acceptable for development only.
if [[ -z "${REDIS_URL:-}" && ( -z "${UPSTASH_REDIS_REST_URL:-}" || -z "${UPSTASH_REDIS_REST_TOKEN:-}" ) ]]; then
  echo "ERROR: production requires REDIS_URL or both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN." >&2
  failed=1
fi

require_min_length NEXTAUTH_SECRET 32
require_min_length SETTINGS_ENCRYPTION_KEY 32
require_min_length CRON_SECRET 16
reject_placeholder NEXTAUTH_SECRET
reject_placeholder SETTINGS_ENCRYPTION_KEY
reject_placeholder CRON_SECRET
require_url DATABASE_URL "postgres:,postgresql:"
require_url DIRECT_URL "postgres:,postgresql:"
require_url NEXTAUTH_URL "https:"
require_url NEXT_PUBLIC_APP_URL "https:"

if [[ "${ENABLE_WORKSPACE_RLS:-}" != "true" ]]; then
  echo "ERROR: ENABLE_WORKSPACE_RLS must be true in production." >&2
  failed=1
fi

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

echo "Production environment preflight passed. No secret values were printed."
