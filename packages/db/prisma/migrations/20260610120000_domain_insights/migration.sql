ALTER TABLE "domains"
  ADD COLUMN IF NOT EXISTS "analysis_data" JSONB,
  ADD COLUMN IF NOT EXISTS "tracker_data" JSONB,
  ADD COLUMN IF NOT EXISTS "last_analyzed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_tracker_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "health_score" INTEGER;

CREATE INDEX IF NOT EXISTS "domains_createdById_health_score_idx" ON "domains"("createdById", "health_score");
CREATE INDEX IF NOT EXISTS "domains_createdById_last_analyzed_at_idx" ON "domains"("createdById", "last_analyzed_at");
