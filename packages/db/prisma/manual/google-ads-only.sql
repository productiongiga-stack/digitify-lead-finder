-- Google Ads tables catch-up for Supabase (idempotent). Run in SQL Editor if google_ad_* tables are missing.

ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'GOOGLE_AD_DRAFT_CREATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'GOOGLE_AD_SUBMITTED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'GOOGLE_AD_APPROVED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'GOOGLE_AD_REJECTED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'GOOGLE_AD_PUSHED_PAUSED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'GOOGLE_AD_FAILED';

DO $$ BEGIN
  CREATE TYPE "GoogleAdPlanStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUSHING', 'PUSHED_PAUSED', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GoogleAdCampaignType" AS ENUM ('SEARCH', 'PERFORMANCE_MAX');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "google_ad_accounts" (
  "id" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "externalCustomerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "currency" TEXT DEFAULT 'EUR',
  "timezoneName" TEXT,
  "isSelected" BOOLEAN NOT NULL DEFAULT false,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "google_ad_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "google_ad_plans" (
  "id" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "name" TEXT NOT NULL,
  "campaignType" "GoogleAdCampaignType" NOT NULL DEFAULT 'SEARCH',
  "status" "GoogleAdPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "dailyBudgetCents" INTEGER,
  "lifetimeBudgetCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "startTime" TIMESTAMP(3),
  "endTime" TIMESTAMP(3),
  "targeting" JSONB,
  "creatives" JSONB,
  "externalIds" JSONB,
  "approvedAt" TIMESTAMP(3),
  "pushedAt" TIMESTAMP(3),
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "google_ad_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "google_ad_accounts_createdById_externalCustomerId_key" ON "google_ad_accounts"("createdById", "externalCustomerId");
CREATE INDEX IF NOT EXISTS "google_ad_accounts_createdById_isSelected_idx" ON "google_ad_accounts"("createdById", "isSelected");
CREATE INDEX IF NOT EXISTS "google_ad_plans_createdById_status_idx" ON "google_ad_plans"("createdById", "status");
CREATE INDEX IF NOT EXISTS "google_ad_plans_createdById_updatedAt_idx" ON "google_ad_plans"("createdById", "updatedAt" DESC);

DO $$ BEGIN
  ALTER TABLE "google_ad_accounts" ADD CONSTRAINT "google_ad_accounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "google_ad_plans" ADD CONSTRAINT "google_ad_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "google_ad_plans" ADD CONSTRAINT "google_ad_plans_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
