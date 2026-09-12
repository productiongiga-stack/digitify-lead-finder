CREATE TYPE "KnowledgeEntryStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "knowledge_entries" (
  "id" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" "KnowledgeEntryStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "knowledge_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "knowledge_entries_createdById_slug_key" ON "knowledge_entries"("createdById", "slug");
CREATE INDEX "knowledge_entries_createdById_status_updatedAt_idx" ON "knowledge_entries"("createdById", "status", "updatedAt" DESC);
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "knowledge_entry_versions" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "knowledge_entry_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "knowledge_entry_versions_entryId_version_key" ON "knowledge_entry_versions"("entryId", "version");
CREATE INDEX "knowledge_entry_versions_entryId_createdAt_idx" ON "knowledge_entry_versions"("entryId", "createdAt" DESC);
ALTER TABLE "knowledge_entry_versions" ADD CONSTRAINT "knowledge_entry_versions_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "knowledge_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
