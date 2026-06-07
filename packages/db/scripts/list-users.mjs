import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      email: true,
      role: true,
      name: true,
      emailVerified: true,
      passwordHash: true,
    },
    orderBy: { createdAt: "asc" },
    take: 30,
  });
  console.log("USER_COUNT", users.length);
  for (const user of users) {
    console.log(
      JSON.stringify({
        email: user.email,
        role: user.role,
        name: user.name,
        emailVerified: Boolean(user.emailVerified),
        hasPassword: Boolean(user.passwordHash),
        hashType: user.passwordHash
          ? user.passwordHash.includes(":")
            ? "scrypt"
            : "legacy"
          : "none",
      }),
    );
  }
}

main()
  .catch((error) => {
    console.error("DB_ERROR:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
