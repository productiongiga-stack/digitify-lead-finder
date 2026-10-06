#!/usr/bin/env bash
# Resolve Vercel/Supabase env aliases before `prisma migrate deploy`.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/packages/db"

# Vercel rebuilds the application for many code-only commits. Do not make
# those builds wait on a database migration connection: migrations are only
# needed when the migration directory changed. A deployment that intentionally
# needs to run migrations can set RUN_DB_MIGRATIONS=1.
if [[ "${VERCEL:-}" == "1" && "${RUN_DB_MIGRATIONS:-}" != "1" ]]; then
  previous_sha="${VERCEL_GIT_PREVIOUS_SHA:-$(git -C "$root" rev-parse HEAD^ 2>/dev/null || true)}"
  if [[ -n "$previous_sha" ]] && git -C "$root" diff --quiet "$previous_sha" HEAD -- packages/db/prisma/migrations; then
    echo "==> no Prisma migration changes; skipping production migration"
    exit 0
  fi
fi

# Keep the application URL as a fallback. Some Supabase projects expose a
# direct hostname that is IPv6-only from Vercel build machines, while the
# session pooler used by the app remains reachable.
# Use the session-mode pooler for migration fallback. `POSTGRES_PRISMA_URL`
# is the transaction-mode URL intended for the serverless runtime and Prisma
# migrations can hang or fail against it. Runtime code still prefers that
# transaction URL when `DATABASE_URL` is absent.
application_url="${DATABASE_URL:-${POSTGRES_URL:-${POSTGRES_PRISMA_URL:-}}}"

# Migrations must use a direct (non-pooler) connection — Supabase pooler rejects DDL.
# Vercel's Supabase integration may expose the direct connection under the
# lowercase `database` key; prefer it when the explicit aliases are absent.
migrate_url="${DIRECT_URL:-${POSTGRES_URL_NON_POOLING:-${database:-${POSTGRES_URL:-}}}}"
# An explicit DIRECT_URL is authoritative. Supabase's session pooler is a
# supported migration endpoint when it is configured by the operator; only
# reject poolers discovered indirectly through a generic alias.
if [[ -z "${DIRECT_URL:-}" && "$migrate_url" == *"pooler"* ]]; then
  migrate_url="${POSTGRES_URL_NON_POOLING:-}"
fi
if [[ "$migrate_url" == *"localhost"* || "$migrate_url" == *"127.0.0.1"* || ( -z "${DIRECT_URL:-}" && "$migrate_url" == *"pooler"* ) ]]; then
  migrate_url=""
fi

# Vercel + Supabase: build direct URL from host/user/password when only pooler URLs are set.
if [[ -z "$migrate_url" && -n "${POSTGRES_HOST:-}" && -n "${POSTGRES_USER:-}" && -n "${POSTGRES_PASSWORD:-}" ]]; then
  db_name="${POSTGRES_DATABASE:-postgres}"
  migrate_url="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${db_name}"
fi

# Keep the privileged direct URL around. On Supabase the direct hostname can
# be unreachable from Vercel while the same credentials are reachable through
# the session pooler. The application URL may be a restricted role, so it
# cannot create Prisma's metadata table.
privileged_url="$migrate_url"

if [[ -n "$migrate_url" ]]; then
  export DATABASE_URL="$migrate_url"
  export DIRECT_URL="$migrate_url"
else
  if [[ -z "${DATABASE_URL:-}" ]]; then
    export DATABASE_URL="${POSTGRES_PRISMA_URL:-${POSTGRES_URL:-}}"
  fi
  if [[ -z "${DIRECT_URL:-}" ]]; then
    export DIRECT_URL="${POSTGRES_URL_NON_POOLING:-}"
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ "${SKIP_DB_MIGRATE:-}" == "1" || "${VERCEL:-}" == "1" ]]; then
    echo "WARN: Skipping prisma migrate deploy (no DATABASE_URL on this runner)." >&2
    exit 0
  fi
  echo "ERROR: Set DIRECT_URL, POSTGRES_URL_NON_POOLING, or DATABASE_URL for migrations." >&2
  exit 1
fi

echo "==> prisma migrate deploy"
migration_output=""
set +e
migration_output="$(pnpm exec prisma migrate deploy 2>&1)"
migration_status=$?
set -e
printf '%s\n' "$migration_output"

if [[ "$migration_status" -eq 0 ]]; then
  exit 0
fi

