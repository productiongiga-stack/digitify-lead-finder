-- Meta Ads v1: workspace-scoped ad accounts and draft approval plans.
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'META_AD_DRAFT_CREATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'META_AD_SUBMITTED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'META_AD_APPROVED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'META_AD_REJECTED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'META_AD_PUSHED_PAUSED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'META_AD_FAILED';

DO $$ BEGIN
  CREATE TYPE "MetaAdPlanStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUSHING', 'PUSHED_PAUSED', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "meta_ad_accounts" (
  "id" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "externalAccountId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "currency" TEXT DEFAULT 'EUR',
  "timezoneName" TEXT,
  "businessId" TEXT,
  "isSelected" BOOLEAN NOT NULL DEFAULT false,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meta_ad_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "meta_ad_plans" (
  "id" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "name" TEXT NOT NULL,
  "objective" TEXT NOT NULL DEFAULT 'OUTCOME_TRAFFIC',
  "status" "MetaAdPlanStatus" NOT NULL DEFAULT 'DRAFT',
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
  CONSTRAINT "meta_ad_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_ad_accounts_createdById_externalAccountId_key" ON "meta_ad_accounts"("createdById", "externalAccountId");
CREATE INDEX IF NOT EXISTS "meta_ad_accounts_createdById_isSelected_idx" ON "meta_ad_accounts"("createdById", "isSelected");
CREATE INDEX IF NOT EXISTS "meta_ad_plans_createdById_status_idx" ON "meta_ad_plans"("createdById", "status");
CREATE INDEX IF NOT EXISTS "meta_ad_plans_createdById_updatedAt_idx" ON "meta_ad_plans"("createdById", "updatedAt" DESC);

DO $$ BEGIN
  ALTER TABLE "meta_ad_accounts" ADD CONSTRAINT "meta_ad_accounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "meta_ad_plans" ADD CONSTRAINT "meta_ad_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "meta_ad_plans" ADD CONSTRAINT "meta_ad_plans_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
