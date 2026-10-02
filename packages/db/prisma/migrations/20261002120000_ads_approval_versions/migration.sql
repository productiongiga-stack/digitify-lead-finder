CREATE TABLE "ad_versions" (
"id" TEXT PRIMARY KEY, "createdById" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
"provider" TEXT NOT NULL, "accountId" TEXT NOT NULL, "campaignId" TEXT NOT NULL,
"fingerprint" TEXT NOT NULL, "snapshot" JSONB NOT NULL, "metrics" JSONB,
"syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX ON "ad_versions" ("createdById","provider","campaignId","syncedAt");
CREATE TABLE "ad_change_sets" (
"id" TEXT PRIMARY KEY, "createdById" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
"authorId" TEXT NOT NULL REFERENCES users(id), "provider" TEXT NOT NULL, "accountId" TEXT NOT NULL,
"campaignId" TEXT NOT NULL, "baseVersionId" TEXT NOT NULL REFERENCES ad_versions(id),
"beforeHash" TEXT NOT NULL, "afterHash" TEXT NOT NULL, "before" JSONB NOT NULL, "after" JSONB NOT NULL,
"reason" TEXT NOT NULL, "source" TEXT NOT NULL DEFAULT 'MANUAL', "risk" TEXT NOT NULL DEFAULT 'MEDIUM',
"checks" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX ON "ad_change_sets" ("createdById","provider","status");
CREATE TABLE "ad_approval_requests" (
"id" TEXT PRIMARY KEY, "createdById" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
"changeSetId" TEXT NOT NULL UNIQUE REFERENCES ad_change_sets(id) ON DELETE CASCADE,
"versionHash" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
"decidedById" TEXT REFERENCES users(id), "decidedAt" TIMESTAMP(3), "reason" TEXT,
"remindedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX ON "ad_approval_requests" ("createdById","status");
CREATE TABLE "ad_sync_operations" (
"id" TEXT PRIMARY KEY, "createdById" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
"provider" TEXT NOT NULL, "changeSetId" TEXT NOT NULL UNIQUE REFERENCES ad_change_sets(id),
"idempotencyKey" TEXT NOT NULL UNIQUE, "status" TEXT NOT NULL DEFAULT 'PENDING',
"attempts" INTEGER NOT NULL DEFAULT 0, "response" JSONB, "errorCode" TEXT, "lastError" TEXT,
"startedAt" TIMESTAMP(3), "finishedAt" TIMESTAMP(3),
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX ON "ad_sync_operations" ("createdById","status");
CREATE TABLE "ai_optimization_runs" (
"id" TEXT PRIMARY KEY, "createdById" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
"provider" TEXT NOT NULL, "periodStart" TIMESTAMP(3) NOT NULL, "periodEnd" TIMESTAMP(3) NOT NULL,
"promptVersion" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'RUNNING', "model" TEXT,
"input" JSONB NOT NULL, "result" JSONB, "lastError" TEXT,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "finishedAt" TIMESTAMP(3));
CREATE INDEX ON "ai_optimization_runs" ("createdById","provider","createdAt");
DO $$ DECLARE t TEXT; BEGIN
FOREACH t IN ARRAY ARRAY['ad_versions','ad_change_sets','ad_approval_requests','ad_sync_operations','ai_optimization_runs'] LOOP
EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
EXECUTE format('CREATE POLICY workspace_isolation ON %I USING (app_rls_bypass() OR "createdById" = app_workspace_id()) WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id())', t);
END LOOP; END $$;
