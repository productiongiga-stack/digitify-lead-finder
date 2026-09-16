import { PrismaClient } from "@prisma/client";
import { assertSafeDatabaseRole } from "../src/database-role";

const prisma = new PrismaClient();

async function main() {
  try {
    const role = await assertSafeDatabaseRole(prisma);
    console.log(`OK: database role ${role.userName} is not SUPERUSER and does not have BYPASSRLS`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`ERROR: ${error instanceof Error ? error.message : "database role check failed"}`);
  process.exitCode = 1;
});
