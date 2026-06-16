-- Fix openclaw_logs RLS: members write userId = member id, not workspace owner id.

DROP POLICY IF EXISTS workspace_isolation ON "openclaw_logs";
CREATE POLICY workspace_isolation ON "openclaw_logs"
  USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "users" u
      WHERE u.id = "openclaw_logs"."userId"
        AND COALESCE(u."workspaceOwnerId", u.id) = app_workspace_id()
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "users" u
      WHERE u.id = "openclaw_logs"."userId"
        AND COALESCE(u."workspaceOwnerId", u.id) = app_workspace_id()
    )
  );
