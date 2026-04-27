import { PrismaClient } from "@prisma/client";

const pooledUrl = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
const directUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.DIRECT_URL;

// Prefer pooled connection URLs in production/serverless for lower latency and fewer connection churn issues.
process.env.DATABASE_URL =
  process.env.NODE_ENV === "production"
    ? pooledUrl || process.env.DATABASE_URL
    : process.env.DATABASE_URL || pooledUrl;

if (!process.env.DIRECT_URL && directUrl) {
  process.env.DIRECT_URL = directUrl;
}

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
