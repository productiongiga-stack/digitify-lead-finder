-- Keep the RLS helper independent from a caller-controlled search_path.
CREATE OR REPLACE FUNCTION app_user_id() RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '');
$$;
