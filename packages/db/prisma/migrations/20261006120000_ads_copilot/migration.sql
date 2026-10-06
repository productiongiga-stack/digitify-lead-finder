ALTER TABLE "ad_change_sets"
  ADD COLUMN "researchRunId" TEXT,
  ADD COLUMN "confidence" DOUBLE PRECISION,
  ADD COLUMN "evidenceRefs" JSONB;

ALTER TABLE "ad_background_jobs" DROP CONSTRAINT IF EXISTS ad_background_jobs_kind_check;
ALTER TABLE "ad_background_jobs" ADD CONSTRAINT ad_background_jobs_kind_check
  CHECK (kind IN ('SYNC','OPTIMIZE','RESEARCH','REMINDERS','RECOVERY','PROVIDER_CHECK'));

CREATE TABLE "ad_research_runs" (
  "id" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "sourceMode" TEXT NOT NULL DEFAULT 'ACCOUNT_DATA',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "objective" TEXT,
  "campaignIds" JSONB,
  "input" JSONB NOT NULL,
  "profileHash" TEXT,
  "profileVersion" INTEGER,
  "promptVersion" TEXT NOT NULL,
  "model" TEXT,
  "result" JSONB,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "leaseToken" TEXT,
  "leasedUntil" TIMESTAMP(3),
  "idempotencyKey" TEXT NOT NULL,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ad_research_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ad_research_evidence" (
  "id" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "researchRunId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT,
  "url" TEXT,
  "excerpt" TEXT,
  "digest" TEXT,
  "metadata" JSONB,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ad_research_evidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ad_research_runs_createdById_idempotencyKey_key" ON "ad_research_runs"("createdById", "idempotencyKey");
CREATE INDEX "ad_research_runs_createdById_status_createdAt_idx" ON "ad_research_runs"("createdById", "status", "createdAt" DESC);
CREATE INDEX "ad_research_runs_createdById_provider_createdAt_idx" ON "ad_research_runs"("createdById", "provider", "createdAt" DESC);
CREATE INDEX "ad_research_evidence_createdById_researchRunId_fetchedAt_idx" ON "ad_research_evidence"("createdById", "researchRunId", "fetchedAt" DESC);
CREATE INDEX "ad_research_evidence_createdById_kind_fetchedAt_idx" ON "ad_research_evidence"("createdById", "kind", "fetchedAt" DESC);

ALTER TABLE "ad_change_sets" ADD CONSTRAINT "ad_change_sets_researchRunId_fkey"
  FOREIGN KEY ("researchRunId") REFERENCES "ad_research_runs"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "ad_research_runs" ADD CONSTRAINT "ad_research_runs_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "ad_research_evidence" ADD CONSTRAINT "ad_research_evidence_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "ad_research_evidence" ADD CONSTRAINT "ad_research_evidence_researchRunId_fkey"
  FOREIGN KEY ("researchRunId") REFERENCES "ad_research_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "ad_research_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ad_research_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_isolation ON "ad_research_runs"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());

ALTER TABLE "ad_research_evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ad_research_evidence" FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_isolation ON "ad_research_evidence"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());
