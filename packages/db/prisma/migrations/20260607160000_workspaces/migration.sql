-- CreateEnum
CREATE TYPE "WorkspaceType" AS ENUM ('PERSONAL', 'TEAM');

-- CreateEnum
CREATE TYPE "WorkspaceMembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'DECLINED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "activeWorkspaceId" TEXT;

-- AlterTable
ALTER TABLE "registration_requests" ADD COLUMN "targetWorkspaceId" TEXT;

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WorkspaceType" NOT NULL DEFAULT 'TEAM',
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_memberships" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "status" "WorkspaceMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "invitedById" TEXT,
    "invitedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_activeWorkspaceId_idx" ON "users"("activeWorkspaceId");

-- CreateIndex
CREATE INDEX "workspaces_ownerUserId_idx" ON "workspaces"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_memberships_workspaceId_userId_key" ON "workspace_memberships"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "workspace_memberships_userId_status_idx" ON "workspace_memberships"("userId", "status");

-- CreateIndex
CREATE INDEX "workspace_memberships_workspaceId_status_idx" ON "workspace_memberships"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "registration_requests_targetWorkspaceId_status_createdAt_idx" ON "registration_requests"("targetWorkspaceId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: personal workspace per user (id = user id)
INSERT INTO "workspaces" ("id", "name", "type", "ownerUserId", "createdAt", "updatedAt")
SELECT
  u."id",
  COALESCE(NULLIF(TRIM(u."name"), ''), SPLIT_PART(u."email", '@', 1), 'Mijn werkruimte'),
  'PERSONAL'::"WorkspaceType",
  u."id",
  u."createdAt",
  NOW()
FROM "users" u
ON CONFLICT ("id") DO NOTHING;

-- Backfill: personal membership (every user is OWNER of personal workspace)
INSERT INTO "workspace_memberships" ("id", "workspaceId", "userId", "role", "status", "createdAt", "updatedAt")
SELECT
  CONCAT('migr_personal_', u."id"),
  u."id",
  u."id",
  'OWNER'::"UserRole",
  'ACTIVE'::"WorkspaceMembershipStatus",
  u."createdAt",
  NOW()
FROM "users" u
ON CONFLICT ("workspaceId", "userId") DO NOTHING;

-- Backfill: legacy team workspaces (owner id = workspace id when members exist)
INSERT INTO "workspaces" ("id", "name", "type", "ownerUserId", "createdAt", "updatedAt")
SELECT DISTINCT
  owner."id",
  COALESCE(NULLIF(TRIM(owner."name"), ''), SPLIT_PART(owner."email", '@', 1), 'Team werkruimte'),
  'TEAM'::"WorkspaceType",
  owner."id",
  owner."createdAt",
  NOW()
FROM "users" member
JOIN "users" owner ON member."workspaceOwnerId" = owner."id"
ON CONFLICT ("id") DO UPDATE SET
  "type" = 'TEAM'::"WorkspaceType",
  "updatedAt" = NOW();

-- Upgrade personal workspace to TEAM when it has team members
UPDATE "workspaces" w
SET "type" = 'TEAM'::"WorkspaceType", "updatedAt" = NOW()
WHERE w."type" = 'PERSONAL'
  AND EXISTS (
    SELECT 1 FROM "users" m
    WHERE m."workspaceOwnerId" = w."id"
  );

-- Backfill: team memberships for legacy members
INSERT INTO "workspace_memberships" ("id", "workspaceId", "userId", "role", "status", "createdAt", "updatedAt")
SELECT
  CONCAT('migr_team_', m."workspaceOwnerId", '_', m."id"),
  m."workspaceOwnerId",
  m."id",
  m."role",
  'ACTIVE'::"WorkspaceMembershipStatus",
  m."createdAt",
  NOW()
FROM "users" m
WHERE m."workspaceOwnerId" IS NOT NULL
ON CONFLICT ("workspaceId", "userId") DO NOTHING;

-- Backfill: team membership for legacy owners on their team workspace
INSERT INTO "workspace_memberships" ("id", "workspaceId", "userId", "role", "status", "createdAt", "updatedAt")
SELECT
  CONCAT('migr_owner_', o."id"),
  o."id",
  o."id",
  'OWNER'::"UserRole",
  'ACTIVE'::"WorkspaceMembershipStatus",
  o."createdAt",
  NOW()
FROM "users" o
WHERE EXISTS (
  SELECT 1 FROM "users" m WHERE m."workspaceOwnerId" = o."id"
)
ON CONFLICT ("workspaceId", "userId") DO NOTHING;

-- Default active workspace to personal workspace
UPDATE "users"
SET "activeWorkspaceId" = "id"
WHERE "activeWorkspaceId" IS NULL;

-- Sync invite target workspace id from legacy column
UPDATE "registration_requests"
SET "targetWorkspaceId" = "targetWorkspaceOwnerId"
WHERE "targetWorkspaceId" IS NULL
  AND "targetWorkspaceOwnerId" IS NOT NULL;
