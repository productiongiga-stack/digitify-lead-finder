-- Defense-in-depth workspace isolation (opt-in via ENABLE_WORKSPACE_RLS=true).
-- App sets: SELECT set_config('app.workspace_id', '<workspaceOwnerId>', true) per request transaction.

CREATE OR REPLACE FUNCTION app_workspace_id() RETURNS text AS $$
  SELECT NULLIF(current_setting('app.workspace_id', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_rls_bypass() RETURNS boolean AS $$
  SELECT app_workspace_id() IS NULL;
$$ LANGUAGE sql STABLE;

-- leads
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leads" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "leads";
CREATE POLICY workspace_isolation ON "leads"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());

-- campaigns
ALTER TABLE "campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campaigns" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "campaigns";
CREATE POLICY workspace_isolation ON "campaigns"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());

-- email_templates
ALTER TABLE "email_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_templates" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "email_templates";
CREATE POLICY workspace_isolation ON "email_templates"
  USING (app_rls_bypass() OR "createdById" IS NULL OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" IS NULL OR "createdById" = app_workspace_id());

-- quotes
ALTER TABLE "quotes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quotes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "quotes";
CREATE POLICY workspace_isolation ON "quotes"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());

-- bookings
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bookings" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "bookings";
CREATE POLICY workspace_isolation ON "bookings"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());

-- domains
ALTER TABLE "domains" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "domains" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "domains";
CREATE POLICY workspace_isolation ON "domains"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());

-- review_requests
ALTER TABLE "review_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "review_requests" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "review_requests";
CREATE POLICY workspace_isolation ON "review_requests"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());

-- pipeline_stages
ALTER TABLE "pipeline_stages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pipeline_stages" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "pipeline_stages";
CREATE POLICY workspace_isolation ON "pipeline_stages"
  USING (app_rls_bypass() OR "createdById" IS NULL OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" IS NULL OR "createdById" = app_workspace_id());

-- tags
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tags" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "tags";
CREATE POLICY workspace_isolation ON "tags"
  USING (app_rls_bypass() OR "createdById" IS NULL OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" IS NULL OR "createdById" = app_workspace_id());

-- reports (generatedById = workspace owner)
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reports" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "reports";
CREATE POLICY workspace_isolation ON "reports"
  USING (app_rls_bypass() OR "generatedById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "generatedById" = app_workspace_id());

-- email_drafts (scoped via lead workspace)
ALTER TABLE "email_drafts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_drafts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "email_drafts";
CREATE POLICY workspace_isolation ON "email_drafts"
  USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "leads" l
      WHERE l.id = "email_drafts"."leadId"
        AND l."createdById" = app_workspace_id()
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "leads" l
      WHERE l.id = "email_drafts"."leadId"
        AND l."createdById" = app_workspace_id()
    )
  );
