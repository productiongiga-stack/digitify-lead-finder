import { PrismaClient } from "@prisma/client";

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
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "./secure-settings";
export * from "@prisma/client";
export type { PrismaClient } from "@prisma/client";
