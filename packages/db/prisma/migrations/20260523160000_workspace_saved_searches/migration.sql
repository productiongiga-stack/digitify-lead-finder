-- CreateTable
CREATE TABLE "workspace_saved_searches" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT 'België',
    "niche" TEXT NOT NULL DEFAULT '',
    "pageSize" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_saved_searches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_saved_searches_createdById_updatedAt_idx" ON "workspace_saved_searches"("createdById", "updatedAt");

-- AddForeignKey
ALTER TABLE "workspace_saved_searches" ADD CONSTRAINT "workspace_saved_searches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "workspace_saved_searches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_saved_searches" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "workspace_saved_searches";
CREATE POLICY workspace_isolation ON "workspace_saved_searches"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());
