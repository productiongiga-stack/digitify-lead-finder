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
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'Europe/Brussels'`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "location" TEXT`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "googleEventId" TEXT`,
  `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "googleHtmlLink" TEXT`,
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

  // Performance indexes for tenant-scoped reads
  `CREATE INDEX IF NOT EXISTS "leads_createdById_idx" ON "leads"("createdById")`,
  `CREATE INDEX IF NOT EXISTS "leads_createdById_createdAt_idx" ON "leads"("createdById", "createdAt" DESC)`,
  `CREATE INDEX IF NOT EXISTS "leads_createdById_updatedAt_idx" ON "leads"("createdById", "updatedAt" DESC)`,
  `CREATE INDEX IF NOT EXISTS "leads_createdById_status_idx" ON "leads"("createdById", "status")`,
  `CREATE INDEX IF NOT EXISTS "campaigns_createdById_idx" ON "campaigns"("createdById")`,
  `CREATE INDEX IF NOT EXISTS "bookings_createdById_idx" ON "bookings"("createdById")`,
  `CREATE INDEX IF NOT EXISTS "bookings_createdById_date_idx" ON "bookings"("createdById", "date" ASC)`,
  `CREATE INDEX IF NOT EXISTS "bookings_hostUserId_idx" ON "bookings"("hostUserId")`,
  `CREATE INDEX IF NOT EXISTS "bookings_eventTypeId_idx" ON "bookings"("eventTypeId")`,
  `CREATE INDEX IF NOT EXISTS "bookings_createdById_status_idx" ON "bookings"("createdById", "status")`,
  `CREATE INDEX IF NOT EXISTS "bookings_googleEventId_idx" ON "bookings"("googleEventId")`,
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
];

export async function ensureTenantSchemaCompatibility(db: PrismaClient) {
  const now = Date.now();
  if (!ensurePromise && failedAt > 0 && now - failedAt < FAILURE_RETRY_TTL_MS) return;
  if (!ensurePromise && ensuredAt > 0 && now - ensuredAt < ENSURE_TTL_MS) return;
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
