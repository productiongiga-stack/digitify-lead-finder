-- Fix: "The table public.workspace_tasks does not exist"
-- Supabase → SQL Editor → New query → paste → Run
-- Safe to re-run (idempotent).

CREATE OR REPLACE FUNCTION app_workspace_id() RETURNS text AS $$
  SELECT nullif(current_setting('app.workspace_id', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_rls_bypass() RETURNS boolean AS $$
  SELECT app_workspace_id() IS NULL;
$$ LANGUAGE sql STABLE;

DO $$ BEGIN
  CREATE TYPE "WorkspaceTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WorkspaceTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WorkspaceTaskRelatedType" AS ENUM ('LEAD', 'QUOTE', 'BOOKING', 'CLIENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "workspace_tasks" (
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

CREATE INDEX IF NOT EXISTS "workspace_tasks_createdById_status_idx"
  ON "workspace_tasks"("createdById", "status");
CREATE INDEX IF NOT EXISTS "workspace_tasks_createdById_updatedAt_idx"
  ON "workspace_tasks"("createdById", "updatedAt");

DO $$ BEGIN
  ALTER TABLE "workspace_tasks"
    ADD CONSTRAINT "workspace_tasks_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "workspace_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_tasks" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "workspace_tasks";
CREATE POLICY workspace_isolation ON "workspace_tasks"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());
