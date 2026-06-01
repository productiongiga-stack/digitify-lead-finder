-- Track the actual team member who saved or last edited a lead.
-- createdById remains the workspace/tenant owner id for existing workspace scoping.
ALTER TABLE "leads" ADD COLUMN "savedById" TEXT;
ALTER TABLE "leads" ADD COLUMN "lastEditedById" TEXT;

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_savedById_fkey"
  FOREIGN KEY ("savedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_lastEditedById_fkey"
  FOREIGN KEY ("lastEditedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "leads_savedById_idx" ON "leads"("savedById");
CREATE INDEX "leads_lastEditedById_idx" ON "leads"("lastEditedById");

UPDATE "leads" lead
SET "savedById" = created.user_id
FROM (
  SELECT DISTINCT ON ("leadId") "leadId", "userId" AS user_id
  FROM "activities"
  WHERE "leadId" IS NOT NULL
    AND "userId" IS NOT NULL
    AND "type" = 'LEAD_CREATED'
  ORDER BY "leadId", "createdAt" ASC
) created
WHERE lead."id" = created."leadId";

UPDATE "leads" lead
SET "lastEditedById" = edited.user_id
FROM (
  SELECT DISTINCT ON ("leadId") "leadId", "userId" AS user_id
  FROM "activities"
  WHERE "leadId" IS NOT NULL
    AND "userId" IS NOT NULL
    AND "type" IN ('LEAD_UPDATED', 'LEAD_STATUS_CHANGED', 'LEAD_ASSIGNED')
  ORDER BY "leadId", "createdAt" DESC
) edited
WHERE lead."id" = edited."leadId";

UPDATE "leads"
SET
  "savedById" = COALESCE("savedById", "createdById"),
  "lastEditedById" = COALESCE("lastEditedById", "savedById", "createdById");
