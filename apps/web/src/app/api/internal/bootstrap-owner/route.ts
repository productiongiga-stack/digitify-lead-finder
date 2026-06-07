import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { scryptSync, randomBytes } from "crypto";

function personalWorkspaceName(userName: string | null | undefined, email: string) {
  const base = userName?.trim() || email.split("@")[0] || "Mijn";
  return `${base} — persoonlijk`;
}

const BOOTSTRAP_TOKEN = "bootstrap-owner-20260607-digitify";

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function runSql(statement: string) {
  try {
    await prisma.$executeRawUnsafe(statement);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      message.includes("already exists")
      || message.includes("duplicate key")
      || message.includes("42710")
      || message.includes("42P07")
    ) {
      return;
    }
    throw error;
  }
}

async function ensureWorkspaceSchema() {
  await runSql(`CREATE TYPE "WorkspaceType" AS ENUM ('PERSONAL', 'TEAM')`);
  await runSql(`CREATE TYPE "WorkspaceMembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'DECLINED')`);
  await runSql(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activeWorkspaceId" TEXT`);
  await runSql(`ALTER TABLE "registration_requests" ADD COLUMN IF NOT EXISTS "targetWorkspaceId" TEXT`);
  await runSql(`
    CREATE TABLE IF NOT EXISTS "workspaces" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "type" "WorkspaceType" NOT NULL DEFAULT 'TEAM',
      "ownerUserId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
    )
  `);
  await runSql(`
    CREATE TABLE IF NOT EXISTS "workspace_memberships" (
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
    )
  `);
  await runSql(`CREATE INDEX IF NOT EXISTS "users_activeWorkspaceId_idx" ON "users"("activeWorkspaceId")`);
  await runSql(`CREATE INDEX IF NOT EXISTS "workspaces_ownerUserId_idx" ON "workspaces"("ownerUserId")`);
  await runSql(`CREATE UNIQUE INDEX IF NOT EXISTS "workspace_memberships_workspaceId_userId_key" ON "workspace_memberships"("workspaceId", "userId")`);
  await runSql(`CREATE INDEX IF NOT EXISTS "workspace_memberships_userId_status_idx" ON "workspace_memberships"("userId", "status")`);
  await runSql(`CREATE INDEX IF NOT EXISTS "workspace_memberships_workspaceId_status_idx" ON "workspace_memberships"("workspaceId", "status")`);
  await runSql(`
    DO $$ BEGIN
      ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_ownerUserId_fkey"
        FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await runSql(`
    DO $$ BEGIN
      ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_workspaceId_fkey"
        FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await runSql(`
    DO $$ BEGIN
      ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await runSql(`
    DO $$ BEGIN
      ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_invitedById_fkey"
        FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
}

async function ensurePersonalWorkspace(userId: string, displayName: string | null, email: string) {
  const name = personalWorkspaceName(displayName, email);

  await prisma.workspace.upsert({
    where: { id: userId },
    create: {
      id: userId,
      name,
      type: "PERSONAL",
      ownerUserId: userId,
    },
    update: {
      name,
      type: "PERSONAL",
    },
  });

  await prisma.workspaceMembership.upsert({
    where: {
      workspaceId_userId: { workspaceId: userId, userId },
    },
    create: {
      workspaceId: userId,
      userId,
      role: "OWNER",
      status: "ACTIVE",
    },
    update: {
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      activeWorkspaceId: userId,
      workspaceOwnerId: null,
    },
  });
}

export async function POST(request: Request) {
  try {
  const token = request.headers.get("x-bootstrap-token");
  if (token !== BOOTSTRAP_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    email?: string;
    password?: string;
    name?: string;
  };

  const email = body.email?.trim().toLowerCase();
  const password = body.password?.trim();
  const name = body.name?.trim() || "Digitify Contact";

  if (!email || !password || password.length < 12) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  await ensureWorkspaceSchema();

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role: "OWNER",
      name,
      passwordHash: hashPassword(password),
      emailVerified: new Date(),
      workspaceOwnerId: null,
    },
    create: {
      email,
      name,
      role: "OWNER",
      passwordHash: hashPassword(password),
      emailVerified: new Date(),
    },
    select: { id: true, email: true, role: true, name: true },
  });

  await ensurePersonalWorkspace(user.id, user.name, user.email);

  return NextResponse.json({ ok: true, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
