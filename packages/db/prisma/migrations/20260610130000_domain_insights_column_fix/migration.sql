-- Repair environments that applied the first draft with snake_case column names.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'domains' AND column_name = 'analysis_data'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'domains' AND column_name = 'analysisData'
  ) THEN
    ALTER TABLE "domains" RENAME COLUMN "analysis_data" TO "analysisData";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'domains' AND column_name = 'tracker_data'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'domains' AND column_name = 'trackerData'
  ) THEN
    ALTER TABLE "domains" RENAME COLUMN "tracker_data" TO "trackerData";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'domains' AND column_name = 'last_analyzed_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'domains' AND column_name = 'lastAnalyzedAt'
  ) THEN
    ALTER TABLE "domains" RENAME COLUMN "last_analyzed_at" TO "lastAnalyzedAt";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'domains' AND column_name = 'last_tracker_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'domains' AND column_name = 'lastTrackerAt'
  ) THEN
    ALTER TABLE "domains" RENAME COLUMN "last_tracker_at" TO "lastTrackerAt";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'domains' AND column_name = 'health_score'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'domains' AND column_name = 'healthScore'
  ) THEN
    ALTER TABLE "domains" RENAME COLUMN "health_score" TO "healthScore";
  END IF;
END $$;

DROP INDEX IF EXISTS "domains_createdById_health_score_idx";
DROP INDEX IF EXISTS "domains_createdById_last_analyzed_at_idx";

CREATE INDEX IF NOT EXISTS "domains_createdById_healthScore_idx" ON "domains"("createdById", "healthScore");
CREATE INDEX IF NOT EXISTS "domains_createdById_lastAnalyzedAt_idx" ON "domains"("createdById", "lastAnalyzedAt");
