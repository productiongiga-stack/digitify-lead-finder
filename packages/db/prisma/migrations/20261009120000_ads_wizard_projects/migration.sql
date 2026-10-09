CREATE TABLE "ads_wizard_projects" (
  "id" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "providerSelection" TEXT NOT NULL DEFAULT 'META',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "activeStep" TEXT NOT NULL DEFAULT 'briefing',
  "name" TEXT,
  "brief" JSONB NOT NULL,
  "metaPlan" JSONB,
  "googlePlan" JSONB,
  "selectedAssetIds" JSONB,
  "readiness" JSONB,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "idempotencyKey" TEXT NOT NULL,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ads_wizard_projects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ads_wizard_projects_createdById_idempotencyKey_key"
  ON "ads_wizard_projects"("createdById", "idempotencyKey");
CREATE INDEX "ads_wizard_projects_createdById_status_updatedAt_idx"
  ON "ads_wizard_projects"("createdById", "status", "updatedAt" DESC);

ALTER TABLE "ads_wizard_projects"
  ADD CONSTRAINT "ads_wizard_projects_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "ads_wizard_projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ads_wizard_projects" FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_isolation ON "ads_wizard_projects"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());
