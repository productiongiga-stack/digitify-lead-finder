import { PrismaClient } from "@prisma/client";
import { scryptSync, timingSafeEqual, createHash } from "crypto";

const prisma = new PrismaClient();

function verifyPassword(password, storedHash) {
  if (storedHash.includes(":")) {
    const [salt, hash] = storedHash.split(":");
    const derivedHash = scryptSync(password, salt, 64);
    return timingSafeEqual(derivedHash, Buffer.from(hash, "hex"));
  }
  return createHash("sha256").update(password).digest("hex") === storedHash;
}

async function main() {
  const email = process.argv[2] || "admin@digitify.local";
  const password = process.argv[3] || "DigitifyDev2026!";

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: {
      id: true,
      email: true,
      role: true,
      passwordHash: true,
      emailVerified: true,
    },
  });

  if (!user) {
    console.log("RESULT: USER_NOT_FOUND");
    return;
  }

  const passwordOk = user.passwordHash ? verifyPassword(password, user.passwordHash) : false;
  console.log("RESULT:", JSON.stringify({
    email: user.email,
    role: user.role,
    emailVerified: Boolean(user.emailVerified),
    passwordOk,
    hashType: user.passwordHash?.includes(":") ? "scrypt" : "legacy",
  }));
}

main()
  .catch((e) => {
    console.error("ERROR", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
