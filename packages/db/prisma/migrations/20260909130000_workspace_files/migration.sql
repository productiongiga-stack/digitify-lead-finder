-- CreateTable
CREATE TABLE "workspace_files" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "storage" TEXT NOT NULL DEFAULT 'local',
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_files_createdById_createdAt_idx" ON "workspace_files"("createdById", "createdAt" DESC);
CREATE INDEX "workspace_files_createdById_relatedType_relatedId_idx" ON "workspace_files"("createdById", "relatedType", "relatedId");

-- AddForeignKey
ALTER TABLE "workspace_files" ADD CONSTRAINT "workspace_files_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_files" ADD CONSTRAINT "workspace_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
