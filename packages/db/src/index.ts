import { PrismaClient } from "@prisma/client";
import { getRequestContext } from "./request-context";
import { recordSlowQuery } from "./perf-metrics";

function nonEmpty(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function hasTenantIdentifier(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.hostname.includes("ep-")) return true;
    if (url.searchParams.has("external_id") || url.searchParams.has("sni_hostname")) return true;
    const options = url.searchParams.get("options");
    if (options && options.includes("project=")) return true;
    return false;
  } catch {
    return false;
  }
}

function resolveDatabaseUrl() {
  const configured = nonEmpty(process.env.DATABASE_URL);
  const prismaUrl = nonEmpty(process.env.POSTGRES_PRISMA_URL);
  const pooledUrl = nonEmpty(process.env.POSTGRES_URL);
  if (!configured) return prismaUrl || pooledUrl;

  if (hasTenantIdentifier(configured)) return configured;
  if (prismaUrl && hasTenantIdentifier(prismaUrl)) return prismaUrl;
  if (pooledUrl && hasTenantIdentifier(pooledUrl)) return pooledUrl;
  return configured;
}

// Prefer a connection string that includes tenant routing metadata for managed Postgres providers.
process.env.DATABASE_URL = resolveDatabaseUrl();

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
export * from "./workspace-rls";
export { PrismaClient };
export {
  EmailTemplateBodyFormat,
  EmailTemplateLayout,
  EmailTemplateType,
  EmailType,
  MediaGenerationStatus,
  MediaGenerationType,
  Prisma,
  UserRole,
} from "@prisma/client";
export type {
  Activity,
  EmailDraft,
  Lead,
  LeadContact,
  ScoringWeight,
  WorkspaceInvoice,
  WorkspaceInvoiceItem,
  WorkspaceSavedSearch,
} from "@prisma/client";
