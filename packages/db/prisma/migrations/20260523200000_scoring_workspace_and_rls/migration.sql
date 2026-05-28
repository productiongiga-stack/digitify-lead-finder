-- Scoring weights per workspace (_global = shared defaults)
ALTER TABLE "scoring_weights" ADD COLUMN IF NOT EXISTS "createdById" TEXT NOT NULL DEFAULT '_global';
UPDATE "scoring_weights" SET "createdById" = '_global' WHERE "createdById" IS NULL OR "createdById" = '';

DROP INDEX IF EXISTS "scoring_weights_factorKey_key";
CREATE UNIQUE INDEX IF NOT EXISTS "scoring_weights_createdById_factorKey_key"
  ON "scoring_weights"("createdById", "factorKey");
CREATE INDEX IF NOT EXISTS "scoring_weights_createdById_idx" ON "scoring_weights"("createdById");

-- enrichment_data: isolate via lead workspace
ALTER TABLE "enrichment_data" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enrichment_data" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "enrichment_data";
CREATE POLICY workspace_isolation ON "enrichment_data"
  USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM "leads" l
      WHERE l."id" = "enrichment_data"."leadId"
        AND l."createdById" = app_workspace_id()
    )
  )
  WITH CHECK (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM "leads" l
      WHERE l."id" = "enrichment_data"."leadId"
        AND l."createdById" = app_workspace_id()
    )
  );

-- chat_sessions: tenant tag on assignedToId + lead ownership
ALTER TABLE "chat_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_sessions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "chat_sessions";
CREATE POLICY workspace_isolation ON "chat_sessions"
  USING (
    app_rls_bypass() OR "assignedToId" = app_workspace_id()
    OR EXISTS (
      SELECT 1 FROM "leads" l
      WHERE l."id" = "chat_sessions"."leadId"
        AND l."createdById" = app_workspace_id()
    )
  )
  WITH CHECK (
    app_rls_bypass() OR "assignedToId" = app_workspace_id()
    OR EXISTS (
      SELECT 1 FROM "leads" l
      WHERE l."id" = "chat_sessions"."leadId"
        AND l."createdById" = app_workspace_id()
    )
  );

-- chat_messages: via session
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_messages" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "chat_messages";
CREATE POLICY workspace_isolation ON "chat_messages"
  USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM "chat_sessions" s
      WHERE s."id" = "chat_messages"."sessionId"
        AND (
          s."assignedToId" = app_workspace_id()
          OR EXISTS (
            SELECT 1 FROM "leads" l
            WHERE l."id" = s."leadId" AND l."createdById" = app_workspace_id()
          )
        )
    )
  )
  WITH CHECK (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM "chat_sessions" s
      WHERE s."id" = "chat_messages"."sessionId"
        AND (
          s."assignedToId" = app_workspace_id()
          OR EXISTS (
            SELECT 1 FROM "leads" l
            WHERE l."id" = s."leadId" AND l."createdById" = app_workspace_id()
          )
        )
    )
  );
