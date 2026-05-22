-- CreateEnum
CREATE TYPE "EmailTemplateType" AS ENUM ('OUTREACH', 'FOLLOW_UP', 'PROPOSAL', 'REPORT', 'BOOKING', 'REVIEW', 'REENGAGEMENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EmailTemplateLayout" AS ENUM ('modern', 'minimal', 'business', 'proposal', 'followup');

-- AlterTable
ALTER TABLE "email_templates" ADD COLUMN "type" "EmailTemplateType" NOT NULL DEFAULT 'CUSTOM';
ALTER TABLE "email_templates" ADD COLUMN "layout" "EmailTemplateLayout" NOT NULL DEFAULT 'modern';
ALTER TABLE "email_templates" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "email_templates" ADD COLUMN "ctaText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "email_templates" ADD COLUMN "ctaUrl" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "email_templates_createdById_type_idx" ON "email_templates"("createdById", "type");
CREATE INDEX "email_templates_createdById_layout_idx" ON "email_templates"("createdById", "layout");
