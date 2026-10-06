ALTER TABLE "workspace_files"
  ADD COLUMN "storageProvider" TEXT NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN "storageKey" TEXT,
  ADD COLUMN "checksumSha256" TEXT,
  ADD COLUMN "folderId" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "trashedById" TEXT,
  ADD COLUMN "driveFileId" TEXT,
  ADD COLUMN "driveWebUrl" TEXT,
  ADD COLUMN "driveEtag" TEXT,
  ADD COLUMN "driveSyncStatus" TEXT,
  ADD COLUMN "lastError" TEXT;

UPDATE "workspace_files"
SET "storageProvider" = CASE
  WHEN "storage" LIKE 'blob%' THEN 'BLOB'
  ELSE 'LOCAL'
END
WHERE "storageProvider" = 'LOCAL';

CREATE INDEX "workspace_files_uploadedById_deletedAt_createdAt_idx"
  ON "workspace_files"("uploadedById", "deletedAt", "createdAt" DESC);
CREATE INDEX "workspace_files_createdById_folderId_deletedAt_createdAt_idx"
  ON "workspace_files"("createdById", "folderId", "deletedAt", "createdAt" DESC);
CREATE INDEX "workspace_files_driveFileId_idx" ON "workspace_files"("driveFileId");

CREATE TABLE "user_file_quotas" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "quotaBytes" BIGINT NOT NULL DEFAULT 1073741824,
  "usedBytes" BIGINT NOT NULL DEFAULT 0,
  "reservedBytes" BIGINT NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_file_quotas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_file_quotas_userId_workspaceId_key" ON "user_file_quotas"("userId", "workspaceId");
CREATE INDEX "user_file_quotas_workspaceId_userId_idx" ON "user_file_quotas"("workspaceId", "userId");

INSERT INTO "user_file_quotas" ("id", "userId", "workspaceId", "usedBytes", "createdAt", "updatedAt")
SELECT md5("uploadedById" || ':' || "createdById"), "uploadedById", "createdById", SUM("size"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "workspace_files"
WHERE "deletedAt" IS NULL AND "storageProvider" IN ('LOCAL', 'BLOB')
GROUP BY "uploadedById", "createdById"
ON CONFLICT ("userId", "workspaceId") DO UPDATE SET "usedBytes" = EXCLUDED."usedBytes", "updatedAt" = CURRENT_TIMESTAMP;

CREATE TABLE "file_storage_reservations" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "fileId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "bytes" BIGINT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RESERVED',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "committedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "file_storage_reservations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "file_storage_reservations_idempotencyKey_key" ON "file_storage_reservations"("idempotencyKey");
CREATE INDEX "file_storage_reservations_workspaceId_userId_status_idx" ON "file_storage_reservations"("workspaceId", "userId", "status");
CREATE INDEX "file_storage_reservations_expiresAt_status_idx" ON "file_storage_reservations"("expiresAt", "status");

CREATE TABLE "file_folders" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "parentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "file_folders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "file_folders_workspaceId_parentId_name_key" ON "file_folders"("workspaceId", "parentId", "name");
CREATE INDEX "file_folders_workspaceId_parentId_createdAt_idx" ON "file_folders"("workspaceId", "parentId", "createdAt" DESC);

ALTER TABLE "workspace_files" ADD CONSTRAINT "workspace_files_trashedById_fkey"
  FOREIGN KEY ("trashedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workspace_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_files" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "workspace_files";
CREATE POLICY workspace_isolation ON "workspace_files"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());

ALTER TABLE "user_file_quotas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_file_quotas" FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_isolation ON "user_file_quotas"
  USING (app_rls_bypass() OR "workspaceId" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "workspaceId" = app_workspace_id());

ALTER TABLE "file_storage_reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "file_storage_reservations" FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_isolation ON "file_storage_reservations"
  USING (app_rls_bypass() OR "workspaceId" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "workspaceId" = app_workspace_id());

ALTER TABLE "file_folders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "file_folders" FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_isolation ON "file_folders"
  USING (app_rls_bypass() OR "workspaceId" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "workspaceId" = app_workspace_id());
