-- Drop global domain uniqueness; domains are unique per workspace.
DROP INDEX IF EXISTS "domains_domainName_key";

CREATE UNIQUE INDEX "domains_createdById_domainName_key" ON "domains"("createdById", "domainName");
