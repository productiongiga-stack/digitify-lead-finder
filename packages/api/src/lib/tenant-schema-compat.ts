import { type PrismaClient } from "@digitify/db";

let ensurePromise: Promise<void> | null = null;
let ensuredAt = 0;
const ENSURE_TTL_MS = 6 * 60 * 60 * 1000;

const TENANT_SCHEMA_STATEMENTS = [
  `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MODERATOR'`,
  `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TRIAL'`,
  `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TESTER'`,

  `ALTER TABLE "pipeline_stages" ADD COLUMN IF NOT EXISTS "createdById" TEXT`,
  `ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "createdById" TEXT`,
  `ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "createdById" TEXT`,
  `ALTER TABLE "service_catalog" ADD COLUMN IF NOT EXISTS "createdById" TEXT`,

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
];

export async function ensureTenantSchemaCompatibility(db: PrismaClient) {
  const now = Date.now();
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
  })()
    .catch((error) => {
      console.warn("[tenant-schema-compat] failed to auto-ensure schema", error);
      throw error;
    })
    .finally(() => {
      ensurePromise = null;
    });

  await ensurePromise;
}
