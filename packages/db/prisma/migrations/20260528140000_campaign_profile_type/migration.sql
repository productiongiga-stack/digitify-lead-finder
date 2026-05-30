-- Campaign automation profile type (lead outreach, review requests, …)
CREATE TYPE "CampaignProfileType" AS ENUM ('LEAD_OUTREACH', 'REVIEW_REQUEST');

ALTER TABLE "campaigns" ADD COLUMN "profile_type" "CampaignProfileType" NOT NULL DEFAULT 'LEAD_OUTREACH';
