/**
 * Migrate templates.library_json from workspace settings into email_templates rows.
 *
 * Usage:
 *   pnpm db:migrate-legacy-templates
 *   pnpm db:migrate-legacy-templates -- --dry-run
 */
import { PrismaClient, UserRole } from "@prisma/client";
import {
  countLegacyLibraryEntries,
  migrateLegacyTemplateLibrary,
  readLegacyTemplateLibrary,
} from "../../api/src/lib/migrate-legacy-template-library";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const prisma = new PrismaClient();
  const owners = await prisma.user.findMany({
    where: { role: UserRole.OWNER },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });

  let totalPending = 0;
  let totalMigrated = 0;

  for (const owner of owners) {
    const scope = { workspaceId: owner.id, memberId: owner.id };
    const raw = await readLegacyTemplateLibrary(prisma, scope);
    const pending = countLegacyLibraryEntries(raw);
    if (pending === 0) continue;

    totalPending += pending;
    if (dryRun) {
      console.log(`[${owner.email}] would migrate ${pending} legacy template(s)`);
      continue;
    }

    const result = await migrateLegacyTemplateLibrary(prisma, scope);
    totalMigrated += result.migrated;
    console.log(
      `[${owner.email}] migrated=${result.migrated} remaining=${result.remaining}`,
    );
  }

  console.log(
    dryRun
      ? `Legacy template migration planned: ${totalPending} entries across workspaces`
      : `Legacy template migration complete: migrated=${totalMigrated}, scanned_pending=${totalPending}`,
  );

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
