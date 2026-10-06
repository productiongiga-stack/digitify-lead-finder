ALTER TABLE "seo_keywords" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "seo_keywords" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "seo_keywords";
CREATE POLICY workspace_isolation ON "seo_keywords"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());

ALTER TABLE "seo_competitors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "seo_competitors" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "seo_competitors";
CREATE POLICY workspace_isolation ON "seo_competitors"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());
