-- Workspace: team members share data with the OWNER account
ALTER TABLE "users" ADD COLUMN "workspaceOwnerId" TEXT;

ALTER TABLE "users" ADD CONSTRAINT "users_workspaceOwnerId_fkey"
  FOREIGN KEY ("workspaceOwnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "users_workspaceOwnerId_idx" ON "users"("workspaceOwnerId");

-- Link existing non-owner users to the oldest OWNER (legacy installs)
UPDATE "users" u
SET "workspaceOwnerId" = (
  SELECT o.id FROM "users" o
  WHERE o.role = 'OWNER'
  ORDER BY o."createdAt" ASC
  LIMIT 1
)
WHERE u.role <> 'OWNER'
  AND u."workspaceOwnerId" IS NULL
  AND EXISTS (SELECT 1 FROM "users" o WHERE o.role = 'OWNER');
