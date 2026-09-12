import { PrismaClient } from "@prisma/client";
import { scryptSync, timingSafeEqual, createHash, randomBytes } from "crypto";

const prisma = new PrismaClient();

function verifyPassword(password, storedHash) {
  if (storedHash.includes(":")) {
    const [salt, hash] = storedHash.split(":");
    const derivedHash = scryptSync(password, salt, 64);
    return timingSafeEqual(derivedHash, Buffer.from(hash, "hex"));
  }
  return createHash("sha256").update(password).digest("hex") === storedHash;
}

async function resolveActiveWorkspaceId(db, userId) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, activeWorkspaceId: true, name: true, email: true },
  });
  if (!user) return userId;
  const preferred = user.activeWorkspaceId;
  if (preferred) {
    const membership = await db.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId: preferred, userId } },
      select: { status: true },
    });
    if (preferred === userId || membership?.status === "ACTIVE") return preferred;
  }
  return userId;
}

async function authorize(email, password) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
      emailVerified: true,
      workspaceOwnerId: true,
    },
  });

  if (!user || !user.passwordHash) return { ok: false, reason: "unknown_user" };
  if (!verifyPassword(password, user.passwordHash)) return { ok: false, reason: "bad_password" };
  if (!user.emailVerified && user.role !== "OWNER" && user.role !== "ADMIN") {
    return { ok: false, reason: "email_not_verified" };
  }

  const workspaceId = await resolveActiveWorkspaceId(prisma, user.id);
  return { ok: true, userId: user.id, workspaceId };
}

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: pnpm exec node scripts/simulate-auth.mjs <email> <password>");
    process.exitCode = 1;
    return;
  }
  const result = await authorize(email, password);
  console.log("AUTH_SIMULATION", JSON.stringify(result));
}

main()
  .catch((e) => {
    console.error("AUTH_ERROR", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
