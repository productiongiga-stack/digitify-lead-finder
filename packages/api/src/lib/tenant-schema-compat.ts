import { type PrismaClient } from "@digitify/db";

let ensurePromise: Promise<void> | null = null;
let ensuredAt = 0;
let failedAt = 0;
const ENSURE_TTL_MS = 6 * 60 * 60 * 1000;
const FAILURE_RETRY_TTL_MS = 30 * 60 * 1000;

const TENANT_SCHEMA_STATEMENTS = [
  `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MODERATOR'`,
  `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TRIAL'`,
  `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TESTER'`,
  `DO $$ BEGIN CREATE TYPE "EmailType" AS ENUM ('LEAD_CONTACT', 'QUOTE', 'REPLY', 'FOLLOW_UP', 'REVIEW_REQUEST', 'TRANSACTIONAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `ALTER TABLE "pipeline_stages" ADD COLUMN IF NOT EXISTS "createdById" TEXT`,
  `ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "createdById" TEXT`,
  `ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "createdById" TEXT`,
  `ALTER TABLE "service_catalog" ADD COLUMN IF NOT EXISTS "createdById" TEXT`,
  `ALTER TABLE "email_drafts" ADD COLUMN IF NOT EXISTS "type" "EmailType" NOT NULL DEFAULT 'LEAD_CONTACT'`,
  `ALTER TABLE "email_drafts" ALTER COLUMN "leadId" DROP NOT NULL`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "workspaceOwnerId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "users_workspaceOwnerId_idx" ON "users"("workspaceOwnerId")`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'Europe/Brussels'`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "location" TEXT`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "googleEventId" TEXT`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "googleHtmlLink" TEXT`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "googleMeetLink" TEXT`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "googleSyncState" TEXT DEFAULT 'DISABLED'`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "googleSyncError" TEXT`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "googleSyncLastAttemptAt" TIMESTAMP(3)`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "googleSyncRetryAt" TIMESTAMP(3)`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "hostUserId" TEXT`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "eventTypeId" TEXT`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "cancelTokenHash" TEXT`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "rescheduleTokenHash" TEXT`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3)`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "rescheduledAt" TIMESTAMP(3)`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "reminder24hSentAt" TIMESTAMP(3)`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "reminder1hSentAt" TIMESTAMP(3)`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "consentText" TEXT`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "consentedAt" TIMESTAMP(3)`,
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "savedById" TEXT`,
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "lastEditedById" TEXT`,

  `CREATE TABLE IF NOT EXISTS "booking_event_types" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 60,
    "slotMinutes" INTEGER NOT NULL DEFAULT 30,
    "color" TEXT NOT NULL DEFAULT '#f9ae5a',
    "location" TEXT DEFAULT 'Google Meet',
    "meetingProvider" TEXT DEFAULT 'manual',
    "approvalMode" TEXT NOT NULL DEFAULT 'manual',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Brussels',
    "bufferBefore" INTEGER NOT NULL DEFAULT 0,
    "bufferAfter" INTEGER NOT NULL DEFAULT 0,
    "minimumNoticeHours" INTEGER NOT NULL DEFAULT 4,
    "maximumHorizonDays" INTEGER NOT NULL DEFAULT 60,
    "privacyText" TEXT,
    "requireConsent" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hostUserIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "booking_event_types_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "booking_availability_rules" (
    "id" TEXT NOT NULL,
    "eventTypeId" TEXT NOT NULL,
    "hostUserId" TEXT,
    "weekday" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "startTime" TEXT NOT NULL DEFAULT '09:00',
    "endTime" TEXT NOT NULL DEFAULT '17:00',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "booking_availability_rules_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "booking_questions" (
    "id" TEXT NOT NULL,
    "eventTypeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "booking_questions_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "booking_question_answers" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "questionId" TEXT,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "booking_question_answers_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "booking_analytics_events" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "eventTypeId" TEXT,
    "bookingId" TEXT,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "booking_analytics_events_pkey" PRIMARY KEY ("id")
  )`,
  `ALTER TABLE "booking_event_types" ADD COLUMN IF NOT EXISTS "description" TEXT`,
  `ALTER TABLE "booking_event_types" ADD COLUMN IF NOT EXISTS "duration" INTEGER NOT NULL DEFAULT 60`,
  `ALTER TABLE "booking_event_types" ADD COLUMN IF NOT EXISTS "slotMinutes" INTEGER NOT NULL DEFAULT 30`,
  `ALTER TABLE "booking_event_types" ADD COLUMN IF NOT EXISTS "color" TEXT NOT NULL DEFAULT '#f9ae5a'`,
  `ALTER TABLE "booking_event_types" ADD COLUMN IF NOT EXISTS "location" TEXT DEFAULT 'Google Meet'`,
  `ALTER TABLE "booking_event_types" ADD COLUMN IF NOT EXISTS "meetingProvider" TEXT DEFAULT 'manual'`,
  `ALTER TABLE "booking_event_types" ADD COLUMN IF NOT EXISTS "approvalMode" TEXT NOT NULL DEFAULT 'manual'`,
  `ALTER TABLE "booking_event_types" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Europe/Brussels'`,
  `ALTER TABLE "booking_event_types" ADD COLUMN IF NOT EXISTS "bufferBefore" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "booking_event_types" ADD COLUMN IF NOT EXISTS "bufferAfter" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "booking_event_types" ADD COLUMN IF NOT EXISTS "minimumNoticeHours" INTEGER NOT NULL DEFAULT 4`,
  `ALTER TABLE "booking_event_types" ADD COLUMN IF NOT EXISTS "maximumHorizonDays" INTEGER NOT NULL DEFAULT 60`,
  `ALTER TABLE "booking_event_types" ADD COLUMN IF NOT EXISTS "privacyText" TEXT`,
  `ALTER TABLE "booking_event_types" ADD COLUMN IF NOT EXISTS "requireConsent" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "booking_event_types" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "booking_event_types" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "booking_event_types" ADD COLUMN IF NOT EXISTS "hostUserIds" JSONB`,
  `ALTER TABLE "booking_event_types" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "booking_event_types" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "booking_availability_rules" ADD COLUMN IF NOT EXISTS "hostUserId" TEXT`,
  `ALTER TABLE "booking_availability_rules" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "booking_availability_rules" ADD COLUMN IF NOT EXISTS "startTime" TEXT NOT NULL DEFAULT '09:00'`,
  `ALTER TABLE "booking_availability_rules" ADD COLUMN IF NOT EXISTS "endTime" TEXT NOT NULL DEFAULT '17:00'`,
  `ALTER TABLE "booking_availability_rules" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "booking_availability_rules" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "booking_questions" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'text'`,
  `ALTER TABLE "booking_questions" ADD COLUMN IF NOT EXISTS "required" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "booking_questions" ADD COLUMN IF NOT EXISTS "options" JSONB`,
  `ALTER TABLE "booking_questions" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "booking_questions" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "booking_questions" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "booking_question_answers" ADD COLUMN IF NOT EXISTS "questionId" TEXT`,
  `ALTER TABLE "booking_question_answers" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "booking_analytics_events" ADD COLUMN IF NOT EXISTS "eventTypeId" TEXT`,
  `ALTER TABLE "booking_analytics_events" ADD COLUMN IF NOT EXISTS "bookingId" TEXT`,
  `ALTER TABLE "booking_analytics_events" ADD COLUMN IF NOT EXISTS "metadata" JSONB`,
  `ALTER TABLE "booking_analytics_events" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "booking_event_types" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "booking_availability_rules" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "booking_questions" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP`,

  `DROP INDEX IF EXISTS "pipeline_stages_name_key"`,
  `DROP INDEX IF EXISTS "tags_name_key"`,
  `DROP INDEX IF EXISTS "email_templates_name_key"`,
  `DROP INDEX IF EXISTS "service_catalog_name_key"`,
  `DROP INDEX IF EXISTS "service_catalog_category_name_key"`,

  `CREATE INDEX IF NOT EXISTS "pipeline_stages_createdById_idx" ON "pipeline_stages"("createdById")`,
  `CREATE INDEX IF NOT EXISTS "tags_createdById_idx" ON "tags"("createdById")`,
  `CREATE INDEX IF NOT EXISTS "email_templates_createdById_idx" ON "email_templates"("createdById")`,
  `CREATE INDEX IF NOT EXISTS "service_catalog_createdById_idx" ON "service_catalog"("createdById")`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "pipeline_stages_createdById_name_key" ON "pipeline_stages"("createdById", "name")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "tags_createdById_name_key" ON "tags"("createdById", "name")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "email_templates_createdById_name_key" ON "email_templates"("createdById", "name")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "service_catalog_createdById_category_name_key" ON "service_catalog"("createdById", "category", "name")`,

  // Scoring settings were made workspace-scoped after the initial schema.
  `ALTER TABLE "scoring_weights" ADD COLUMN IF NOT EXISTS "createdById" TEXT NOT NULL DEFAULT '_global'`,
  `UPDATE "scoring_weights" SET "createdById" = '_global' WHERE "createdById" IS NULL OR "createdById" = ''`,
  `DROP INDEX IF EXISTS "scoring_weights_factorKey_key"`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "scoring_weights_createdById_factorKey_key" ON "scoring_weights"("createdById", "factorKey")`,
  `CREATE INDEX IF NOT EXISTS "scoring_weights_createdById_idx" ON "scoring_weights"("createdById")`,

  // Performance indexes for tenant-scoped reads
  `CREATE INDEX IF NOT EXISTS "leads_createdById_idx" ON "leads"("createdById")`,
  `CREATE INDEX IF NOT EXISTS "leads_createdById_createdAt_idx" ON "leads"("createdById", "createdAt" DESC)`,
  `CREATE INDEX IF NOT EXISTS "leads_createdById_updatedAt_idx" ON "leads"("createdById", "updatedAt" DESC)`,
  `CREATE INDEX IF NOT EXISTS "leads_createdById_status_idx" ON "leads"("createdById", "status")`,
  `CREATE INDEX IF NOT EXISTS "leads_savedById_idx" ON "leads"("savedById")`,
  `CREATE INDEX IF NOT EXISTS "leads_lastEditedById_idx" ON "leads"("lastEditedById")`,
  `CREATE INDEX IF NOT EXISTS "campaigns_createdById_idx" ON "campaigns"("createdById")`,
  `CREATE INDEX IF NOT EXISTS "bookings_createdById_idx" ON "bookings"("createdById")`,
  `CREATE INDEX IF NOT EXISTS "bookings_createdById_date_idx" ON "bookings"("createdById", "date" ASC)`,
  `CREATE INDEX IF NOT EXISTS "bookings_hostUserId_idx" ON "bookings"("hostUserId")`,
  `CREATE INDEX IF NOT EXISTS "bookings_eventTypeId_idx" ON "bookings"("eventTypeId")`,
  `CREATE INDEX IF NOT EXISTS "bookings_createdById_status_idx" ON "bookings"("createdById", "status")`,
  `CREATE INDEX IF NOT EXISTS "bookings_googleEventId_idx" ON "bookings"("googleEventId")`,
  `CREATE INDEX IF NOT EXISTS "bookings_googleSyncState_googleSyncRetryAt_idx" ON "bookings"("googleSyncState", "googleSyncRetryAt")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "booking_event_types_createdById_slug_key" ON "booking_event_types"("createdById", "slug")`,
  `CREATE INDEX IF NOT EXISTS "booking_event_types_createdById_isActive_idx" ON "booking_event_types"("createdById", "isActive")`,
  `CREATE INDEX IF NOT EXISTS "booking_availability_rules_eventTypeId_weekday_idx" ON "booking_availability_rules"("eventTypeId", "weekday")`,
  `CREATE INDEX IF NOT EXISTS "booking_availability_rules_hostUserId_idx" ON "booking_availability_rules"("hostUserId")`,
  `CREATE INDEX IF NOT EXISTS "booking_questions_eventTypeId_sortOrder_idx" ON "booking_questions"("eventTypeId", "sortOrder")`,
  `CREATE INDEX IF NOT EXISTS "booking_question_answers_bookingId_idx" ON "booking_question_answers"("bookingId")`,
  `CREATE INDEX IF NOT EXISTS "booking_question_answers_questionId_idx" ON "booking_question_answers"("questionId")`,
  `CREATE INDEX IF NOT EXISTS "booking_analytics_events_createdById_createdAt_idx" ON "booking_analytics_events"("createdById", "createdAt" DESC)`,
  `CREATE INDEX IF NOT EXISTS "booking_analytics_events_eventTypeId_type_idx" ON "booking_analytics_events"("eventTypeId", "type")`,
  `CREATE INDEX IF NOT EXISTS "domains_createdById_idx" ON "domains"("createdById")`,
  `CREATE INDEX IF NOT EXISTS "domains_createdById_expiresAt_idx" ON "domains"("createdById", "expiresAt" ASC)`,
  `CREATE INDEX IF NOT EXISTS "review_requests_createdById_idx" ON "review_requests"("createdById")`,
  `CREATE INDEX IF NOT EXISTS "review_requests_createdById_status_idx" ON "review_requests"("createdById", "status")`,
  `CREATE INDEX IF NOT EXISTS "quotes_createdById_idx" ON "quotes"("createdById")`,
  `CREATE INDEX IF NOT EXISTS "quotes_createdById_status_idx" ON "quotes"("createdById", "status")`,
  `CREATE INDEX IF NOT EXISTS "quotes_createdById_createdAt_idx" ON "quotes"("createdById", "createdAt" DESC)`,
  `CREATE INDEX IF NOT EXISTS "reports_generatedById_idx" ON "reports"("generatedById")`,
  `CREATE INDEX IF NOT EXISTS "activities_userId_createdAt_idx" ON "activities"("userId", "createdAt" DESC)`,
  `CREATE INDEX IF NOT EXISTS "email_drafts_authorId_idx" ON "email_drafts"("authorId")`,
  `CREATE INDEX IF NOT EXISTS "email_drafts_approverId_idx" ON "email_drafts"("approverId")`,
  `CREATE INDEX IF NOT EXISTS "email_drafts_type_idx" ON "email_drafts"("type")`,
  `CREATE INDEX IF NOT EXISTS "chat_sessions_assignedToId_updatedAt_idx" ON "chat_sessions"("assignedToId", "updatedAt" DESC)`,

  `ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'META_AD_DRAFT_CREATED'`,
  `ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'META_AD_SUBMITTED'`,
  `ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'META_AD_APPROVED'`,
  `ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'META_AD_REJECTED'`,
  `ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'META_AD_PUSHED_PAUSED'`,
  `ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'META_AD_FAILED'`,
  `DO $$ BEGIN CREATE TYPE "MetaAdPlanStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUSHING', 'PUSHED_PAUSED', 'FAILED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `ALTER TABLE IF EXISTS "social_posts" ADD COLUMN IF NOT EXISTS "metadata" JSONB`,
  `CREATE TABLE IF NOT EXISTS "meta_ad_accounts" (
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
  )`,
  `CREATE TABLE IF NOT EXISTS "meta_ad_plans" (
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
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "meta_ad_accounts_createdById_externalAccountId_key" ON "meta_ad_accounts"("createdById", "externalAccountId")`,
  `CREATE INDEX IF NOT EXISTS "meta_ad_accounts_createdById_isSelected_idx" ON "meta_ad_accounts"("createdById", "isSelected")`,
  `CREATE INDEX IF NOT EXISTS "meta_ad_plans_createdById_status_idx" ON "meta_ad_plans"("createdById", "status")`,
  `CREATE INDEX IF NOT EXISTS "meta_ad_plans_createdById_updatedAt_idx" ON "meta_ad_plans"("createdById", "updatedAt" DESC)`,
  `DO $$ BEGIN
    ALTER TABLE "meta_ad_accounts" ADD CONSTRAINT "meta_ad_accounts_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "meta_ad_plans" ADD CONSTRAINT "meta_ad_plans_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "meta_ad_plans" ADD CONSTRAINT "meta_ad_plans_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'GOOGLE_AD_DRAFT_CREATED'`,
  `ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'GOOGLE_AD_SUBMITTED'`,
  `ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'GOOGLE_AD_APPROVED'`,
  `ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'GOOGLE_AD_REJECTED'`,
  `ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'GOOGLE_AD_PUSHED_PAUSED'`,
  `ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'GOOGLE_AD_FAILED'`,
  `DO $$ BEGIN CREATE TYPE "GoogleAdPlanStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUSHING', 'PUSHED_PAUSED', 'FAILED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "GoogleAdCampaignType" AS ENUM ('SEARCH', 'PERFORMANCE_MAX'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE TABLE IF NOT EXISTS "google_ad_accounts" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "externalCustomerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT DEFAULT 'EUR',
    "timezoneName" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "google_ad_accounts_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "google_ad_plans" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "name" TEXT NOT NULL,
    "campaignType" "GoogleAdCampaignType" NOT NULL DEFAULT 'SEARCH',
    "status" "GoogleAdPlanStatus" NOT NULL DEFAULT 'DRAFT',
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
    CONSTRAINT "google_ad_plans_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "google_ad_accounts_createdById_externalCustomerId_key" ON "google_ad_accounts"("createdById", "externalCustomerId")`,
  `CREATE INDEX IF NOT EXISTS "google_ad_accounts_createdById_isSelected_idx" ON "google_ad_accounts"("createdById", "isSelected")`,
  `CREATE INDEX IF NOT EXISTS "google_ad_plans_createdById_status_idx" ON "google_ad_plans"("createdById", "status")`,
  `CREATE INDEX IF NOT EXISTS "google_ad_plans_createdById_updatedAt_idx" ON "google_ad_plans"("createdById", "updatedAt" DESC)`,
  `DO $$ BEGIN
    ALTER TABLE "google_ad_accounts" ADD CONSTRAINT "google_ad_accounts_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "google_ad_plans" ADD CONSTRAINT "google_ad_plans_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "google_ad_plans" ADD CONSTRAINT "google_ad_plans_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN CREATE TYPE "WorkspaceInvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE TABLE IF NOT EXISTS "workspace_invoices" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspace_invoices_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "workspace_invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "workspace_invoice_items_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "workspace_invoices_createdById_status_idx" ON "workspace_invoices"("createdById", "status")`,
  `CREATE INDEX IF NOT EXISTS "workspace_invoices_createdById_issueDate_idx" ON "workspace_invoices"("createdById", "issueDate")`,
  `CREATE INDEX IF NOT EXISTS "workspace_invoices_quoteId_idx" ON "workspace_invoices"("quoteId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "workspace_invoices_createdById_invoiceNumber_key" ON "workspace_invoices"("createdById", "invoiceNumber")`,
  `CREATE INDEX IF NOT EXISTS "workspace_invoice_items_invoiceId_idx" ON "workspace_invoice_items"("invoiceId")`,
  `DO $$ BEGIN
    ALTER TABLE "workspace_invoices" ADD CONSTRAINT "workspace_invoices_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "workspace_invoices" ADD CONSTRAINT "workspace_invoices_quoteId_fkey"
      FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "workspace_invoice_items" ADD CONSTRAINT "workspace_invoice_items_invoiceId_fkey"
      FOREIGN KEY ("invoiceId") REFERENCES "workspace_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `CREATE TABLE IF NOT EXISTS "workspace_saved_searches" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT 'België',
    "niche" TEXT NOT NULL DEFAULT '',
    "pageSize" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspace_saved_searches_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "workspace_saved_searches_createdById_updatedAt_idx" ON "workspace_saved_searches"("createdById", "updatedAt")`,
  `DO $$ BEGIN
    ALTER TABLE "workspace_saved_searches" ADD CONSTRAINT "workspace_saved_searches_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "EmailTemplateBodyFormat" AS ENUM ('TEXT', 'HTML'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "bodyFormat" "EmailTemplateBodyFormat" NOT NULL DEFAULT 'TEXT'`,
];

