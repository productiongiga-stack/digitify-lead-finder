import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { type PrismaClient, withWorkspaceRls, isWorkspaceRlsEnabled } from "@digitify/db";
import { patchRequestContext, recordRouteMetric } from "@digitify/db";
import { enforceRateLimit } from "./lib/rate-limit";
import { invalidateDashboardCacheForUser } from "./lib/dashboard-cache";
import { log } from "./lib/logger";
import { resolveWorkspaceOwnerId } from "./lib/workspace";

export type Context = {
  db: PrismaClient;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    /** Set by withWorkspace middleware on authenticated requests. */
    workspaceId?: string;
  } | null;
  requestId: string;
};

export type AppRole = "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER" | "TRIAL" | "TESTER" | "VIEWER";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

const DASHBOARD_INVALIDATION_PREFIXES = [
  "lead.",
  "quote.",
  "booking.",
  "campaign.",
  "contact.",
  "review.",
  "crm.",
  "domain.",
  "chatbot.",
];

function shouldInvalidateDashboardCache(path: string) {
  return DASHBOARD_INVALIDATION_PREFIXES.some((prefix) => path.startsWith(prefix));
}

// --- Logging middleware ---
const withLogging = t.middleware(async ({ ctx, path, type, next }) => {
  const start = Date.now();
  patchRequestContext({ trpcPath: path, trpcType: type });
  const result = await next();
  const durationMs = Date.now() - start;
  recordRouteMetric({ path, type, durationMs, ok: result.ok });

  if (!result.ok) {
    const errorCode = result.error instanceof TRPCError ? result.error.code : undefined;
    log.api.error(`tRPC ${type} ${path} failed`, {
      requestId: ctx.requestId,
      path,
      type,
      durationMs,
      code: errorCode,
      userId: ctx.user?.id,
    }, result.error);
  } else if (durationMs > 2000) {
    log.api.warn(`tRPC ${type} ${path} slow`, {
      requestId: ctx.requestId,
      path,
      type,
      durationMs,
      userId: ctx.user?.id,
    });
  }

  if (result.ok && type === "mutation" && ctx.user?.workspaceId && shouldInvalidateDashboardCache(path)) {
    invalidateDashboardCacheForUser(ctx.user.workspaceId);
  }

  return result;
});

// --- General rate limit middleware (100 req/min per user; Redis when REDIS_URL is set) ---
const withRateLimit = t.middleware(async ({ ctx, next }) => {
  const key = ctx.user?.id ?? "anonymous";
  await enforceRateLimit({ key: `general:${key}`, limit: 100, windowMs: 60_000 });
  return next();
});

// --- Auth middleware ---
const withWorkspace = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) return next();
  const workspaceId = await resolveWorkspaceOwnerId(ctx.db, ctx.user.id);
  return next({
    ctx: {
      ...ctx,
      user: { ...ctx.user, workspaceId },
    },
  });
});

/** Postgres RLS (opt-in: ENABLE_WORKSPACE_RLS=true). Sets app.workspace_id per transaction. */
const withWorkspaceRlsContext = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user?.workspaceId || !isWorkspaceRlsEnabled()) {
    return next();
  }
  return withWorkspaceRls(ctx.db, ctx.user.workspaceId, async (db) =>
    next({ ctx: { ...ctx, db: db as PrismaClient } }),
  );
});

const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const enforceTrialAccess = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user || ctx.user.role !== "TRIAL") return next();
  const user = await ctx.db.user.findUnique({
    where: { id: ctx.user.id },
    select: { createdAt: true },
  });
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Account niet gevonden." });
  }
  const trialDays = 7;
  const expiresAt = user.createdAt.getTime() + trialDays * 24 * 60 * 60 * 1000;
  if (Date.now() > expiresAt) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Je Trial (7 dagen) is verlopen. Contacteer een eigenaar of admin om je rol te upgraden.",
    });
  }
  return next();
});

export const protectedProcedure = t.procedure
  .use(withLogging)
  .use(withRateLimit)
  .use(isAuthenticated)
  .use(withWorkspace)
  .use(withWorkspaceRlsContext)
  .use(enforceTrialAccess);

// Stricter rate limit for AI/email endpoints (20 req/min)
export const aiRateLimitedProcedure = t.procedure
  .use(withLogging)
  .use(
    t.middleware(async ({ ctx, next }) => {
      const key = ctx.user?.id ?? "anonymous";
      await enforceRateLimit({ key: `ai:${key}`, limit: 20, windowMs: 60_000 });
      return next();
    }),
  )
  .use(isAuthenticated)
  .use(withWorkspace)
  .use(withWorkspaceRlsContext)
  .use(enforceTrialAccess);

const hasRole = (...roles: string[]) =>
  t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    if (!roles.includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });

export const adminProcedure = t.procedure
  .use(withLogging)
  .use(withRateLimit)
  .use(isAuthenticated)
  .use(withWorkspace)
  .use(withWorkspaceRlsContext)
  .use(enforceTrialAccess)
  .use(hasRole("OWNER", "ADMIN"));

export const ownerProcedure = t.procedure
  .use(withLogging)
  .use(withRateLimit)
  .use(isAuthenticated)
  .use(withWorkspace)
  .use(withWorkspaceRlsContext)
  .use(enforceTrialAccess)
  .use(hasRole("OWNER"));
