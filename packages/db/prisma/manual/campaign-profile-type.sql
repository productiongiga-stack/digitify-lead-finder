-- Run in Supabase SQL editor if migrate deploy is not available yet
CREATE TYPE "CampaignProfileType" AS ENUM ('LEAD_OUTREACH', 'REVIEW_REQUEST');

ALTER TABLE "campaigns"
  ADD COLUMN IF NOT EXISTS "profile_type" "CampaignProfileType" NOT NULL DEFAULT 'LEAD_OUTREACH';
