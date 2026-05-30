-- Run once in Supabase SQL Editor when production is missing tables/columns.
-- Safe to re-run (idempotent). Then mark migrations applied (see VERCEL.md).

-- Ensure RLS helper functions exist (from workspace_row_level_security migration)
CREATE OR REPLACE FUNCTION app_workspace_id() RETURNS text AS $$
  SELECT nullif(current_setting('app.workspace_id', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_rls_bypass() RETURNS boolean AS $$
  SELECT app_workspace_id() IS NULL;
$$ LANGUAGE sql STABLE;

-- 20260523120000_workspace_tasks
DO $$ BEGIN
  CREATE TYPE "WorkspaceTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WorkspaceTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WorkspaceTaskRelatedType" AS ENUM ('LEAD', 'QUOTE', 'BOOKING', 'CLIENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "workspace_tasks" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "WorkspaceTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "WorkspaceTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueAt" TIMESTAMP(3),
    "relatedType" "WorkspaceTaskRelatedType",
    "relatedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workspace_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workspace_tasks_createdById_status_idx"
  ON "workspace_tasks"("createdById", "status");
CREATE INDEX IF NOT EXISTS "workspace_tasks_createdById_updatedAt_idx"
  ON "workspace_tasks"("createdById", "updatedAt");

DO $$ BEGIN
  ALTER TABLE "workspace_tasks"
    ADD CONSTRAINT "workspace_tasks_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "workspace_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_tasks" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "workspace_tasks";
CREATE POLICY workspace_isolation ON "workspace_tasks"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());

-- 20260523140000_workspace_invoices
DO $$ BEGIN
  CREATE TYPE "WorkspaceInvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "workspace_invoices" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "quoteId" TEXT,
    "leadId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT,
    "clientCompany" TEXT,
    "clientAddress" TEXT,
    "clientVat" TEXT,
    "status" "WorkspaceInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL,
    "vatAmount" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "paymentReference" TEXT NOT NULL,
    "notes" TEXT,
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workspace_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "workspace_invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "workspace_invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workspace_invoices_createdById_status_idx"
  ON "workspace_invoices"("createdById", "status");
CREATE INDEX IF NOT EXISTS "workspace_invoices_createdById_issueDate_idx"
  ON "workspace_invoices"("createdById", "issueDate");
CREATE INDEX IF NOT EXISTS "workspace_invoices_quoteId_idx" ON "workspace_invoices"("quoteId");
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_invoices_createdById_invoiceNumber_key"
  ON "workspace_invoices"("createdById", "invoiceNumber");
CREATE INDEX IF NOT EXISTS "workspace_invoice_items_invoiceId_idx"
  ON "workspace_invoice_items"("invoiceId");

DO $$ BEGIN
  ALTER TABLE "workspace_invoices"
    ADD CONSTRAINT "workspace_invoices_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workspace_invoices"
    ADD CONSTRAINT "workspace_invoices_quoteId_fkey"
    FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workspace_invoice_items"
    ADD CONSTRAINT "workspace_invoice_items_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "workspace_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "workspace_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_invoices" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "workspace_invoices";
CREATE POLICY workspace_isolation ON "workspace_invoices"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());

ALTER TABLE "workspace_invoice_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_invoice_items" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "workspace_invoice_items";
CREATE POLICY workspace_isolation ON "workspace_invoice_items"
  USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "workspace_invoices" i
      WHERE i.id = "workspace_invoice_items"."invoiceId"
        AND i."createdById" = app_workspace_id()
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "workspace_invoices" i
      WHERE i.id = "workspace_invoice_items"."invoiceId"
        AND i."createdById" = app_workspace_id()
    )
  );

-- 20260523160000_workspace_saved_searches
CREATE TABLE IF NOT EXISTS "workspace_saved_searches" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT 'België',
    "niche" TEXT NOT NULL DEFAULT '',
    "pageSize" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workspace_saved_searches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workspace_saved_searches_createdById_updatedAt_idx"
  ON "workspace_saved_searches"("createdById", "updatedAt");

