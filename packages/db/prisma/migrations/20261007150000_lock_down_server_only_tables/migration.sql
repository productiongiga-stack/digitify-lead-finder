-- These tables are accessed only by the server-side Prisma role. Keep them
-- out of PostgREST's anon/authenticated surface while preserving backend use.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users',
    'accounts',
    'sessions',
    'user_permissions',
    'custom_fields',
    'email_sequences',
    'report_templates',
    'background_jobs',
    'saved_views',
    'workspaces',
    'workspace_memberships',
    'account_view_sessions',
    'security_audit_events',
    'lead_forms',
    'form_submissions',
    'workflows',
    'workflow_runs',
    'knowledge_entries',
    'knowledge_entry_versions',
    'projects',
    'contracts',
    'password_reset_tokens',
    'ase_licenses',
    '_prisma_migrations',
    'feedback_items',
    'registration_requests'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS server_only ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY server_only ON public.%I USING (current_user NOT IN (''anon'', ''authenticated'', ''authenticator'')) WITH CHECK (current_user NOT IN (''anon'', ''authenticated'', ''authenticator''))',
      table_name
    );
  END LOOP;
END $$;
