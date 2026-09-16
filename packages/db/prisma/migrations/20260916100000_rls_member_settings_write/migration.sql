-- Allow an owner/admin to manage per-member settings inside the active
-- workspace while retaining tenant isolation. Platform-owner operations set
-- app.user_id to the already validated target account for their transaction.
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
    OR EXISTS (
      SELECT 1
      FROM "workspace_memberships" wm
      WHERE wm."workspaceId" = app_workspace_id()
        AND wm."userId" = split_part("settings"."key", ':', 2)
        AND wm."status" = 'ACTIVE'
        AND "settings"."key" LIKE 'user:%:%'
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR "key" LIKE 'workspace:' || app_workspace_id() || ':%'
    OR "key" LIKE 'user:' || app_workspace_id() || ':%'
    OR (app_user_id() IS NOT NULL AND "key" LIKE 'user:' || app_user_id() || ':%')
    OR EXISTS (
      SELECT 1
      FROM "workspace_memberships" wm
      WHERE wm."workspaceId" = app_workspace_id()
        AND wm."userId" = split_part("settings"."key", ':', 2)
        AND wm."status" = 'ACTIVE'
        AND "settings"."key" LIKE 'user:%:%'
    )
  );