DO $$ BEGIN
  ALTER TABLE "workspace_saved_searches"
    ADD CONSTRAINT "workspace_saved_searches_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "workspace_saved_searches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_saved_searches" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "workspace_saved_searches";
CREATE POLICY workspace_isolation ON "workspace_saved_searches"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());

-- 20260523200000_scoring_workspace_and_rls
ALTER TABLE "scoring_weights" ADD COLUMN IF NOT EXISTS "createdById" TEXT NOT NULL DEFAULT '_global';
UPDATE "scoring_weights" SET "createdById" = '_global' WHERE "createdById" IS NULL OR "createdById" = '';

DROP INDEX IF EXISTS "scoring_weights_factorKey_key";
CREATE UNIQUE INDEX IF NOT EXISTS "scoring_weights_createdById_factorKey_key"
  ON "scoring_weights"("createdById", "factorKey");
CREATE INDEX IF NOT EXISTS "scoring_weights_createdById_idx" ON "scoring_weights"("createdById");

ALTER TABLE "enrichment_data" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enrichment_data" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "enrichment_data";
CREATE POLICY workspace_isolation ON "enrichment_data"
  USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM "leads" l
      WHERE l."id" = "enrichment_data"."leadId"
        AND l."createdById" = app_workspace_id()
    )
  )
  WITH CHECK (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM "leads" l
      WHERE l."id" = "enrichment_data"."leadId"
        AND l."createdById" = app_workspace_id()
    )
  );

ALTER TABLE "chat_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_sessions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "chat_sessions";
CREATE POLICY workspace_isolation ON "chat_sessions"
  USING (
    app_rls_bypass() OR "assignedToId" = app_workspace_id()
    OR EXISTS (
      SELECT 1 FROM "leads" l
      WHERE l."id" = "chat_sessions"."leadId"
        AND l."createdById" = app_workspace_id()
    )
  )
  WITH CHECK (
    app_rls_bypass() OR "assignedToId" = app_workspace_id()
    OR EXISTS (
      SELECT 1 FROM "leads" l
      WHERE l."id" = "chat_sessions"."leadId"
        AND l."createdById" = app_workspace_id()
    )
  );

ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_messages" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "chat_messages";
CREATE POLICY workspace_isolation ON "chat_messages"
  USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM "chat_sessions" s
      WHERE s."id" = "chat_messages"."sessionId"
        AND (
          s."assignedToId" = app_workspace_id()
          OR EXISTS (
            SELECT 1 FROM "leads" l
            WHERE l."id" = s."leadId" AND l."createdById" = app_workspace_id()
          )
        )
    )
  )
  WITH CHECK (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM "chat_sessions" s
      WHERE s."id" = "chat_messages"."sessionId"
        AND (
          s."assignedToId" = app_workspace_id()
          OR EXISTS (
            SELECT 1 FROM "leads" l
            WHERE l."id" = s."leadId" AND l."createdById" = app_workspace_id()
          )
        )
    )
  );

-- email_templates: type, layout, metadata, bodyFormat (legacy DBs may miss several columns)
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

CREATE INDEX IF NOT EXISTS "email_templates_createdById_type_idx"
  ON "email_templates"("createdById", "type");
CREATE INDEX IF NOT EXISTS "email_templates_createdById_layout_idx"
  ON "email_templates"("createdById", "layout");

DO $$ BEGIN
  ALTER TABLE "email_templates"
    ADD CONSTRAINT "email_templates_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 20260528120000_email_draft_optional_lead
ALTER TABLE "email_drafts" ALTER COLUMN "leadId" DROP NOT NULL;

-- 20260528140000_campaign_profile_type
DO $$ BEGIN
  CREATE TYPE "CampaignProfileType" AS ENUM ('LEAD_OUTREACH', 'REVIEW_REQUEST');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "campaigns"
  ADD COLUMN IF NOT EXISTS "profile_type" "CampaignProfileType" NOT NULL DEFAULT 'LEAD_OUTREACH';
