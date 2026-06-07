#!/usr/bin/env bash
# After production-catch-up.sql, mark Prisma migrations as applied (requires DIRECT_URL).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/packages/db"

direct_candidate="${DIRECT_URL:-${POSTGRES_URL_NON_POOLING:-}}"
if [[ "$direct_candidate" == *"pooler"* || "$direct_candidate" == *"localhost"* || "$direct_candidate" == *"127.0.0.1"* ]]; then
  direct_candidate=""
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  export DATABASE_URL="${direct_candidate:-${POSTGRES_PRISMA_URL:-}}"
fi
if [[ -z "${DIRECT_URL:-}" ]]; then
  export DIRECT_URL="${direct_candidate:-}"
fi
if [[ "$DATABASE_URL" == *"pooler"* || "$DATABASE_URL" == *"localhost"* ]] && [[ -n "${POSTGRES_HOST:-}" && -n "${POSTGRES_USER:-}" && -n "${POSTGRES_PASSWORD:-}" ]]; then
  db_name="${POSTGRES_DATABASE:-postgres}"
  export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${db_name}"
  export DIRECT_URL="$DATABASE_URL"
fi

if [[ -z "${DATABASE_URL:-}" || "$DATABASE_URL" == *"localhost"* ]]; then
  echo "ERROR: Set DATABASE_URL to Supabase direct host (db.*.supabase.co:5432), not localhost." >&2
  exit 1
fi

MIGRATIONS=(
  20260523120000_workspace_tasks
  20260523140000_workspace_invoices
  20260523160000_workspace_saved_searches
  20260523200000_scoring_workspace_and_rls
  20260523210000_email_template_body_format
  20260528120000_email_draft_optional_lead
  20260528140000_campaign_profile_type
  20260601123000_social_posts
  20260601124500_registration_workspace_target
  20260601131000_lead_member_audit
  20260601132000_personal_workspace_registration_repair
  20260601150000_meta_ads
  20260602120000_google_ads
  20260602130000_social_post_metadata
  20260607120000_media_generations
  20260607140000_media_lip_sync
  20260607150000_email_template_module
  20260607150000_workspace_tenant_created_by
  20260607160000_workspaces
  20260607170000_lead_query_indexes
  20260607200000_workspace_analytics_events
  20260607210000_domain_workspace_unique
)

for name in "${MIGRATIONS[@]}"; do
  echo "==> resolve --applied $name"
  pnpm exec prisma migrate resolve --applied "$name" || true
done

echo "Done. Run: pnpm exec prisma migrate status"