/** Skip on production tRPC hot path unless TENANT_SCHEMA_ENSURE=true (migrations are the source of truth). */
export function isTenantSchemaEnsureEnabled() {
  const flag = process.env.TENANT_SCHEMA_ENSURE?.trim().toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  if (flag === "0" || flag === "false" || flag === "no") return false;
  return process.env.NODE_ENV !== "production";
}

export async function ensureTenantSchemaCompatibility(db: PrismaClient, options?: { force?: boolean }) {
  if (!options?.force && !isTenantSchemaEnsureEnabled()) return;
  const now = Date.now();
  const force = Boolean(options?.force);
  if (!force && !ensurePromise && failedAt > 0 && now - failedAt < FAILURE_RETRY_TTL_MS) return;
  if (!force && !ensurePromise && ensuredAt > 0 && now - ensuredAt < ENSURE_TTL_MS) return;
  if (ensurePromise) {
    await ensurePromise;
    return;
  }

  ensurePromise = (async () => {
    for (const statement of TENANT_SCHEMA_STATEMENTS) {
      await db.$executeRawUnsafe(statement);
    }
    ensuredAt = Date.now();
    failedAt = 0;
  })()
    .catch((error) => {
      console.warn("[tenant-schema-compat] failed to auto-ensure schema", error);
      failedAt = Date.now();
    })
    .finally(() => {
      ensurePromise = null;
    });

  await ensurePromise;
}
