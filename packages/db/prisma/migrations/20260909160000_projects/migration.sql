CREATE TYPE "ProjectStatus" AS ENUM ('PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED');

CREATE TABLE "projects" (
  "id" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "leadId" TEXT,
  "quoteId" TEXT,
  "name" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "description" TEXT,
  "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNED',
  "startAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "projects_createdById_status_updatedAt_idx" ON "projects"("createdById", "status", "updatedAt" DESC);
CREATE INDEX "projects_createdById_leadId_idx" ON "projects"("createdById", "leadId");
CREATE INDEX "projects_createdById_quoteId_idx" ON "projects"("createdById", "quoteId");
ALTER TABLE "projects" ADD CONSTRAINT "projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
