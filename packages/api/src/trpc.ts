import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { type PrismaClient } from "@digitify/db";

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

// --- Logging middleware ---
const withLogging = t.middleware(async ({ ctx, path, type, next }) => {
  const start = Date.now();
  const result = await next();
  const durationMs = Date.now() - start;

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

export const protectedProcedure = t.procedure
  .use(withLogging)
  .use(withRateLimit)
  .use(isAuthenticated);

// Stricter rate limit for AI/email endpoints (20 req/min)
export const aiRateLimitedProcedure = t.procedure
  .use(withLogging)
  .use(t.middleware(({ ctx, next }) => {
    const key = ctx.user?.id ?? "anonymous";
    checkRateLimit(`ai:${key}`, 20, 60_000);
    return next();
  }))
  .use(isAuthenticated);

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
  .use(hasRole("OWNER", "ADMIN"));
