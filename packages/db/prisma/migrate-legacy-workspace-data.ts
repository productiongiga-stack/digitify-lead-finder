/**
 * Import legacy workspace JSON blobs into their relational tables.
 *
 * This is intentionally an explicit setup operation. User-facing list and
 * detail queries must not perform one-time data migrations on the hot path.
 * The underlying imports remain idempotent and keep the legacy settings rows.
 *
 * Usage:
 *   pnpm db:migrate-legacy-workspace-data -- --dry-run
 *   pnpm db:migrate-legacy-workspace-data
 */
import { PrismaClient, UserRole } from "@prisma/client";
import { migrateLegacyWorkspaceInvoices } from "../../api/src/lib/migrate-workspace-invoices";
import { migrateLegacyWorkspaceSavedSearches } from "../../api/src/lib/migrate-workspace-saved-searches";
import { migrateLegacyWorkspaceTasks } from "../../api/src/lib/migrate-workspace-tasks";
import { readWorkspaceJsonSetting } from "../../api/src/lib/user-json-setting";

const LEGACY_KEYS = [
  ["tasks", "tasks.items_json"],
  ["saved-searches", "search.saved_searches_json"],
  ["invoices", "invoices.items_json"],
] as const;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const prisma = new PrismaClient();
  const owners = await prisma.user.findMany({
    where: { role: UserRole.OWNER },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });

  let imported = 0;
  let pending = 0;

  for (const owner of owners) {
    const scope = { workspaceId: owner.id, memberId: owner.id };
    const counts = await Promise.all(
      LEGACY_KEYS.map(async ([label, key]) => {
        const value = await readWorkspaceJsonSetting<unknown[]>(prisma, scope, key, []);
        return [label, Array.isArray(value) ? value.length : 0] as const;
      }),
    );
    const ownerPending = counts.reduce((sum, [, count]) => sum + count, 0);
    if (ownerPending === 0) continue;

    pending += ownerPending;
    if (dryRun) {
      console.log(`[${owner.email}] legacy_entries=${ownerPending} (dry-run)`);
      continue;
    }

    const [tasks, savedSearches, invoices] = await Promise.all([
      migrateLegacyWorkspaceTasks(prisma, scope),
      migrateLegacyWorkspaceSavedSearches(prisma, scope),
      migrateLegacyWorkspaceInvoices(prisma, scope),
    ]);
    const ownerImported = tasks.imported + savedSearches.imported + invoices.imported;
    imported += ownerImported;
    console.log(
      `[${owner.email}] tasks=${tasks.imported} saved_searches=${savedSearches.imported} invoices=${invoices.imported}`,
    );
  }

  console.log(
    dryRun
      ? `Legacy workspace migration planned: ${pending} JSON entries across ${owners.length} owner(s)`
      : `Legacy workspace migration complete: imported=${imported}, owners=${owners.length}`,
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
