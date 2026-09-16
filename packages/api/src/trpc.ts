import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { formatZodErrorMessage } from "./lib/format-zod-error";
import { type PrismaClient, withWorkspaceRls, isWorkspaceRlsEnabled } from "@digitify/db";
import { patchRequestContext, recordRouteMetric } from "@digitify/db";
import { enforceRateLimit } from "./lib/rate-limit";
import { invalidateDashboardCacheForUser } from "./lib/dashboard-cache";
import { log } from "./lib/logger";
import { resolveWorkspaceContext } from "./lib/workspace-registry";
import { effectiveWorkspaceRole } from "./lib/effective-role";

export { effectiveWorkspaceRole } from "./lib/effective-role";

export type Context = {
  db: PrismaClient;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    /** From JWT when available; finalized in withWorkspace middleware. */
    workspaceId?: string;
    /** Effective role in the active workspace (membership-based). */
    workspaceRole?: string;
    isPersonalWorkspace?: boolean;
    disabledModules?: string[];
    isViewingAs?: boolean;
    actorUserId?: string;
    viewAsSessionId?: string;
    viewAsTargetName?: string | null;
  } | null;
  requestId: string;
  /** Client IP from reverse proxy headers (public endpoints). */
  clientIp?: string;
};

export type AppRole = "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER" | "TRIAL" | "TESTER" | "VIEWER";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    if (error.cause instanceof ZodError) {
      return {
        ...shape,
        message: formatZodErrorMessage(error.cause),
        data: {
          ...shape.data,
          zodError: error.cause.flatten(),
        },
      };
    }
    if (error.code === "INTERNAL_SERVER_ERROR") {
      return {
        ...shape,
        message: "Er ging iets mis. Probeer het opnieuw of neem contact op met je beheerder.",
      };
    }
    return shape;
  },
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
  "task.",
  "invoice.",
  "activity.",
  "inbox.",
  "scoring.",
  "workflow.",
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
    const errorContext = {
      requestId: ctx.requestId,
      path,
      type,
      durationMs,
      code: errorCode,
      userId: ctx.user?.id,
    };
    log.api.error(`tRPC ${type} ${path} failed`, errorContext, result.error);
    if (errorCode === "INTERNAL_SERVER_ERROR" || !errorCode) {
      void import("./lib/sentry")
        .then(({ captureException }) => captureException(result.error, errorContext))
        .catch(() => {});
    }
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

const withPublicRateLimit = t.middleware(async ({ ctx, next }) => {
  const ip = ctx.clientIp ?? ctx.requestId;
  await enforceRateLimit({ key: `public:${ip}`, limit: 60, windowMs: 60_000 });
  return next();
});

const withPasswordResetRateLimit = t.middleware(async ({ ctx, next, path }) => {
  const ip = ctx.clientIp ?? ctx.requestId;
  await enforceRateLimit({
    key: `password-reset:${path}:${ip}`,
    limit: path.endsWith(".confirm") ? 10 : 5,
    windowMs: 60 * 60_000,
    message: "Te veel resetpogingen. Probeer het later opnieuw.",
  });
  return next();
});

/** Unauthenticated endpoints with logging and IP-based rate limiting (60 req/min). */
export const publicRateLimitedProcedure = t.procedure.use(withLogging).use(withPublicRateLimit);
export const passwordResetRateLimitedProcedure = t.procedure.use(withLogging).use(withPasswordResetRateLimit);

// --- General rate limit middleware (100 req/min per user; Redis when REDIS_URL is set) ---
const withRateLimit = t.middleware(async ({ ctx, next }) => {
  const key = ctx.user?.id ?? "anonymous";
  // Local development and browser automation use the in-memory fallback and
  // should not be blocked by a normal multi-page smoke run. Production keeps
  // the stricter per-user limit.
  const localBrowserTest = process.env.DIGITIFY_LOCAL_TEST_MODE === "1";
  const limit = process.env.NODE_ENV === "development" || localBrowserTest ? 1_000 : 100;
  await enforceRateLimit({ key: `general:${key}`, limit, windowMs: 60_000 });
  return next();
});

// --- Auth middleware ---
const withWorkspace = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) return next();

  if (ctx.user.workspaceId) {
    return next({
      ctx: {
        ...ctx,
        user: {
          ...ctx.user,
          workspaceRole: ctx.user.workspaceRole ?? ctx.user.role,
          isPersonalWorkspace:
            ctx.user.isPersonalWorkspace ?? ctx.user.workspaceId === ctx.user.id,
        },
      },
    });
  }

  const workspace = await resolveWorkspaceContext(ctx.db, ctx.user.id);
  return next({
    ctx: {
      ...ctx,
      user: {
        ...ctx.user,
        workspaceId: workspace.workspaceId,
        workspaceRole: workspace.workspaceRole,
        isPersonalWorkspace: workspace.isPersonalWorkspace,
      },
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
    ctx.user.id,
  );
});

