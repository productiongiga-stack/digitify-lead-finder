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
}
