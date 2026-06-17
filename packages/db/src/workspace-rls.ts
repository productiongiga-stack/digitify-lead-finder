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
    timeout:
      overrides?.timeout ??
      (Number.isFinite(timeoutFromEnv) && timeoutFromEnv > 0 ? timeoutFromEnv : DEFAULT_RLS_TX_TIMEOUT_MS),
    maxWait:
      overrides?.maxWait ??
      (Number.isFinite(maxWaitFromEnv) && maxWaitFromEnv > 0 ? maxWaitFromEnv : DEFAULT_RLS_TX_MAX_WAIT_MS),
  };
}

const rlsTxStorage = new AsyncLocalStorage<Prisma.TransactionClient>();

export async function setWorkspaceRlsContext(
  db: Prisma.TransactionClient,
  workspaceId: string,
) {
  await db.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
}

async function runInWorkspaceRlsTransaction<T>(
  prisma: PrismaClient,
  workspaceId: string,
  run: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: RlsTransactionOptions,
): Promise<T> {
  const activeTx = rlsTxStorage.getStore();
  if (activeTx) {
    return run(activeTx);
  }

  return prisma.$transaction(async (tx) => {
    await setWorkspaceRlsContext(tx, workspaceId);
    return rlsTxStorage.run(tx, () => run(tx));
  }, resolveRlsTransactionOptions(options));
}

export function createWorkspaceRlsClient(prisma: PrismaClient, workspaceId: string): PrismaClient {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args }) {
          return runInWorkspaceRlsTransaction(prisma, workspaceId, async (tx) => {
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
            input as (tx: Prisma.TransactionClient) => Promise<unknown>,
            options,
          );
        }
        if (Array.isArray(input)) {
          return runInWorkspaceRlsTransaction(
            prisma,
            workspaceId,
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
        return runInWorkspaceRlsTransaction(prisma, workspaceId, async (tx) => tx.$executeRaw(...args));
      },
      $queryRaw(...args: Parameters<PrismaClient["$queryRaw"]>) {
        return runInWorkspaceRlsTransaction(prisma, workspaceId, async (tx) => tx.$queryRaw(...args));
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
): Promise<T> {
  if (!workspaceId || !isWorkspaceRlsEnabled()) {
    return handler(prisma);
  }

  const rlsDb = createWorkspaceRlsClient(prisma, workspaceId);
  return handler(rlsDb);
}
