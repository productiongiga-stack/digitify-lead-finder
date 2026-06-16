-- Extend RLS coverage for tenant-scoped child tables and settings.

-- notes (via lead workspace)
ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "notes";
CREATE POLICY workspace_isolation ON "notes"
  USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "leads" l
      WHERE l.id = "notes"."leadId" AND l."createdById" = app_workspace_id()
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "leads" l
      WHERE l.id = "notes"."leadId" AND l."createdById" = app_workspace_id()
    )
  );

-- activities (via lead workspace when leadId set)
ALTER TABLE "activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activities" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "activities";
CREATE POLICY workspace_isolation ON "activities"
  USING (
    app_rls_bypass()
    OR (
      "leadId" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM "leads" l
        WHERE l.id = "activities"."leadId" AND l."createdById" = app_workspace_id()
      )
    )
    OR (
      "leadId" IS NULL
      AND "userId" IS NOT NULL
      AND "userId" = app_workspace_id()
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR (
      "leadId" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM "leads" l
        WHERE l.id = "activities"."leadId" AND l."createdById" = app_workspace_id()
      )
    )
    OR (
      "leadId" IS NULL
      AND "userId" IS NOT NULL
      AND "userId" = app_workspace_id()
    )
  );

-- social_posts
ALTER TABLE "social_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "social_posts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "social_posts";
CREATE POLICY workspace_isolation ON "social_posts"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());

-- media_generations
ALTER TABLE "media_generations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "media_generations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "media_generations";
CREATE POLICY workspace_isolation ON "media_generations"
  USING (app_rls_bypass() OR "workspaceId" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "workspaceId" = app_workspace_id());

-- settings (user:{workspaceId}:* and workspace:{workspaceId}:*)
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settings" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "settings";
CREATE POLICY workspace_isolation ON "settings"
  USING (
    app_rls_bypass()
    OR "key" LIKE 'user:' || app_workspace_id() || ':%'
    OR "key" LIKE 'workspace:' || app_workspace_id() || ':%'
  )
  WITH CHECK (
    app_rls_bypass()
    OR "key" LIKE 'user:' || app_workspace_id() || ':%'
    OR "key" LIKE 'workspace:' || app_workspace_id() || ':%'
  );

-- email_drafts: include author-scoped drafts without lead
DROP POLICY IF EXISTS workspace_isolation ON "email_drafts";
CREATE POLICY workspace_isolation ON "email_drafts"
  USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "leads" l
      WHERE l.id = "email_drafts"."leadId" AND l."createdById" = app_workspace_id()
    )
    OR (
      "leadId" IS NULL
      AND "authorId" = app_workspace_id()
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "leads" l
      WHERE l.id = "email_drafts"."leadId" AND l."createdById" = app_workspace_id()
    )
    OR (
      "leadId" IS NULL
      AND "authorId" = app_workspace_id()
    )
  );

-- campaign_leads via campaign
ALTER TABLE "campaign_leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campaign_leads" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "campaign_leads";
CREATE POLICY workspace_isolation ON "campaign_leads"
  USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "campaigns" c
      WHERE c.id = "campaign_leads"."campaignId" AND c."createdById" = app_workspace_id()
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "campaigns" c
      WHERE c.id = "campaign_leads"."campaignId" AND c."createdById" = app_workspace_id()
    )
  );

-- lead_tags via lead
ALTER TABLE "lead_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lead_tags" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "lead_tags";
CREATE POLICY workspace_isolation ON "lead_tags"
  USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "leads" l
      WHERE l.id = "lead_tags"."leadId" AND l."createdById" = app_workspace_id()
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "leads" l
      WHERE l.id = "lead_tags"."leadId" AND l."createdById" = app_workspace_id()
    )
  );

-- scoring_weights
ALTER TABLE "scoring_weights" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scoring_weights" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "scoring_weights";
CREATE POLICY workspace_isolation ON "scoring_weights"
  USING (app_rls_bypass() OR "createdById" IS NULL OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" IS NULL OR "createdById" = app_workspace_id());
