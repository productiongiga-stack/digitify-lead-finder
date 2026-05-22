-- CreateEnum
CREATE TYPE "WorkspaceTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "WorkspaceTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "WorkspaceTaskRelatedType" AS ENUM ('LEAD', 'QUOTE', 'BOOKING', 'CLIENT');

-- CreateTable
CREATE TABLE "workspace_tasks" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "WorkspaceTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "WorkspaceTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueAt" TIMESTAMP(3),
    "relatedType" "WorkspaceTaskRelatedType",
    "relatedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_tasks_createdById_status_idx" ON "workspace_tasks"("createdById", "status");

-- CreateIndex
CREATE INDEX "workspace_tasks_createdById_updatedAt_idx" ON "workspace_tasks"("createdById", "updatedAt");

-- AddForeignKey
ALTER TABLE "workspace_tasks" ADD CONSTRAINT "workspace_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (opt-in via ENABLE_WORKSPACE_RLS)
ALTER TABLE "workspace_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_tasks" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "workspace_tasks";
CREATE POLICY workspace_isolation ON "workspace_tasks"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());
