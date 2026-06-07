import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { scryptSync, randomBytes } from "crypto";

const FIX_TOKEN = "bootstrap-owner-20260607-digitify";

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

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function ensureWorkspaceSchema() {
  await runSql(`CREATE TYPE "WorkspaceType" AS ENUM ('PERSONAL', 'TEAM')`);
  await runSql(`CREATE TYPE "WorkspaceMembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'DECLINED')`);
  await runSql(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activeWorkspaceId" TEXT`);
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
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "workspace_memberships_pkey" PRIMARY KEY ("id")
    )
  `);
  await runSql(`CREATE UNIQUE INDEX IF NOT EXISTS "workspace_memberships_workspaceId_userId_key" ON "workspace_memberships"("workspaceId", "userId")`);
}

async function ensureAnalyticsSchema() {
  await runSql(`
    CREATE TABLE IF NOT EXISTS "workspace_analytics_events" (
      "id" TEXT NOT NULL,
      "workspaceId" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "path" TEXT,
      "userId" TEXT,
      "sessionId" TEXT,
      "metadata" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "workspace_analytics_events_pkey" PRIMARY KEY ("id")
    )
  `);
  await runSql(`CREATE INDEX IF NOT EXISTS "workspace_analytics_events_workspaceId_createdAt_idx" ON "workspace_analytics_events"("workspaceId", "createdAt" DESC)`);
}

async function ensureEmailTemplateSchema() {
  await runSql(`
    DO $$ BEGIN
      CREATE TYPE "EmailTemplateType" AS ENUM (
        'OUTREACH', 'FOLLOW_UP', 'PROPOSAL', 'REPORT', 'BOOKING', 'REVIEW', 'REENGAGEMENT', 'CUSTOM'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await runSql(`
    DO $$ BEGIN
      CREATE TYPE "EmailTemplateLayout" AS ENUM ('modern', 'minimal', 'business', 'proposal', 'followup');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await runSql(`
    DO $$ BEGIN
      CREATE TYPE "EmailTemplateBodyFormat" AS ENUM ('TEXT', 'HTML');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await runSql(`ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "type" "EmailTemplateType" NOT NULL DEFAULT 'CUSTOM'`);
  await runSql(`ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "layout" "EmailTemplateLayout" NOT NULL DEFAULT 'modern'`);
  await runSql(`ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL DEFAULT ''`);
  await runSql(`ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "ctaText" TEXT NOT NULL DEFAULT ''`);
  await runSql(`ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "ctaUrl" TEXT NOT NULL DEFAULT ''`);
  await runSql(`ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "campaignId" TEXT`);
  await runSql(`ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "isGlobal" BOOLEAN NOT NULL DEFAULT false`);
  await runSql(`ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "bodyFormat" "EmailTemplateBodyFormat" NOT NULL DEFAULT 'TEXT'`);
  await runSql(`CREATE INDEX IF NOT EXISTS "email_templates_createdById_type_idx" ON "email_templates"("createdById", "type")`);
  await runSql(`CREATE INDEX IF NOT EXISTS "email_templates_createdById_layout_idx" ON "email_templates"("createdById", "layout")`);
  await runSql(`
    DO $$ BEGIN
      CREATE TYPE "EmailModule" AS ENUM ('LEADS', 'CAMPAIGNS', 'QUOTES', 'INVOICES', 'BOOKINGS', 'REVIEWS', 'AUTH', 'INBOX', 'SYSTEM');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await runSql(`ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "module" "EmailModule" NOT NULL DEFAULT 'LEADS'`);
  await runSql(`ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "templateKey" TEXT`);
  await runSql(`ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false`);
  await runSql(`CREATE INDEX IF NOT EXISTS "email_templates_createdById_module_idx" ON "email_templates"("createdById", "module")`);
  await runSql(`CREATE UNIQUE INDEX IF NOT EXISTS "email_templates_createdById_templateKey_key" ON "email_templates"("createdById", "templateKey")`);
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get("x-bootstrap-token");
    if (token !== FIX_TOKEN) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };

    await ensureEmailTemplateSchema();

    const email = body.email?.trim().toLowerCase() || "contact@digitify.be";
    const password = body.password?.trim() || "DigitifyContact2026!";
    if (password.length < 12) {
      return NextResponse.json({ error: "invalid_password" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { email },
      data: {
        passwordHash: hashPassword(password),
        emailVerified: new Date(),
        role: "OWNER",
      },
      select: { id: true, email: true, role: true, name: true },
    });

    return NextResponse.json({ ok: true, user, schemaFixed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
