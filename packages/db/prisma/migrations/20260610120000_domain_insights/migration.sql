-- Domain insights columns use camelCase (matches init migration + Prisma schema).

ALTER TABLE "domains"
  ADD COLUMN IF NOT EXISTS "analysisData" JSONB,
  ADD COLUMN IF NOT EXISTS "trackerData" JSONB,
  ADD COLUMN IF NOT EXISTS "lastAnalyzedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastTrackerAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "healthScore" INTEGER;

CREATE INDEX IF NOT EXISTS "domains_createdById_healthScore_idx" ON "domains"("createdById", "healthScore");
CREATE INDEX IF NOT EXISTS "domains_createdById_lastAnalyzedAt_idx" ON "domains"("createdById", "lastAnalyzedAt");
