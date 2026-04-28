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
