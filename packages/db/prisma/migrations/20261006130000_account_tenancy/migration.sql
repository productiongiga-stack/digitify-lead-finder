-- Explicit account and tenant metadata. Defaults keep existing users compatible.
CREATE TYPE "AccountClass" AS ENUM ('PLATFORM_OWNER', 'PLATFORM_SUPPORT', 'CLIENT_OWNER', 'CLIENT_MEMBER', 'TESTER', 'TRIAL');
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');
CREATE TYPE "PlatformRole" AS ENUM ('OWNER', 'SUPPORT');

-- RLS keeps the technical workspace in app.workspace_id. Legacy tables still
-- store the company owner's user id in createdById, so their policies use the
-- derived owner function below.
CREATE OR REPLACE FUNCTION app_workspace_owner_id() RETURNS text AS $$
  SELECT COALESCE(
    (SELECT w."ownerUserId" FROM "workspaces" w WHERE w."id" = app_workspace_id()),
    app_workspace_id()
  );
$$ LANGUAGE sql STABLE;

ALTER TABLE "users"
  ADD COLUMN "accountClass" "AccountClass" NOT NULL DEFAULT 'CLIENT_OWNER',
  ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "platformRole" "PlatformRole",
  ADD COLUMN "trialEndsAt" TIMESTAMP(3);

CREATE TABLE "workspace_module_entitlements" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "source" TEXT NOT NULL DEFAULT 'FREE',
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workspace_module_entitlements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workspace_module_entitlements_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "workspace_module_entitlements_workspaceId_moduleId_key"
  ON "workspace_module_entitlements"("workspaceId", "moduleId");
CREATE INDEX "workspace_module_entitlements_workspaceId_status_idx"
  ON "workspace_module_entitlements"("workspaceId", "status");

ALTER TABLE "workspace_module_entitlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_module_entitlements" FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_isolation ON "workspace_module_entitlements"
  USING (app_rls_bypass() OR "workspaceId" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "workspaceId" = app_workspace_id());

-- Existing trial users receive the new 14-day window only when it was not set.
UPDATE "users"
SET "accountClass" = CASE
  WHEN "role" = 'TESTER' THEN 'TESTER'::"AccountClass"
  WHEN "role" = 'TRIAL' THEN 'TRIAL'::"AccountClass"
  WHEN "role" IN ('OWNER', 'ADMIN') THEN 'CLIENT_OWNER'::"AccountClass"
  ELSE 'CLIENT_MEMBER'::"AccountClass"
END,
"trialEndsAt" = CASE WHEN "role" = 'TRIAL' THEN "createdAt" + INTERVAL '14 days' ELSE NULL END
WHERE "accountClass" = 'CLIENT_OWNER';

INSERT INTO "workspace_module_entitlements" ("id", "workspaceId", "moduleId", "status", "source", "createdAt", "updatedAt")
SELECT md5(w."id" || ':' || modules."moduleId"), w."id", modules."moduleId", 'ACTIVE', 'FREE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "workspaces" w
CROSS JOIN (VALUES ('leads'), ('leadFinder'), ('campaigns'), ('scoring'), ('crm'), ('tasks')) AS modules("moduleId")
ON CONFLICT ("workspaceId", "moduleId") DO NOTHING;

-- Update existing createdById policies without changing workspaceId policies.
DO $$
DECLARE p record;
DECLARE roles_sql text;
DECLARE qual_sql text;
DECLARE check_sql text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, permissive, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND ((qual ILIKE '%createdById%' AND qual ILIKE '%app_workspace_id%')
        OR (with_check ILIKE '%createdById%' AND with_check ILIKE '%app_workspace_id%'))
  LOOP
    roles_sql := array_to_string(p.roles, ', ');
    qual_sql := replace(p.qual, 'app_workspace_id()', 'app_workspace_owner_id()');
    check_sql := replace(p.with_check, 'app_workspace_id()', 'app_workspace_owner_id()');
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    EXECUTE format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s USING (%s)%s',
      p.policyname, p.schemaname, p.tablename,
      CASE WHEN p.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      p.cmd, roles_sql, qual_sql,
      CASE WHEN p.with_check IS NULL THEN '' ELSE format(' WITH CHECK (%s)', check_sql) END);
  END LOOP;
END $$;
