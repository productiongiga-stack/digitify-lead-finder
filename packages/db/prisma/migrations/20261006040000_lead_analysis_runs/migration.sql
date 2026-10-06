CREATE TYPE "LeadAnalysisRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'BLOCKED');

CREATE TABLE "lead_analysis_runs" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "status" "LeadAnalysisRunStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "leaseUntil" TIMESTAMP(3),
  "profileHash" TEXT NOT NULL,
  "profileVersion" INTEGER NOT NULL DEFAULT 1,
  "model" TEXT,
  "promptVersion" TEXT NOT NULL DEFAULT 'lead-analysis-v2',
  "idempotencyKey" TEXT NOT NULL,
  "inputSnapshot" JSONB NOT NULL,
  "result" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "lead_analysis_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lead_analysis_runs_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "lead_analysis_runs_idempotencyKey_key" ON "lead_analysis_runs"("idempotencyKey");
CREATE INDEX "lead_analysis_runs_workspaceId_status_createdAt_idx" ON "lead_analysis_runs"("workspaceId", "status", "createdAt" DESC);
CREATE INDEX "lead_analysis_runs_workspaceId_leadId_createdAt_idx" ON "lead_analysis_runs"("workspaceId", "leadId", "createdAt" DESC);
CREATE INDEX "lead_analysis_runs_leadId_profileHash_idx" ON "lead_analysis_runs"("leadId", "profileHash");
