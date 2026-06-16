-- Quote numbers unique per workspace; FK hardening for media/analytics workspace columns.

DROP INDEX IF EXISTS "quotes_quoteNumber_key";

CREATE UNIQUE INDEX IF NOT EXISTS "quotes_createdById_quoteNumber_key"
  ON "quotes"("createdById", "quoteNumber");

ALTER TABLE "media_generations"
  DROP CONSTRAINT IF EXISTS "media_generations_workspaceId_fkey";

ALTER TABLE "media_generations"
  ADD CONSTRAINT "media_generations_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_analytics_events"
  DROP CONSTRAINT IF EXISTS "workspace_analytics_events_workspaceId_fkey";

ALTER TABLE "workspace_analytics_events"
  ADD CONSTRAINT "workspace_analytics_events_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
