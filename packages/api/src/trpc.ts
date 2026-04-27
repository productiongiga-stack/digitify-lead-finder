import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { type PrismaClient } from "@digitify/db";
import { patchRequestContext, recordRouteMetric } from "@digitify/db";
import { invalidateDashboardCacheForUser } from "./lib/dashboard-cache";

export type Context = {
  db: PrismaClient;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
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

// --- Rate limiter (in-memory, per user) ---
// Note: resets on server restart and does not sync across multiple instances.
// Replace with Redis (e.g. Upstash) for production multi-instance deployments.
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number) {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Te veel verzoeken. Probeer het over een moment opnieuw.",
    });
  }
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);

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
    console.error(`[tRPC] [${ctx.requestId}] ${type} ${path} — ERROR ${durationMs}ms`, {
      error: result.error?.message,
      code: errorCode,
      userId: ctx.user?.id,
    });
  } else if (durationMs > 2000) {
    console.warn(`[tRPC] [${ctx.requestId}] ${type} ${path} — SLOW ${durationMs}ms`, { userId: ctx.user?.id });
  }

  if (result.ok && type === "mutation" && ctx.user?.id && shouldInvalidateDashboardCache(path)) {
    invalidateDashboardCacheForUser(ctx.user.id);
  }

  return result;
});

// --- General rate limit middleware (100 req/min per user or IP) ---
const withRateLimit = t.middleware(({ ctx, next }) => {
  const key = ctx.user?.id ?? "anonymous";
  checkRateLimit(`general:${key}`, 100, 60_000);
  return next();
});

// --- Auth middleware ---
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
  .use(enforceTrialAccess);

// Stricter rate limit for AI/email endpoints (20 req/min)
export const aiRateLimitedProcedure = t.procedure
  .use(withLogging)
  .use(t.middleware(({ ctx, next }) => {
    const key = ctx.user?.id ?? "anonymous";
    checkRateLimit(`ai:${key}`, 20, 60_000);
    return next();
  }))
  .use(isAuthenticated)
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
  .use(enforceTrialAccess)
  .use(hasRole("OWNER", "ADMIN"));

export const ownerProcedure = t.procedure
  .use(withLogging)
  .use(withRateLimit)
  .use(isAuthenticated)
  .use(enforceTrialAccess)
  .use(hasRole("OWNER"));
