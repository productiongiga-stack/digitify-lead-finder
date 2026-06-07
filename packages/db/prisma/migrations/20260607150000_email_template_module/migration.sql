-- CreateEnum
CREATE TYPE "EmailModule" AS ENUM ('LEADS', 'CAMPAIGNS', 'QUOTES', 'INVOICES', 'BOOKINGS', 'REVIEWS', 'AUTH', 'INBOX', 'SYSTEM');

-- AlterTable
ALTER TABLE "email_templates" ADD COLUMN "module" "EmailModule" NOT NULL DEFAULT 'LEADS';
ALTER TABLE "email_templates" ADD COLUMN "templateKey" TEXT;
ALTER TABLE "email_templates" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "email_templates_createdById_module_idx" ON "email_templates"("createdById", "module");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_createdById_templateKey_key" ON "email_templates"("createdById", "templateKey");
