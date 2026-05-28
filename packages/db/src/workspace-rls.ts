import type { Prisma, PrismaClient } from "@prisma/client";

export function isWorkspaceRlsEnabled() {
  return process.env.ENABLE_WORKSPACE_RLS === "true";
}

export async function setWorkspaceRlsContext(
  db: Prisma.TransactionClient,
  workspaceId: string,
) {
  await db.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
}

/**
 * Runs handler inside a transaction with Postgres RLS workspace context when enabled.
 * When disabled, passes the root Prisma client through unchanged.
 */
export async function withWorkspaceRls<T>(
  prisma: PrismaClient,
  workspaceId: string | undefined,
  handler: (db: PrismaClient | Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (!workspaceId || !isWorkspaceRlsEnabled()) {
    return handler(prisma);
  }

  return prisma.$transaction(async (tx) => {
    await setWorkspaceRlsContext(tx, workspaceId);
    return handler(tx);
  });
}
