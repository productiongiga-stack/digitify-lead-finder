ALTER TABLE "lead_analysis_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lead_analysis_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_isolation ON "lead_analysis_runs"
  USING (app_rls_bypass() OR "workspaceId" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "workspaceId" = app_workspace_id());
