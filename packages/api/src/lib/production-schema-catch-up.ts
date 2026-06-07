import type { PrismaClient } from "@digitify/db";
import { runIdempotentSql, runManualSqlFile } from "./run-idempotent-sql";

const EXTRA_CATCH_UP_SQL = `
CREATE INDEX IF NOT EXISTS "leads_email_idx" ON "leads"("email");
CREATE INDEX IF NOT EXISTS "leads_gmbPlaceId_idx" ON "leads"("gmbPlaceId");
CREATE INDEX IF NOT EXISTS "leads_createdById_gmbPlaceId_idx" ON "leads"("createdById", "gmbPlaceId");
CREATE INDEX IF NOT EXISTS "notes_leadId_idx" ON "notes"("leadId");
CREATE INDEX IF NOT EXISTS "lead_contacts_leadId_idx" ON "lead_contacts"("leadId");
`;

const MANUAL_SQL_FILES = [
  "production-catch-up.sql",
  "social-posts-and-meta-ads.sql",
  "google-ads-only.sql",
] as const;

export async function runProductionSchemaCatchUp(db: PrismaClient) {
  const results = [];

  for (const fileName of MANUAL_SQL_FILES) {
    results.push(await runManualSqlFile(db, fileName));
  }

  results.push(await runIdempotentSql(db, EXTRA_CATCH_UP_SQL, "lead-query-indexes"));

  return results;
}
