import { type PrismaClient } from "@digitify/db";
import { z } from "zod";
import { router, protectedProcedure, ownerProcedure, publicRateLimitedProcedure } from "../trpc";
import { getSettingBoolean, getSettingString, settingsRowsToMap } from "../lib/settings";
import { loadWorkspaceSettingRows, workspaceScopeFromUser } from "../lib/workspace-settings";
import { ANALYTICS_SETTINGS_KEYS } from "../lib/settings-bundle-keys";
import {
  resolveMarketingWorkspaceOwnerId,
  resolveUserIdFromPublicTenantToken,
} from "../lib/public-tenant";
import { resolveWorkspaceOwnerId } from "../lib/workspace";
import {
  readAnalyticsTrackingCache,
  writeAnalyticsTrackingCache,
} from "../lib/analytics-tracking-cache";

async function isAnalyticsEnabled(db: Parameters<typeof loadWorkspaceSettingRows>[0], workspaceId: string) {
  const rows = await loadWorkspaceSettingRows(db, { workspaceId, memberId: workspaceId }, [...ANALYTICS_SETTINGS_KEYS]);
  const settings = settingsRowsToMap(rows);
  return getSettingBoolean(settings, "analytics.enabled", false);
}

async function shouldTrackAppUsage(db: Parameters<typeof loadWorkspaceSettingRows>[0], workspaceId: string) {
  const cached = readAnalyticsTrackingCache(workspaceId);
  if (cached !== null) return cached;

  const rows = await loadWorkspaceSettingRows(db, { workspaceId, memberId: workspaceId }, [...ANALYTICS_SETTINGS_KEYS]);
  const settings = settingsRowsToMap(rows);
  const enabled =
    getSettingBoolean(settings, "analytics.enabled", false)
    && getSettingBoolean(settings, "analytics.track_app_usage", true);
  writeAnalyticsTrackingCache(workspaceId, enabled);
  return enabled;
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

async function resolveWorkspaceIdFromTenant(db: PrismaClient, rawTenant: string) {
  const ownerId = await resolveUserIdFromPublicTenantToken(db, rawTenant);
  if (!ownerId) return null;

  const workspace = await db.workspace.findUnique({
    where: { id: ownerId },
    select: { id: true },
  });
  if (workspace) return ownerId;

  return resolveWorkspaceOwnerId(db, ownerId);
}

type AnalyticsScript = { type: string; content: string };

function buildAnalyticsScripts(settings: Record<string, unknown>) {
  const scripts: AnalyticsScript[] = [];
  const ga4 = getSettingString(settings, "analytics.ga4_measurement_id").trim();
  const gtm = getSettingString(settings, "analytics.gtm_container_id").trim();
  const plausible = getSettingString(settings, "analytics.plausible_domain").trim();
  const metaPixel = getSettingString(settings, "analytics.meta_pixel_id").trim();
  const linkedin = getSettingString(settings, "analytics.linkedin_partner_id").trim();
  const custom = getSettingString(settings, "analytics.custom_head_script").trim();

  if (gtm) {
    scripts.push({
      type: "gtm",
      content: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`,
    });
  } else if (ga4) {
    scripts.push({
      type: "ga4",
      content: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4}');`,
    });
  }

  if (plausible) {
    scripts.push({ type: "plausible", content: "https://plausible.io/js/script.js" });
  }

  if (metaPixel) {
    scripts.push({
      type: "meta_pixel",
      content: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixel}');fbq('track','PageView');`,
    });
  }

  if (linkedin) {
    scripts.push({
      type: "linkedin",
      content: `_linkedin_partner_id="${linkedin}";window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push(_linkedin_partner_id);`,
    });
  }

  if (custom) {
    scripts.push({ type: "custom", content: custom });
  }

  return {
    scripts,
    plausibleDomain: plausible || null,
    ga4Id: ga4 || null,
    linkedinPartnerId: linkedin || null,
    respectDnt: getSettingBoolean(settings, "analytics.respect_dnt", true),
  };
}

async function loadWorkspaceAnalyticsScripts(db: PrismaClient, workspaceId: string) {
  const rows = await loadWorkspaceSettingRows(
    db,
    { workspaceId, memberId: workspaceId },
    [...ANALYTICS_SETTINGS_KEYS],
  );
  const settings = settingsRowsToMap(rows);
  if (!getSettingBoolean(settings, "analytics.enabled", false)) {
    return {
      enabled: false,
      scripts: [] as AnalyticsScript[],
      plausibleDomain: null,
      ga4Id: null,
      linkedinPartnerId: null,
      respectDnt: getSettingBoolean(settings, "analytics.respect_dnt", true),
    };
  }

  const built = buildAnalyticsScripts(settings);
  return {
    enabled: built.scripts.length > 0,
    ...built,
  };
}

