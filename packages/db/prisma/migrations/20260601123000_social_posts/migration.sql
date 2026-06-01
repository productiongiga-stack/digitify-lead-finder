-- Social auto-post module: statuses/platforms + queue table
CREATE TYPE "SocialPostStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED');
CREATE TYPE "SocialPlatform" AS ENUM ('FACEBOOK', 'INSTAGRAM');

CREATE TABLE "social_posts" (
  "id" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "caption" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3),
  "status" "SocialPostStatus" NOT NULL DEFAULT 'DRAFT',
  "targetPlatforms" "SocialPlatform"[] DEFAULT ARRAY['FACEBOOK']::"SocialPlatform"[],
  "externalPostIds" JSONB,
  "approvedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "social_posts_createdById_status_idx" ON "social_posts"("createdById", "status");
CREATE INDEX "social_posts_status_scheduledFor_idx" ON "social_posts"("status", "scheduledFor");
CREATE INDEX "social_posts_createdById_updatedAt_idx" ON "social_posts"("createdById", "updatedAt" DESC);

ALTER TABLE "social_posts"
ADD CONSTRAINT "social_posts_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "social_posts"
ADD CONSTRAINT "social_posts_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'SOCIAL_POST_CREATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'SOCIAL_POST_SUBMITTED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'SOCIAL_POST_APPROVED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'SOCIAL_POST_REJECTED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'SOCIAL_POST_PUBLISHED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'SOCIAL_POST_FAILED';
