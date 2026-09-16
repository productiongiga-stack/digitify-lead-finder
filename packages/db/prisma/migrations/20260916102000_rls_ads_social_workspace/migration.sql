-- These records are owned by the workspace owner (createdById). Keep RLS
-- enabled and restrict the app role to the active tenant.
DO $migration$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['google_ad_accounts', 'google_ad_plans', 'meta_ad_accounts', 'meta_ad_plans', 'social_posts']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS workspace_isolation ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY workspace_isolation ON %I USING (app_rls_bypass() OR "createdById" = app_workspace_id()) WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id())',
      table_name
    );
  END LOOP;
END
$migration$;