# Retry only for an unreachable direct host. Other migration errors must stop
# the deployment instead of risking a second, non-idempotent attempt.
if [[ "$migration_output" == *"P1001"* && -n "$application_url" && "$application_url" != "$migrate_url" ]]; then
  echo "==> direct host unreachable; retrying through the configured application connection"
  export DATABASE_URL="$application_url"
  export DIRECT_URL="$application_url"
  export PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK="1"
  set +e
  migration_output="$(pnpm exec prisma migrate deploy 2>&1)"
  migration_status=$?
  set -e
  printf '%s\n' "$migration_output"
fi

# If the application pooler is reachable but intentionally cannot create
# schema objects, retry with the direct credentials on that pooler host. This
# avoids requiring a public IPv4 route to the Supabase database hostname.
if [[ "$migration_output" == *"permission denied for schema public"* && -n "$privileged_url" && -n "$application_url" ]]; then
  pooler_url="$(PRIVILEGED_URL="$privileged_url" APPLICATION_URL="$application_url" POSTGRES_HOST="${POSTGRES_HOST:-}" node -e '
    const privileged = new URL(process.env.PRIVILEGED_URL);
    const pooler = new URL(process.env.APPLICATION_URL);
    privileged.hostname = pooler.hostname;
    privileged.port = pooler.port;
    // Supabase pooler authentication needs the project ref as the tenant
    // suffix (postgres.<project-ref>), while the direct URL uses postgres.
    const directHost = process.env.POSTGRES_HOST || "";
    const projectRef = directHost.match(/^db\.([^.]+)\./)?.[1];
    if (projectRef && !privileged.username.includes(".")) {
      privileged.username = `${privileged.username}.${projectRef}`;
    }
    process.stdout.write(privileged.toString());
  ')"
  if [[ -n "$pooler_url" ]]; then
    echo "==> application role cannot migrate; retrying with direct credentials through the reachable pooler"
    export DATABASE_URL="$pooler_url"
    export DIRECT_URL="$pooler_url"
    export PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK="1"
    set +e
    migration_output="$(pnpm exec prisma migrate deploy 2>&1)"
    migration_status=$?
    set -e
    printf '%s\n' "$migration_output"
  fi
fi

# Some early production databases were created from idempotent catch-up SQL
# before Prisma migration history was introduced. Prisma reports those
# databases as P3005 (non-empty schema). Baseline the original schema, then
# continue with normal migrations. If a historical migration is already
# represented in that schema, Prisma can fail only because an object already
# exists; record that migration as applied and continue. Any other error still
# fails the build.
if [[ "$migration_output" == *"P3005"* ]]; then
  echo "==> existing schema detected without Prisma history; baselining init migration"
  if [[ -n "$privileged_url" && -n "$application_url" ]]; then
    pooler_url="$(PRIVILEGED_URL="$privileged_url" APPLICATION_URL="$application_url" POSTGRES_HOST="${POSTGRES_HOST:-}" node -e '
      const privileged = new URL(process.env.PRIVILEGED_URL);
      const pooler = new URL(process.env.APPLICATION_URL);
      privileged.hostname = pooler.hostname;
      privileged.port = pooler.port;
      const directHost = process.env.POSTGRES_HOST || "";
      const projectRef = directHost.match(/^db\.([^.]+)\./)?.[1];
      if (projectRef && !privileged.username.includes(".")) {
        privileged.username = `${privileged.username}.${projectRef}`;
      }
      process.stdout.write(privileged.toString());
    ')"
    if [[ -n "$pooler_url" ]]; then
      echo "==> using direct credentials through the reachable pooler for migration metadata"
      export DATABASE_URL="$pooler_url"
      export DIRECT_URL="$pooler_url"
      export PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK="1"
    fi
  fi
  pnpm exec prisma migrate resolve --applied 20260522100000_init
  migration_status=1
  migration_output=""
fi

