-- Give every outbound draft an explicit workspace scope so drafts without a
-- linked lead remain tenant-safe and visible to the whole workspace.
ALTER TABLE "email_drafts"
  ADD COLUMN "workspaceId" TEXT,
  ADD COLUMN "idempotencyKey" TEXT;

UPDATE "email_drafts" d
SET "workspaceId" = l."createdById"
FROM "leads" l
WHERE d."leadId" = l."id" AND d."workspaceId" IS NULL;

UPDATE "email_drafts" d
SET "workspaceId" = COALESCE(u."workspaceOwnerId", u."id")
FROM "users" u
WHERE d."authorId" = u."id" AND d."workspaceId" IS NULL;

ALTER TABLE "email_drafts"
  ALTER COLUMN "workspaceId" SET NOT NULL;

CREATE INDEX "email_drafts_workspaceId_status_idx"
  ON "email_drafts"("workspaceId", "status");
CREATE INDEX "email_drafts_workspaceId_createdAt_idx"
  ON "email_drafts"("workspaceId", "createdAt" DESC);
CREATE UNIQUE INDEX "email_drafts_workspaceId_idempotencyKey_key"
  ON "email_drafts"("workspaceId", "idempotencyKey");

-- Replace the legacy lead/author fallback with an explicit workspace policy.
ALTER TABLE "email_drafts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_drafts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "email_drafts";
CREATE POLICY workspace_isolation ON "email_drafts"
  USING (app_rls_bypass() OR "workspaceId" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "workspaceId" = app_workspace_id());
