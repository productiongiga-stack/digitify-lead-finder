import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const email = process.argv[2]?.toLowerCase().trim();
  const password = process.argv[3];
  if (!email || !password) {
    console.error("Usage: node scripts/reset-password.mjs <email> <password>");
    process.exitCode = 1;
    return;
  }
  if (password.length < 12) {
    console.error("Password must be at least 12 characters.");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.update({
    where: { email },
    data: {
      passwordHash: hashPassword(password),
      emailVerified: new Date(),
    },
    select: { email: true, role: true, name: true },
  });

  console.log("RESET_OK", user);
}

main()
  .catch((error) => {
    if (error.code === "P2025") {
      console.error("USER_NOT_FOUND");
    } else {
      console.error("ERROR:", error.message);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
