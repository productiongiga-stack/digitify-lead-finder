ALTER TABLE users ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN "twoFactorRecoveryRequired" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE user_two_factors (
  "userId" TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret TEXT, "enabledAt" TIMESTAMP(3), "lastUsedStep" BIGINT NOT NULL DEFAULT -1,
  "pendingSecret" TEXT, "pendingExpiresAt" TIMESTAMP(3), "pendingVersion" INTEGER,
  "pendingCodeHashes" JSONB, "pendingProofHash" TEXT, "pendingStep" BIGINT,
  failures INTEGER NOT NULL DEFAULT 0, "failureWindowAt" TIMESTAMP(3)
);
CREATE TABLE two_factor_recovery_codes (
  id TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "codeHash" TEXT NOT NULL, "usedAt" TIMESTAMP(3), UNIQUE("userId", "codeHash")
);
ALTER TABLE user_two_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_two_factors FORCE ROW LEVEL SECURITY;
CREATE POLICY self_only ON user_two_factors USING ("userId" = app_user_id()) WITH CHECK ("userId" = app_user_id());
ALTER TABLE two_factor_recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE two_factor_recovery_codes FORCE ROW LEVEL SECURITY;
CREATE POLICY self_only ON two_factor_recovery_codes USING ("userId" = app_user_id()) WITH CHECK ("userId" = app_user_id());
-- Like password_reset_tokens: private auth lookup by unguessable token hash;
-- not exposed through tenant routers, exports or a public database client.
CREATE TABLE login_challenges (
  id TEXT PRIMARY KEY, purpose TEXT NOT NULL DEFAULT 'LOGIN', "tokenHash" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "sessionVersion" INTEGER NOT NULL, "requiresTwoFactor" BOOLEAN NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, "usedAt" TIMESTAMP(3)
);
CREATE INDEX "login_challenges_userId_expiresAt_idx" ON login_challenges("userId", "expiresAt");
CREATE TABLE two_factor_recovery_grants (
  id TEXT PRIMARY KEY, "tokenHash" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "sessionVersion" INTEGER NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3),
  "operatorId" TEXT NOT NULL, ticket TEXT NOT NULL, reason TEXT NOT NULL
);
CREATE TABLE auth_rate_buckets (key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, "expiresAt" TIMESTAMP(3) NOT NULL);
REVOKE ALL ON user_two_factors, two_factor_recovery_codes, login_challenges, two_factor_recovery_grants, auth_rate_buckets FROM PUBLIC;
-- Never grant authentication material to Supabase/PostgREST public roles.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digitify_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON user_two_factors, two_factor_recovery_codes,
      login_challenges, two_factor_recovery_grants, auth_rate_buckets TO digitify_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON user_two_factors, two_factor_recovery_codes, login_challenges, two_factor_recovery_grants, auth_rate_buckets FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON user_two_factors, two_factor_recovery_codes, login_challenges, two_factor_recovery_grants, auth_rate_buckets FROM authenticated;
  END IF;
END $$;
