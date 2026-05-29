-- Run once in Supabase SQL Editor (production) if email_templates.bodyFormat is missing.
-- Project: dlkyplyzgoscarytutin → SQL → New query → Run

DO $$ BEGIN
  CREATE TYPE "EmailTemplateBodyFormat" AS ENUM ('TEXT', 'HTML');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "email_templates"
  ADD COLUMN IF NOT EXISTS "bodyFormat" "EmailTemplateBodyFormat" NOT NULL DEFAULT 'TEXT';
