/**
 * Copy shared settings from legacy user:{workspaceOwnerId}:* to workspace:{workspaceOwnerId}:*.
 *
 * Idempotent: skips keys that already exist under workspace: prefix.
 * Does NOT delete legacy rows (read fallback remains).
 *
 * Usage:
 *   pnpm db:migrate-workspace-settings
 *   pnpm db:migrate-workspace-settings -- --dry-run
 */
import { PrismaClient } from "@prisma/client";

const MEMBER_SCOPED = (key: string) => {
  const k = key.trim();
  if (k === "modules.disabled") return true;
  return k.startsWith("ui.") || k.startsWith("display.");
};

function workspaceKey(workspaceId: string, logical: string) {
  return `workspace:${workspaceId}:${logical.trim()}`;
}

function legacyKey(workspaceId: string, logical: string) {
  return `user:${workspaceId}:${logical.trim()}`;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const prisma = new PrismaClient();

  const users = await prisma.user.findMany({
    select: { id: true, role: true, workspaceOwnerId: true },
  });

  const workspaceIds = new Set<string>();
  for (const user of users) {
    if (user.role === "OWNER") workspaceIds.add(user.id);
    if (user.workspaceOwnerId) workspaceIds.add(user.workspaceOwnerId);
  }

  let totalCopy = 0;
  let totalSkipExists = 0;
  let totalSkipMember = 0;

  for (const workspaceId of workspaceIds) {
    let wsCopy = 0;
    let wsSkipExists = 0;
    let wsSkipMember = 0;

    const legacyRows = await prisma.setting.findMany({
      where: { key: { startsWith: `user:${workspaceId}:` } },
    });

    const existingWorkspace = await prisma.setting.findMany({
      where: { key: { startsWith: `workspace:${workspaceId}:` } },
      select: { key: true },
    });
    const existingSet = new Set(existingWorkspace.map((row) => row.key));

    for (const row of legacyRows) {
      const logical = row.key.slice(`user:${workspaceId}:`.length);
      if (MEMBER_SCOPED(logical)) {
        wsSkipMember += 1;
        totalSkipMember += 1;
        continue;
      }

      const targetKey = workspaceKey(workspaceId, logical);
      if (existingSet.has(targetKey)) {
        wsSkipExists += 1;
        totalSkipExists += 1;
        continue;
      }

      if (!dryRun) {
        await prisma.setting.create({
          data: { key: targetKey, value: row.value },
        });
        existingSet.add(targetKey);
      }
      wsCopy += 1;
      totalCopy += 1;
    }

    console.log(
      `[${workspaceId}] legacy=${legacyRows.length} copy=${wsCopy} skip_exists=${wsSkipExists} skip_member=${wsSkipMember}${dryRun ? " (dry-run)" : ""}`,
    );
  }

  console.log(
    `\nWorkspace settings migration ${dryRun ? "planned" : "complete"}: copied=${totalCopy}, already_present=${totalSkipExists}, member_scoped_skipped=${totalSkipMember}, workspaces=${workspaceIds.size}`,
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await new PrismaClient().$disconnect();
  process.exit(1);
});
