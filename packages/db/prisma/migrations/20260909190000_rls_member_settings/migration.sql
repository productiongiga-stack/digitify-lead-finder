-- Allow RLS to distinguish shared workspace settings from member preferences.
-- The application sets both app.workspace_id and app.user_id per request.
CREATE OR REPLACE FUNCTION app_user_id() RETURNS text AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '');
$$ LANGUAGE sql STABLE;

DROP POLICY IF EXISTS workspace_isolation ON "settings";
CREATE POLICY workspace_isolation ON "settings"
  USING (
    app_rls_bypass()
    OR "key" LIKE 'workspace:' || app_workspace_id() || ':%'
    OR "key" LIKE 'user:' || app_workspace_id() || ':%'
    OR (app_user_id() IS NOT NULL AND "key" LIKE 'user:' || app_user_id() || ':%')
  )
  WITH CHECK (
    app_rls_bypass()
    OR "key" LIKE 'workspace:' || app_workspace_id() || ':%'
    OR "key" LIKE 'user:' || app_workspace_id() || ':%'
    OR (app_user_id() IS NOT NULL AND "key" LIKE 'user:' || app_user_id() || ':%')
  );
