-- Media generations catch-up for Supabase (idempotent).
-- Run in SQL Editor if creative studio / media_generations table is missing.

DO $$ BEGIN
  CREATE TYPE "MediaGenerationType" AS ENUM ('IMAGE', 'VIDEO', 'MARKETING_AD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MediaGenerationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "MediaGenerationType" ADD VALUE IF NOT EXISTS 'LIP_SYNC';

CREATE TABLE IF NOT EXISTS "media_generations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "MediaGenerationType" NOT NULL,
    "model" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" "MediaGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "requestId" TEXT,
    "outputUrl" TEXT,
    "blobUrl" TEXT,
    "metadata" JSONB,
    "socialPostId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "media_generations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "media_generations_workspaceId_createdAt_idx"
  ON "media_generations"("workspaceId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "media_generations_userId_createdAt_idx"
  ON "media_generations"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "media_generations_status_updatedAt_idx"
  ON "media_generations"("status", "updatedAt");

DO $$ BEGIN
  ALTER TABLE "media_generations"
    ADD CONSTRAINT "media_generations_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