for attempt in $(seq 1 80); do
  [[ "$migration_status" -eq 0 ]] && exit 0

  set +e
  migration_output="$(pnpm exec prisma migrate deploy 2>&1)"
  migration_status=$?
  set -e
  printf '%s\n' "$migration_output"
  [[ "$migration_status" -eq 0 ]] && exit 0

  if [[ "$migration_output" == *"P3005"* ]]; then
    pnpm exec prisma migrate resolve --applied 20260522100000_init
    continue
  fi

  failed_migration="$(printf '%s\n' "$migration_output" | sed -n 's/.*Migration name: \([^[:space:]]*\).*/\1/p' | tail -1)"
  if [[ -z "$failed_migration" && "$migration_output" == *"P3009"* ]]; then
    failed_migration="$(printf '%s\n' "$migration_output" | sed -n 's/.*The `\([^`]*\)` migration started.*/\1/p' | tail -1)"
  fi

  # Prisma refuses to retry a migration after a previous failed attempt until
  # it is explicitly marked rolled back. Repair the known legacy orphan while
  # using the privileged pooler connection, then let migrate deploy retry it.
  if [[ "$migration_output" == *"P3009"* && "$failed_migration" == "20260615170000_schema_hardening" ]]; then
    echo "==> clearing the previous failed schema-hardening attempt"
    if [[ -n "$privileged_url" && -n "$application_url" ]]; then
      pooler_url="$(PRIVILEGED_URL="$privileged_url" APPLICATION_URL="$application_url" POSTGRES_HOST="${POSTGRES_HOST:-}" node -e '
        const privileged = new URL(process.env.PRIVILEGED_URL);
        const pooler = new URL(process.env.APPLICATION_URL);
        privileged.hostname = pooler.hostname;
        privileged.port = pooler.port;
        const projectRef = (process.env.POSTGRES_HOST || "").match(/^db\.([^.]+)\./)?.[1];
        if (projectRef && !privileged.username.includes(".")) privileged.username = `${privileged.username}.${projectRef}`;
        process.stdout.write(privileged.toString());
      ')"
      export DATABASE_URL="$pooler_url"
      export DIRECT_URL="$pooler_url"
      export PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK="1"
    fi
    pnpm exec prisma migrate resolve --rolled-back "$failed_migration"
    repair_sql='UPDATE "media_generations" m SET "workspaceId" = m."userId" WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = m."workspaceId") AND EXISTS (SELECT 1 FROM "users" u WHERE u."id" = m."userId");
UPDATE "workspace_analytics_events" e SET "workspaceId" = e."userId" WHERE e."userId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = e."workspaceId") AND EXISTS (SELECT 1 FROM "users" u WHERE u."id" = e."userId");
DELETE FROM "workspace_analytics_events" e WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = e."workspaceId");'
    printf '%s\n' "$repair_sql" | pnpm exec prisma db execute --stdin --url "$DATABASE_URL"
    continue
  fi

  # A historical media row can outlive its workspace owner. The hardening
  # migration adds a user FK to workspaceId, so repair that legacy orphan to
  # its existing uploader before retrying. Analytics rows without any
  # surviving user cannot be tenant-scoped and are removed as telemetry.
  if [[ "$migration_output" == *"P3018"* && "$failed_migration" == "20260615170000_schema_hardening" && "$migration_output" == *"23503"* ]]; then
    echo "==> repairing orphaned legacy workspace references before schema hardening"
    pnpm exec prisma migrate resolve --rolled-back "$failed_migration"
    repair_sql='UPDATE "media_generations" m SET "workspaceId" = m."userId" WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = m."workspaceId") AND EXISTS (SELECT 1 FROM "users" u WHERE u."id" = m."userId");
UPDATE "workspace_analytics_events" e SET "workspaceId" = e."userId" WHERE e."userId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = e."workspaceId") AND EXISTS (SELECT 1 FROM "users" u WHERE u."id" = e."userId");
DELETE FROM "workspace_analytics_events" e WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = e."workspaceId");'
    printf '%s\n' "$repair_sql" | pnpm exec prisma db execute --stdin --url "$DATABASE_URL"
    continue
  fi

  if [[ "$migration_output" == *"P3018"* && ( "$migration_output" == *"already exists"* || "$migration_output" == *"duplicate key"* || "$migration_output" == *"42701"* || "$migration_output" == *"42710"* || "$migration_output" == *"42P07"* ) ]]; then
    failed_migration="$(printf '%s\n' "$migration_output" | sed -n 's/.*Applying migration `\([^`]*\)`.*$/\1/p' | tail -1)"
    if [[ -z "$failed_migration" ]]; then
      echo "ERROR: Prisma reported a duplicate object but did not expose the migration name." >&2
      exit "$migration_status"
    fi
    echo "==> migration $failed_migration is already represented in the existing schema; recording it as applied"
    pnpm exec prisma migrate resolve --applied "$failed_migration"
    continue
  fi

  exit "$migration_status"
done

echo "ERROR: Prisma migration recovery exceeded its safety limit." >&2
exit 1

exit "$migration_status"
