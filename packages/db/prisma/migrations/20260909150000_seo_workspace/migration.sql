CREATE TYPE "SeoKeywordStatus" AS ENUM ('TRACKING', 'PAUSED');

CREATE TABLE "seo_keywords" (
  "id" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "domainId" TEXT,
  "keyword" TEXT NOT NULL,
  "keywordKey" TEXT NOT NULL,
  "location" TEXT,
  "language" TEXT,
  "targetUrl" TEXT,
  "currentRank" INTEGER,
  "previousRank" INTEGER,
  "status" "SeoKeywordStatus" NOT NULL DEFAULT 'TRACKING',
  "lastCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "seo_keywords_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "seo_keywords_createdById_keywordKey_key" ON "seo_keywords"("createdById", "keywordKey");
CREATE INDEX "seo_keywords_createdById_status_updatedAt_idx" ON "seo_keywords"("createdById", "status", "updatedAt" DESC);
CREATE INDEX "seo_keywords_createdById_domainId_idx" ON "seo_keywords"("createdById", "domainId");
ALTER TABLE "seo_keywords" ADD CONSTRAINT "seo_keywords_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "seo_competitors" (
  "id" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "domainId" TEXT,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "seo_competitors_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "seo_competitors_createdById_updatedAt_idx" ON "seo_competitors"("createdById", "updatedAt" DESC);
CREATE INDEX "seo_competitors_createdById_domainId_idx" ON "seo_competitors"("createdById", "domainId");
ALTER TABLE "seo_competitors" ADD CONSTRAINT "seo_competitors_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
