-- CreateEnum
CREATE TYPE "EmailTemplateBodyFormat" AS ENUM ('TEXT', 'HTML');

-- AlterTable
ALTER TABLE "email_templates" ADD COLUMN "bodyFormat" "EmailTemplateBodyFormat" NOT NULL DEFAULT 'TEXT';