const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Niet ingelogd." });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const enforceTrialAccess = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user || effectiveWorkspaceRole(ctx) !== "TRIAL") return next();
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

const ROUTER_MODULES: Record<string, string> = {
  campaign: "campaigns", contact: "contacts", inbox: "contacts", template: "templates", seo: "seo", project: "projects", contract: "contracts",
  crm: "crm", task: "tasks", quote: "quotes", invoice: "invoices", report: "reports",
  audit: "reports", social: "social", metaAds: "metaAds", googleAds: "googleAds",
  media: "creativeStudio", booking: "bookings", domain: "domains", review: "reviews", chatbot: "chatbot", form: "forms", workflow: "automations", file: "files", activity: "activityLog", knowledge: "knowledge", payment: "payments",
};

const enforceModuleAccess = t.middleware(({ ctx, path, next }) => {
  const moduleId = ROUTER_MODULES[path.split(".")[0]!];
  if (moduleId && ctx.user?.disabledModules?.includes(moduleId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Je hebt geen toegang tot deze module." });
  }
  return next();
});

const authenticatedWorkspaceProcedure = t.procedure
  .use(withLogging)
  .use(withRateLimit)
  .use(isAuthenticated)
  .use(withWorkspace)
  .use(enforceModuleAccess);

export const protectedProcedure = authenticatedWorkspaceProcedure
  .use(withWorkspaceRlsContext)
  .use(enforceTrialAccess);

/** VIEWER and TESTER are read-only; TRIAL users keep mutation access during their trial window. */
const READ_ONLY_ROLES = new Set<AppRole>(["VIEWER", "TESTER"]);

const enforceMutationRole = t.middleware(({ ctx, path, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Niet ingelogd." });
  }
  if (READ_ONLY_ROLES.has((ctx.user.workspaceRole ?? ctx.user.role) as AppRole)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Je rol heeft geen rechten om wijzigingen door te voeren.",
    });
  }
  if (ctx.user.isViewingAs && /(^|\.)(send|approve|export|delete|remove|disconnect|publish|payment|billing|invite|updateRole|setUserModule)/i.test(path)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Deze gevoelige actie is niet beschikbaar tijdens het bekijken van een account.",
    });
  }
  return next();
});

export const mutationProcedure = authenticatedWorkspaceProcedure
  .use(enforceMutationRole)
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
  .use(enforceModuleAccess)
  .use(withWorkspaceRlsContext)
  .use(enforceTrialAccess)
  .use(enforceMutationRole);

const hasRole = (...roles: string[]) =>
  t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Niet ingelogd." });
    }
    const role = ctx.user.workspaceRole ?? ctx.user.role;
    if (!roles.includes(role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Onvoldoende rechten." });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });

export const adminProcedure = t.procedure
  .use(withLogging)
  .use(withRateLimit)
  .use(isAuthenticated)
  .use(withWorkspace)
  .use(enforceModuleAccess)
  .use(withWorkspaceRlsContext)
  .use(enforceTrialAccess)
  .use(hasRole("OWNER", "ADMIN"));

const enforceWorkspaceOwnerAccess = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Niet ingelogd." });
  }
  const workspaceId = ctx.user.workspaceId ?? ctx.user.id;
  if (ctx.user.isPersonalWorkspace || workspaceId === ctx.user.id) {
    return next({ ctx: { ...ctx, user: { ...ctx.user, workspaceId } } });
  }
  if ((ctx.user.workspaceRole ?? ctx.user.role) === "OWNER") {
    return next({ ctx: { ...ctx, user: { ...ctx.user, workspaceId } } });
  }
  const workspace = await ctx.db.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerUserId: true },
  });
  if (workspace?.ownerUserId === ctx.user.id) {
    return next({ ctx: { ...ctx, user: { ...ctx.user, workspaceId } } });
  }
  throw new TRPCError({ code: "FORBIDDEN", message: "Onvoldoende rechten." });
});

export const ownerProcedure = t.procedure
  .use(withLogging)
  .use(withRateLimit)
  .use(isAuthenticated)
  .use(withWorkspace)
  .use(enforceModuleAccess)
  .use(withWorkspaceRlsContext)
  .use(enforceTrialAccess)
  .use(enforceWorkspaceOwnerAccess);

/** Owner-level settings that must never be changed while viewing another account. */
export const sensitiveOwnerProcedure = ownerProcedure.use(
  t.middleware(({ ctx, next }) => {
    if (ctx.user?.isViewingAs) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Deze gevoelige instelling is niet beschikbaar tijdens het bekijken van een account.",
      });
    }
    return next();
  }),
);
