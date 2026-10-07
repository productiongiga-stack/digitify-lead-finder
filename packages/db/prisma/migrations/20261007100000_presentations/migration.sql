CREATE TABLE "presentations" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "sourceFileId" TEXT,
  "settings" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "presentations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "presentation_slides" (
  "id" TEXT NOT NULL,
  "presentationId" TEXT NOT NULL,
  "orderIndex" INTEGER NOT NULL,
  "title" TEXT,
  "body" TEXT,
  "backgroundUrl" TEXT,
  "sourcePage" INTEGER,
  "settings" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "presentation_slides_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "presentation_hotspots" (
  "id" TEXT NOT NULL,
  "slideId" TEXT NOT NULL,
  "targetSlideId" TEXT NOT NULL,
  "label" TEXT,
  "x" DOUBLE PRECISION NOT NULL,
  "y" DOUBLE PRECISION NOT NULL,
  "width" DOUBLE PRECISION NOT NULL,
  "height" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "presentation_hotspots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "presentation_shares" (
  "id" TEXT NOT NULL,
  "presentationId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastOpenedAt" TIMESTAMP(3),
  CONSTRAINT "presentation_shares_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "presentation_slides_presentationId_orderIndex_key" ON "presentation_slides"("presentationId", "orderIndex");
CREATE INDEX "presentations_workspaceId_updatedAt_idx" ON "presentations"("workspaceId", "updatedAt" DESC);
CREATE INDEX "presentations_workspaceId_status_updatedAt_idx" ON "presentations"("workspaceId", "status", "updatedAt" DESC);
CREATE INDEX "presentation_slides_presentationId_orderIndex_idx" ON "presentation_slides"("presentationId", "orderIndex");
CREATE INDEX "presentation_hotspots_slideId_idx" ON "presentation_hotspots"("slideId");
CREATE INDEX "presentation_hotspots_targetSlideId_idx" ON "presentation_hotspots"("targetSlideId");
CREATE UNIQUE INDEX "presentation_shares_tokenHash_key" ON "presentation_shares"("tokenHash");
CREATE INDEX "presentation_shares_presentationId_revokedAt_idx" ON "presentation_shares"("presentationId", "revokedAt");

ALTER TABLE "presentation_slides" ADD CONSTRAINT "presentation_slides_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "presentations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "presentation_hotspots" ADD CONSTRAINT "presentation_hotspots_slideId_fkey" FOREIGN KEY ("slideId") REFERENCES "presentation_slides"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "presentation_hotspots" ADD CONSTRAINT "presentation_hotspots_targetSlideId_fkey" FOREIGN KEY ("targetSlideId") REFERENCES "presentation_slides"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "presentation_shares" ADD CONSTRAINT "presentation_shares_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "presentations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "presentations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "presentations" FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_isolation ON "presentations" USING (app_rls_bypass() OR "workspaceId" = app_workspace_id()) WITH CHECK (app_rls_bypass() OR "workspaceId" = app_workspace_id());
ALTER TABLE "presentation_slides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "presentation_slides" FORCE ROW LEVEL SECURITY;
CREATE POLICY server_only ON "presentation_slides" USING (current_user NOT IN ('anon', 'authenticated', 'authenticator')) WITH CHECK (current_user NOT IN ('anon', 'authenticated', 'authenticator'));
ALTER TABLE "presentation_hotspots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "presentation_hotspots" FORCE ROW LEVEL SECURITY;
CREATE POLICY server_only ON "presentation_hotspots" USING (current_user NOT IN ('anon', 'authenticated', 'authenticator')) WITH CHECK (current_user NOT IN ('anon', 'authenticated', 'authenticator'));
ALTER TABLE "presentation_shares" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "presentation_shares" FORCE ROW LEVEL SECURITY;
CREATE POLICY server_only ON "presentation_shares" USING (current_user NOT IN ('anon', 'authenticated', 'authenticator')) WITH CHECK (current_user NOT IN ('anon', 'authenticated', 'authenticator'));

DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digitify_app') THEN
  GRANT SELECT, INSERT, UPDATE, DELETE ON presentations, presentation_slides, presentation_hotspots, presentation_shares TO digitify_app;
END IF;
END $$;
