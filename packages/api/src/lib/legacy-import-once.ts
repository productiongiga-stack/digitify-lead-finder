import type { PrismaClient } from "@digitify/db";

/** Completion is durable, even when a workspace subsequently deletes all imported rows. */
export async function runLegacyImportOnce(
  db: PrismaClient,
  workspaceId: string,
  source: string,
  run: (tx: PrismaClient) => Promise<{ imported: number }>,
) {
  const key = `workspace:${workspaceId}:migration.${source}.v1`;
  const completed = await db.setting.findUnique({ where: { key }, select: { key: true } });
  if (completed) return { imported: 0 };
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    if (await tx.setting.findUnique({ where: { key }, select: { key: true } })) return { imported: 0 };
    const result = await run(tx as unknown as PrismaClient);
    await tx.setting.create({ data: { key, value: { completedAt: new Date().toISOString(), imported: result.imported } } });
    return result;
  });
}
