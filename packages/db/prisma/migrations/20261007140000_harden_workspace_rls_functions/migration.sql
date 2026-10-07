-- Keep workspace RLS helpers independent from a caller-controlled search_path.
CREATE OR REPLACE FUNCTION public.app_workspace_id() RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT NULLIF(current_setting('app.workspace_id', true), '');
$$;

CREATE OR REPLACE FUNCTION public.app_rls_bypass() RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT public.app_workspace_id() IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.app_workspace_owner_id() RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(
    (SELECT w."ownerUserId" FROM public."workspaces" w WHERE w."id" = public.app_workspace_id()),
    public.app_workspace_id()
  );
$$;
