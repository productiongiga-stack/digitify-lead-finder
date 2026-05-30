-- Use packages/db/prisma/manual/email_templates-columns.sql instead.
-- (Adds type, layout, bodyFormat, and all other template columns.)

DO $$ BEGIN
  CREATE TYPE "EmailTemplateType" AS ENUM (
    'OUTREACH', 'FOLLOW_UP', 'PROPOSAL', 'REPORT', 'BOOKING', 'REVIEW', 'REENGAGEMENT', 'CUSTOM'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailTemplateLayout" AS ENUM ('modern', 'minimal', 'business', 'proposal', 'followup');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailTemplateBodyFormat" AS ENUM ('TEXT', 'HTML');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "type" "EmailTemplateType" NOT NULL DEFAULT 'CUSTOM';
ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "layout" "EmailTemplateLayout" NOT NULL DEFAULT 'modern';
ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "ctaText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "ctaUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;
ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "isGlobal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "email_templates"
  ADD COLUMN IF NOT EXISTS "bodyFormat" "EmailTemplateBodyFormat" NOT NULL DEFAULT 'TEXT';
