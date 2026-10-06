CREATE TYPE "SeoKeywordSource" AS ENUM ('MANUAL', 'GOOGLE_ADS', 'SEARCH_CONSOLE', 'AI');
CREATE TYPE "SeoKeywordIntent" AS ENUM ('INFORMATIONAL', 'COMMERCIAL', 'TRANSACTIONAL', 'NAVIGATIONAL', 'LOCAL', 'UNKNOWN');
CREATE TYPE "SeoResearchStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'BLOCKED');
CREATE TYPE "SeoBriefStatus" AS ENUM ('IDEA', 'IN_PROGRESS', 'PUBLISHED', 'STALE');

ALTER TABLE "seo_keywords"
  ADD COLUMN "source" "SeoKeywordSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "intent" "SeoKeywordIntent",
  ADD COLUMN "clusterId" TEXT;

CREATE TABLE "seo_research_runs" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "domainId" TEXT,
  "status" "SeoResearchStatus" NOT NULL DEFAULT 'PENDING',
  "provider" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "seeds" JSONB NOT NULL,
  "options" JSONB,
  "results" JSONB,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "leaseUntil" TIMESTAMP(3),
  "idempotencyKey" TEXT NOT NULL,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "seo_research_runs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "seo_research_runs_idempotencyKey_key" ON "seo_research_runs"("idempotencyKey");
CREATE INDEX "seo_research_runs_workspaceId_status_createdAt_idx" ON "seo_research_runs"("workspaceId", "status", "createdAt" DESC);
CREATE INDEX "seo_research_runs_workspaceId_domainId_createdAt_idx" ON "seo_research_runs"("workspaceId", "domainId", "createdAt" DESC);

CREATE TABLE "seo_keyword_ideas" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "researchRunId" TEXT,
  "keyword" TEXT NOT NULL,
  "keywordKey" TEXT NOT NULL,
  "source" "SeoKeywordSource" NOT NULL,
  "language" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "intent" "SeoKeywordIntent" NOT NULL DEFAULT 'UNKNOWN',
  "searchVolume" INTEGER,
  "competition" DOUBLE PRECISION,
  "cpcCents" INTEGER,
  "impressions" INTEGER,
  "clicks" INTEGER,
  "ctr" DOUBLE PRECISION,
  "averagePosition" DOUBLE PRECISION,
  "targetUrl" TEXT,
  "evidence" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "seo_keyword_ideas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "seo_keyword_ideas_workspaceId_keywordKey_language_location_source_key" ON "seo_keyword_ideas"("workspaceId", "keywordKey", "language", "location", "source");
CREATE INDEX "seo_keyword_ideas_workspaceId_source_updatedAt_idx" ON "seo_keyword_ideas"("workspaceId", "source", "updatedAt" DESC);
CREATE INDEX "seo_keyword_ideas_workspaceId_intent_language_location_idx" ON "seo_keyword_ideas"("workspaceId", "intent", "language", "location");

CREATE TABLE "seo_keyword_clusters" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "intent" "SeoKeywordIntent" NOT NULL DEFAULT 'UNKNOWN',
  "targetUrl" TEXT,
  "keywords" JSONB NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "seo_keyword_clusters_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "seo_keyword_clusters_workspaceId_updatedAt_idx" ON "seo_keyword_clusters"("workspaceId", "updatedAt" DESC);

CREATE TABLE "seo_content_briefs" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "clusterId" TEXT,
  "domainId" TEXT,
  "status" "SeoBriefStatus" NOT NULL DEFAULT 'IDEA',
  "title" TEXT NOT NULL,
  "targetUrl" TEXT,
  "brief" JSONB NOT NULL,
  "profileHash" TEXT,
  "profileVersion" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "seo_content_briefs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "seo_content_briefs_workspaceId_status_updatedAt_idx" ON "seo_content_briefs"("workspaceId", "status", "updatedAt" DESC);

ALTER TABLE "seo_keywords" ADD CONSTRAINT "seo_keywords_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "seo_keyword_clusters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "seo_research_runs" ADD CONSTRAINT "seo_research_runs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seo_research_runs" ADD CONSTRAINT "seo_research_runs_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "seo_keyword_ideas" ADD CONSTRAINT "seo_keyword_ideas_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seo_keyword_ideas" ADD CONSTRAINT "seo_keyword_ideas_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "seo_research_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "seo_keyword_clusters" ADD CONSTRAINT "seo_keyword_clusters_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seo_content_briefs" ADD CONSTRAINT "seo_content_briefs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seo_content_briefs" ADD CONSTRAINT "seo_content_briefs_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "seo_keyword_clusters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "seo_content_briefs" ADD CONSTRAINT "seo_content_briefs_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "seo_research_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "seo_research_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_isolation ON "seo_research_runs" USING (app_rls_bypass() OR "workspaceId" = app_workspace_id()) WITH CHECK (app_rls_bypass() OR "workspaceId" = app_workspace_id());
ALTER TABLE "seo_keyword_ideas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "seo_keyword_ideas" FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_isolation ON "seo_keyword_ideas" USING (app_rls_bypass() OR "workspaceId" = app_workspace_id()) WITH CHECK (app_rls_bypass() OR "workspaceId" = app_workspace_id());
ALTER TABLE "seo_keyword_clusters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "seo_keyword_clusters" FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_isolation ON "seo_keyword_clusters" USING (app_rls_bypass() OR "workspaceId" = app_workspace_id()) WITH CHECK (app_rls_bypass() OR "workspaceId" = app_workspace_id());
ALTER TABLE "seo_content_briefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "seo_content_briefs" FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_isolation ON "seo_content_briefs" USING (app_rls_bypass() OR "workspaceId" = app_workspace_id()) WITH CHECK (app_rls_bypass() OR "workspaceId" = app_workspace_id());
