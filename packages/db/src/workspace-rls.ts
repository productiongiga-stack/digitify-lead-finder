import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma, PrismaClient } from "@prisma/client";

export function isWorkspaceRlsEnabled() {
  return process.env.ENABLE_WORKSPACE_RLS === "true";
}

const DEFAULT_RLS_TX_TIMEOUT_MS = 30_000;
const DEFAULT_RLS_TX_MAX_WAIT_MS = 30_000;

type RlsTransactionOptions = {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
};

function resolveRlsTransactionOptions(overrides?: RlsTransactionOptions): RlsTransactionOptions {
  const timeoutFromEnv = Number(process.env.WORKSPACE_RLS_TX_TIMEOUT_MS);
  const maxWaitFromEnv = Number(process.env.WORKSPACE_RLS_TX_MAX_WAIT_MS);

  return {
    isolationLevel: overrides?.isolationLevel,
    timeout:
      overrides?.timeout ??
      (Number.isFinite(timeoutFromEnv) && timeoutFromEnv > 0 ? timeoutFromEnv : DEFAULT_RLS_TX_TIMEOUT_MS),
    maxWait:
      overrides?.maxWait ??
      (Number.isFinite(maxWaitFromEnv) && maxWaitFromEnv > 0 ? maxWaitFromEnv : DEFAULT_RLS_TX_MAX_WAIT_MS),
  };
}

const rlsTxStorage = new AsyncLocalStorage<{
  tx: Prisma.TransactionClient;
  workspaceId: string;
  userId?: string;
  prisma: PrismaClient;
}>();

export async function setWorkspaceRlsContext(
  db: Prisma.TransactionClient,
  workspaceId: string,
  userId?: string,
) {
  await db.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
  if (userId) await db.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
}

/**
 * Switch only the member scope inside the already validated RLS transaction.
 * This is used for platform-owner operations after the API has checked the
 * target account; it never changes the workspace tenant scope.
 */
export async function setWorkspaceRlsUserContext(
  db: Prisma.TransactionClient,
  userId: string,
) {
  await db.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
}

async function runInWorkspaceRlsTransaction<T>(
  prisma: PrismaClient,
  workspaceId: string,
  userId: string | undefined,
  run: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: RlsTransactionOptions,
): Promise<T> {
  const activeTx = rlsTxStorage.getStore();
  if (activeTx) {
    if (activeTx.workspaceId !== workspaceId || activeTx.userId !== userId || activeTx.prisma !== prisma) {
      throw new Error("RLS transaction cannot switch workspace or database");
    }
    return run(activeTx.tx);
  }

  return prisma.$transaction(async (tx) => {
    await setWorkspaceRlsContext(tx, workspaceId, userId);
    return rlsTxStorage.run({ tx, workspaceId, userId, prisma }, () => run(tx));
  }, resolveRlsTransactionOptions(options));
}

export function createWorkspaceRlsClient(prisma: PrismaClient, workspaceId: string, userId?: string): PrismaClient {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args }) {
          return runInWorkspaceRlsTransaction(prisma, workspaceId, userId, async (tx) => {
            const delegate = (tx as Prisma.TransactionClient & Record<string, Record<string, unknown>>)[model];
            const method = delegate?.[operation];
            if (typeof method !== "function") {
              throw new Error(`RLS client: unsupported operation ${String(model)}.${String(operation)}`);
            }
            return (method as (value: unknown) => Promise<unknown>)(args);
          });
        },
      },
    },
    client: {
      $transaction(input: unknown, options?: RlsTransactionOptions) {
        if (typeof input === "function") {
          return runInWorkspaceRlsTransaction(
            prisma,
            workspaceId,
            userId,
            input as (tx: Prisma.TransactionClient) => Promise<unknown>,
            options,
          );
        }
        if (Array.isArray(input)) {
          return runInWorkspaceRlsTransaction(
            prisma,
            workspaceId,
            userId,
            async () => {
              const results: unknown[] = [];
              for (const promise of input as Prisma.PrismaPromise<unknown>[]) {
                results.push(await promise);
              }
              return results;
            },
            options,
          );
        }
        throw new TypeError("RLS client: unsupported $transaction argument");
      },
      $executeRaw(...args: Parameters<PrismaClient["$executeRaw"]>) {
        return runInWorkspaceRlsTransaction(prisma, workspaceId, userId, async (tx) => tx.$executeRaw(...args));
      },
      $queryRaw(...args: Parameters<PrismaClient["$queryRaw"]>) {
        return runInWorkspaceRlsTransaction(prisma, workspaceId, userId, async (tx) => tx.$queryRaw(...args));
      },
    },
  }) as unknown as PrismaClient;
}

/**
 * Provides an RLS-aware Prisma client when ENABLE_WORKSPACE_RLS=true.
 * Each query runs in its own short transaction so slow I/O between DB calls
 * does not hold pooled connections open.
 */
export async function withWorkspaceRls<T>(
  prisma: PrismaClient,
  workspaceId: string | undefined,
  handler: (db: PrismaClient | Prisma.TransactionClient) => Promise<T>,
  userId?: string,
): Promise<T> {
  if (!workspaceId || !isWorkspaceRlsEnabled()) {
    return handler(prisma);
  }

  const rlsDb = createWorkspaceRlsClient(prisma, workspaceId, userId);
  return handler(rlsDb);
}
