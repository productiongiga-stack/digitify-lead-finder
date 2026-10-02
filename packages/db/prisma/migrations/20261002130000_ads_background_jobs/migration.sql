CREATE TABLE ad_background_jobs (
  id TEXT PRIMARY KEY,
  "createdById" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('GOOGLE','META')),
  kind TEXT NOT NULL CHECK (kind IN ('SYNC','OPTIMIZE','REMINDERS','RECOVERY','PROVIDER_CHECK')),
  "dedupeKey" TEXT NOT NULL UNIQUE,
  "dependencyId" TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseToken" TEXT,
  "leasedUntil" TIMESTAMP(3),
  result JSONB,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX ad_background_jobs_createdById_provider_status_runAt_idx ON ad_background_jobs("createdById",provider,status,"runAt");
ALTER TABLE ad_background_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_background_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_isolation ON ad_background_jobs
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());