export const analyticsRouter = router({
  getTrackingConfig: protectedProcedure.query(async ({ ctx }) => {
    const workspaceId = ctx.user.workspaceId;
    if (!workspaceId) {
      return { trackAppUsage: false, respectDnt: true };
    }

    const rows = await loadWorkspaceSettingRows(
      ctx.db,
      { workspaceId, memberId: workspaceId },
      ["analytics.enabled", "analytics.track_app_usage", "analytics.respect_dnt"],
    );
    const settings = settingsRowsToMap(rows);

    return {
      trackAppUsage:
        getSettingBoolean(settings, "analytics.enabled", false)
        && getSettingBoolean(settings, "analytics.track_app_usage", true),
      respectDnt: getSettingBoolean(settings, "analytics.respect_dnt", true),
    };
  }),

  trackPageView: protectedProcedure
    .input(
      z.object({
        path: z.string().max(500),
        name: z.string().max(200).optional(),
        sessionId: z.string().max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId;
      if (!workspaceId) return { tracked: false };

      const enabled = await shouldTrackAppUsage(ctx.db, workspaceId);
      if (!enabled) return { tracked: false };

      await ctx.db.workspaceAnalyticsEvent.create({
        data: {
          workspaceId,
          category: "page_view",
          name: input.name?.trim() || input.path,
          path: input.path,
          userId: ctx.user.id,
          sessionId: input.sessionId,
        },
      });

      return { tracked: true };
    }),

  trackWidgetView: publicRateLimitedProcedure
    .input(
      z
        .object({
          tenant: z.string().min(1).optional(),
          workspaceId: z.string().min(1).optional(),
          widget: z.string().max(80),
          path: z.string().max(500).optional(),
          sessionId: z.string().max(120).optional(),
        })
        .refine((input) => Boolean(input.tenant || input.workspaceId), {
          message: "tenant of workspaceId is verplicht",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = input.workspaceId
        || (input.tenant ? await resolveWorkspaceIdFromTenant(ctx.db, input.tenant) : null);
      if (!workspaceId) return { tracked: false };

      const enabled = await isAnalyticsEnabled(ctx.db, workspaceId);
      if (!enabled) return { tracked: false };

      const rows = await loadWorkspaceSettingRows(
        ctx.db,
        { workspaceId, memberId: workspaceId },
        [...ANALYTICS_SETTINGS_KEYS],
      );
      const settings = settingsRowsToMap(rows);
      if (!getSettingBoolean(settings, "analytics.track_widget_views", true)) {
        return { tracked: false };
      }

      await ctx.db.workspaceAnalyticsEvent.create({
        data: {
          workspaceId,
          category: "widget_view",
          name: input.widget,
          path: input.path,
          sessionId: input.sessionId,
        },
      });

      return { tracked: true };
    }),

  getSummary: ownerProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(7) }).optional())
    .query(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId!;
      const since = daysAgo(input?.days ?? 7);

      const eventWhere = { workspaceId, createdAt: { gte: since } };

      const [
        pageViewCount,
        widgetViewCount,
        recentEvents,
        pathGroups,
        userGroups,
        authVisitorGroups,
        anonSessionGroups,
        activityCount,
        users,
      ] = await Promise.all([
        ctx.db.workspaceAnalyticsEvent.count({
          where: { ...eventWhere, category: "page_view" },
        }),
        ctx.db.workspaceAnalyticsEvent.count({
          where: { ...eventWhere, category: "widget_view" },
        }),
        ctx.db.workspaceAnalyticsEvent.findMany({
          where: eventWhere,
          orderBy: { createdAt: "desc" },
          take: 25,
          select: {
            id: true,
            category: true,
            name: true,
            path: true,
            userId: true,
            createdAt: true,
          },
        }),
        ctx.db.workspaceAnalyticsEvent.groupBy({
          by: ["path"],
          where: { ...eventWhere, category: "page_view", path: { not: null } },
          _count: { path: true },
          orderBy: { _count: { path: "desc" } },
          take: 10,
        }),
        ctx.db.workspaceAnalyticsEvent.groupBy({
          by: ["userId"],
          where: { ...eventWhere, category: "page_view", userId: { not: null } },
          _count: { userId: true },
          orderBy: { _count: { userId: "desc" } },
          take: 8,
        }),
        ctx.db.workspaceAnalyticsEvent.groupBy({
          by: ["userId"],
          where: { ...eventWhere, userId: { not: null } },
        }),
        ctx.db.workspaceAnalyticsEvent.groupBy({
          by: ["sessionId"],
          where: { ...eventWhere, userId: null, sessionId: { not: null } },
        }),
        ctx.db.workspaceMembership
          .findMany({ where: { workspaceId }, select: { userId: true } })
          .then((memberships) => {
            const memberIds = memberships.map((membership) => membership.userId);
            if (memberIds.length === 0) return 0;
            return ctx.db.activity.count({
              where: { userId: { in: memberIds }, createdAt: { gte: since } },
            });
          }),
        ctx.db.workspaceMembership
          .findMany({ where: { workspaceId }, select: { userId: true } })
          .then((memberships) =>
            ctx.db.user.findMany({
              where: { id: { in: memberships.map((membership) => membership.userId) } },
              select: { id: true, name: true, email: true, role: true },
            }),
          ),
      ]);

      const uniqueVisitors = authVisitorGroups.length + anonSessionGroups.length;

      const topPaths = pathGroups.map((group) => ({
        path: group.path || "/",
        count: group._count.path,
      }));

      const topUsers = userGroups.map((group) => {
        const userId = group.userId!;
        const user = users.find((entry) => entry.id === userId);
        return {
          userId,
          count: group._count.userId,
          name: user?.name || user?.email || "Onbekend",
          role: user?.role ?? "MEMBER",
        };
      });

      return {
        days: input?.days ?? 7,
        totals: {
          pageViews: pageViewCount,
          widgetViews: widgetViewCount,
          uniqueVisitors,
          teamActions: activityCount,
        },
        topPaths,
        topUsers,
        recentEvents,
      };
    }),

  purgeOldEvents: ownerProcedure
    .input(z.object({ days: z.number().min(7).max(365).default(90) }).optional())
    .mutation(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId!;
      const rows = await loadWorkspaceSettingRows(
        ctx.db,
        workspaceScopeFromUser(ctx.user),
        ["analytics.retention_days"],
      );
      const settings = settingsRowsToMap(rows);
      const retentionDays = Number.parseInt(
        getSettingString(settings, "analytics.retention_days", String(input?.days ?? 90)),
        10,
      );
      const cutoff = daysAgo(Number.isFinite(retentionDays) ? retentionDays : input?.days ?? 90);

      const result = await ctx.db.workspaceAnalyticsEvent.deleteMany({
        where: { workspaceId, createdAt: { lt: cutoff } },
      });

      return { deleted: result.count, cutoff: cutoff.toISOString() };
    }),

  getWorkspaceScripts: protectedProcedure.query(async ({ ctx }) => {
    const workspaceId = ctx.user.workspaceId;
    if (!workspaceId) {
      return {
        enabled: false,
        scripts: [] as AnalyticsScript[],
        plausibleDomain: null,
        ga4Id: null,
        linkedinPartnerId: null,
        respectDnt: true,
      };
    }
    return loadWorkspaceAnalyticsScripts(ctx.db, workspaceId);
  }),

  getPublicScripts: publicRateLimitedProcedure
    .input(
      z
        .object({
          workspaceId: z.string().optional(),
          tenant: z.string().optional(),
        })
        .optional()
        .nullable(),
    )
    .query(async ({ ctx, input }) => {
      const params = input ?? undefined;
      let workspaceId = params?.workspaceId;
      if (!workspaceId && params?.tenant) {
        workspaceId = (await resolveWorkspaceIdFromTenant(ctx.db, params.tenant)) ?? undefined;
      }
      if (!workspaceId) {
        workspaceId = (await resolveMarketingWorkspaceOwnerId(ctx.db)) ?? undefined;
      }

      if (!workspaceId) {
        return {
          enabled: false,
          scripts: [] as AnalyticsScript[],
          plausibleDomain: null,
          ga4Id: null,
          linkedinPartnerId: null,
          respectDnt: true,
        };
      }

      return loadWorkspaceAnalyticsScripts(ctx.db, workspaceId);
    }),
});
