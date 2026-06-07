import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function personalWorkspaceName(userName, email) {
  const base = userName?.trim() || email?.split("@")[0] || "Mijn";
  return `${base} — persoonlijk`;
}

async function ensurePersonalWorkspace(userId, displayName, email) {
  const name = personalWorkspaceName(displayName, email);

  const existing = await prisma.workspace.findUnique({
    where: { id: userId },
    select: { type: true },
  });

  if (!existing) {
    await prisma.workspace.create({
      data: {
        id: userId,
        name,
        type: "PERSONAL",
        ownerUserId: userId,
      },
    });
  } else if (existing.type === "PERSONAL") {
    await prisma.workspace.update({
      where: { id: userId },
      data: { name },
    });
  }

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
      status: "ACTIVE",
      role: "OWNER",
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

async function main() {
  const email = process.argv[2]?.toLowerCase().trim();
  const password = process.argv[3];
  const name = process.argv[4]?.trim() || "Digitify Contact";

  if (!email || !password) {
    console.error("Usage: node scripts/create-owner.mjs <email> <password> [name]");
    process.exitCode = 1;
    return;
  }
  if (password.length < 12) {
    console.error("Password must be at least 12 characters.");
    process.exitCode = 1;
    return;
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

  console.log("CREATE_OWNER_OK", user);
}

main()
  .catch((error) => {
    console.error("ERROR:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
