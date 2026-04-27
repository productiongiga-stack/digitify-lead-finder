import { PrismaClient } from "@prisma/client";
import { getRequestContext } from "./request-context";
import { recordSlowQuery } from "./perf-metrics";

function nonEmpty(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

// Never override an explicitly provided DATABASE_URL.
// Fallbacks are only used when DATABASE_URL is missing.
process.env.DATABASE_URL =
  nonEmpty(process.env.DATABASE_URL) ||
  nonEmpty(process.env.POSTGRES_PRISMA_URL) ||
  nonEmpty(process.env.POSTGRES_URL);

process.env.DIRECT_URL =
  nonEmpty(process.env.DIRECT_URL) ||
  nonEmpty(process.env.POSTGRES_URL_NON_POOLING);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaQueryListenerAttached: boolean | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [{ emit: "event", level: "query" }],
  });

if (!globalForPrisma.prismaQueryListenerAttached) {
  (prisma as any).$on("query", (event: { duration: number }) => {
    const request = getRequestContext();
    recordSlowQuery({
      requestId: request?.requestId,
      userId: request?.userId,
      path: request?.trpcPath,
      type: request?.trpcType,
      model: "sql",
      action: "query",
      durationMs: event.duration,
    });
  });
  globalForPrisma.prismaQueryListenerAttached = true;
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "./secure-settings";
export * from "./request-context";
export * from "./perf-metrics";
export * from "@prisma/client";
export type { PrismaClient } from "@prisma/client";
