-- Private authentication tables are server-only, not user/workspace resources.
-- Supabase Data API roles are denied even if a future grant is accidentally added.
-- Production preflight must check the actual trusted application's table grants.
ALTER TABLE login_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_challenges FORCE ROW LEVEL SECURITY;
CREATE POLICY server_only ON login_challenges USING (current_user NOT IN ('anon', 'authenticated', 'authenticator')) WITH CHECK (current_user NOT IN ('anon', 'authenticated', 'authenticator'));
ALTER TABLE two_factor_recovery_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE two_factor_recovery_grants FORCE ROW LEVEL SECURITY;
CREATE POLICY server_only ON two_factor_recovery_grants USING (current_user NOT IN ('anon', 'authenticated', 'authenticator')) WITH CHECK (current_user NOT IN ('anon', 'authenticated', 'authenticator'));
ALTER TABLE auth_rate_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_rate_buckets FORCE ROW LEVEL SECURITY;
CREATE POLICY server_only ON auth_rate_buckets USING (current_user NOT IN ('anon', 'authenticated', 'authenticator')) WITH CHECK (current_user NOT IN ('anon', 'authenticated', 'authenticator'));
