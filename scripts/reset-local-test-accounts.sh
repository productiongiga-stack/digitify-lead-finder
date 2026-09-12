#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "${NODE_ENV:-}" == "production" ]]; then
  echo "ERROR: local test accounts cannot be reset in production mode." >&2
  exit 1
fi

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

if [[ "${DATABASE_URL:-}" != *localhost* && "${DATABASE_URL:-}" != *127.0.0.1* ]]; then
  echo "ERROR: DATABASE_URL must point to a local database." >&2
  exit 1
fi

command -v openssl >/dev/null || { echo "ERROR: openssl is required." >&2; exit 1; }

admin_password="Digitify-$(openssl rand -hex 12)!"
owner_b_password="Digitify-$(openssl rand -hex 12)!"
viewer_password="Digitify-$(openssl rand -hex 12)!"
team_password="Digitify-$(openssl rand -hex 12)!"

credentials_dir="${XDG_CONFIG_HOME:-$HOME/.config}/digitify"
credentials_file="$credentials_dir/local-credentials.txt"
mkdir -p "$credentials_dir"
umask 077

SEED_ADMIN_EMAIL="admin@digitify.local" \
SEED_ADMIN_PASSWORD="$admin_password" \
SEED_RLS_OWNER_B_EMAIL="owner-b@digitify.local" \
SEED_RLS_OWNER_B_PASSWORD="$owner_b_password" \
SEED_VIEWER_EMAIL="viewer@digitify.local" \
SEED_VIEWER_PASSWORD="$viewer_password" \
SEED_MODERATOR_EMAIL="moderator@digitify.local" \
SEED_MEMBER_EMAIL="member@digitify.local" \
SEED_MODULE_RESTRICTED_EMAIL="module-restricted@digitify.local" \
SEED_TEAM_PASSWORD="$team_password" \
bash "$ROOT/scripts/with-local-env.sh" pnpm --filter @digitify/db db:seed

tmp_file="$(mktemp "$credentials_dir/local-credentials.XXXXXX")"
cat > "$tmp_file" <<EOF
Digitify lokale testaccounts
Gegenereerd: $(date -u '+%Y-%m-%dT%H:%M:%SZ')

OWNER
email: admin@digitify.local
wachtwoord: $admin_password

OWNER (RLS workspace B)
email: owner-b@digitify.local
wachtwoord: $owner_b_password

VIEWER
email: viewer@digitify.local
wachtwoord: $viewer_password

MODERATOR
email: moderator@digitify.local
wachtwoord: $team_password

MEMBER
email: member@digitify.local
wachtwoord: $team_password

MEMBER (Social uitgeschakeld)
email: module-restricted@digitify.local
wachtwoord: $team_password

Gebruik deze gegevens uitsluitend voor de lokale database op http://localhost:3000.
EOF
chmod 600 "$tmp_file"
mv -f "$tmp_file" "$credentials_file"
echo "Local test accounts reset. Credentials saved to: $credentials_file"
