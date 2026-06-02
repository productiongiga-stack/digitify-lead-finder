import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@digitify/db";
import { OpenClawClient } from "@digitify/openclaw";
import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../trpc";
import { loadAiProviderConfig } from "../lib/ai-provider-config";
import { upsertMetaSettings, workspaceScopeFromAuthenticatedUser } from "../lib/social-meta";
import {
  defaultTargeting,
  getMetaCampaignDetails,
  getMetaCampaign,
  getMetaInsights,
  listMetaAdAccounts,
  listMetaCampaigns,
  loadMetaAdsWorkspaceConfig,
  MetaAdsPushPartialError,
  MetaInsightLevel,
  normalizeAdAccountId,
  pushPausedMetaAdPlan,
  resolveConfiguredMarketingScopes,
  scoreMetaAdDraft,
  syncMetaCampaigns,
  updateMetaCampaignStatus,
  validateBudgetGuard,
  META_ADS_REQUIRED_SCOPES,
} from "../lib/meta-ads";

const PLAN_STATUS = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "PUSHING", "PUSHED_PAUSED", "FAILED", "CANCELLED"] as const;
const OBJECTIVES = [
  "OUTCOME_TRAFFIC",
  "OUTCOME_LEADS",
  "OUTCOME_SALES",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_AWARENESS",
  "LINK_CLICKS",
  "LEAD_GENERATION",
] as const;
const INSIGHT_LEVELS = ["campaign", "adset", "ad"] as const;
const planStatusEnum = z.enum(PLAN_STATUS);
const objectiveEnum = z.enum(OBJECTIVES);
const insightLevelEnum = z.enum(INSIGHT_LEVELS);

const jsonRecord = z.record(z.any());

const draftInputSchema = z.object({
  name: z.string().min(2).max(160),
  objective: objectiveEnum.default("OUTCOME_TRAFFIC"),
  dailyBudgetCents: z.number().int().min(100).optional().nullable(),
  lifetimeBudgetCents: z.number().int().min(100).optional().nullable(),
  currency: z.string().min(3).max(3).default("EUR"),
  startTime: z.coerce.date().optional().nullable(),
  endTime: z.coerce.date().optional().nullable(),
  targeting: jsonRecord.optional().nullable(),
  creatives: jsonRecord.optional().nullable(),
});
const scoreInputSchema = draftInputSchema.partial().extend({
  objective: objectiveEnum.default("OUTCOME_TRAFFIC"),
  name: z.string().min(1).default("Conceptcampagne"),
});

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function ensureWorkspaceAccess(row: { createdById: string }, workspaceId: string) {
  if (row.createdById !== workspaceId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Geen toegang tot dit Meta Ads plan." });
  }
}

async function createMetaAdsActivity(
  db: PrismaClient,
  input: { userId: string; type: string; title: string; metadata?: Record<string, unknown> },
) {
  await (db as any).activity
    .create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        metadata: input.metadata || {},
      },
    })
    .catch(() => null);
}

async function renderAdSuggestion(
  db: PrismaClient,
  workspaceId: string,
  input: { product: string; audience?: string; tone?: string },
) {
  const fallback = {
    name: `${input.product.trim()} campagne`,
    objective: "OUTCOME_LEADS",
    primaryText: `Ontdek hoe ${input.product.trim()} je bedrijf helpt groeien. Vraag vandaag nog meer info aan.`,
    headline: `Meer resultaat met ${input.product.trim()}`,
    description: "Veilig voorbereid als gepauzeerde Meta-campagne.",
    ctaType: "LEARN_MORE",
    ctaLabel: "Meer informatie",
    imageBrief: "Gebruik een heldere brand visual met duidelijk productvoordeel en CTA.",
    targeting: {
      geo_locations: { countries: ["BE"] },
      age_min: 24,
      age_max: 60,
      publisher_platforms: ["facebook", "instagram"],
      facebook_positions: ["feed"],
      instagram_positions: ["stream", "story"],
      targeting_automation: { advantage_audience: 0 },
      adsets: [
        {
          name: "Belgie breed",
          geo_locations: { countries: ["BE"] },
          age_min: 24,
          age_max: 60,
          publisher_platforms: ["facebook", "instagram"],
          facebook_positions: ["feed"],
          instagram_positions: ["stream", "story"],
          interestSignals: ["Leadgeneratie", "Digitalisering", "KMO-groei"],
        },
      ],
    },
  };

  const { provider, model, apiKey } = await loadAiProviderConfig(db, workspaceId);
  if (!apiKey) return { ...fallback, provider: "fallback", model: "none" };

  const client = new OpenClawClient({ provider, model, apiKey, maxTokens: 650 });
  const response = await client.chat(
    [
      {
        role: "user",
        content:
          `Maak een compacte Meta Ads draft in JSON voor een Belgische KMO-campagne. ` +
          `Gebruik velden name, objective, primaryText, headline, description, ctaType, ctaLabel, imageBrief, targeting. ` +
          `targeting mag geo_locations, age_min, age_max, publisher_platforms, facebook_positions, instagram_positions en adsets bevatten. ` +
          `Elke adset mag name, geo_locations, age_min, age_max, publisher_platforms, facebook_positions, instagram_positions en interestSignals bevatten. ` +
          `Geen markdown. Product/dienst: ${input.product}. Doelgroep: ${input.audience || "lokale ondernemers"}. Tone: ${input.tone || "professioneel en helder"}.`,
      },
    ],
    {
      currentPage: "/meta-ads",
      settings: { aggressiveness: "balanced", tone: input.tone || "professioneel", language: "nl", companyName: "Digitify" },
    },
  );

  try {
    const parsed = JSON.parse(response || "{}");
    const parsedTargeting = asRecord(parsed.targeting);
    const normalizedTargeting = defaultTargeting(parsedTargeting);
    return {
      ...fallback,
      ...parsed,
      targeting: {
        ...normalizedTargeting,
        adsets: Array.isArray(parsedTargeting.adsets) && parsedTargeting.adsets.length ? parsedTargeting.adsets : fallback.targeting.adsets,
      },
      provider,
      model,
    };
  } catch {
    return { ...fallback, provider, model };
  }
}

async function renderVariantSuggestion(
  db: PrismaClient,
  workspaceId: string,
  input: { product: string; audience?: string; tone?: string; angle?: string; landingUrl?: string },
) {
  const fallback = {
    adName: `${input.product.trim()} variant`,
    primaryText: `Ontdek hoe ${input.product.trim()} jouw team sneller resultaat geeft. Vraag vandaag nog meer info aan.`,
    headline: `Meer resultaat met ${input.product.trim()}`,
    description: "Variant voor Meta A/B testing.",
    ctaType: "LEARN_MORE",
    ctaLabel: "Meer informatie",
    linkUrl: input.landingUrl || "https://leads.digitify.be",
    publishAsset: "feed",
  };

  const { provider, model, apiKey } = await loadAiProviderConfig(db, workspaceId);
  if (!apiKey) return { ...fallback, provider: "fallback", model: "none" };

  const client = new OpenClawClient({ provider, model, apiKey, maxTokens: 500 });
  const response = await client.chat(
    [
      {
        role: "user",
        content:
          `Maak een Meta creative variant in JSON met velden adName, primaryText, headline, description, ctaType, ctaLabel, linkUrl, publishAsset. ` +
          `Geen markdown. Product/dienst: ${input.product}. Doelgroep: ${input.audience || "Belgische ondernemers"}. ` +
          `Tone: ${input.tone || "professioneel"}. Invalshoek: ${input.angle || "sterke leadgeneratie en duidelijk voordeel"}.`,
      },
    ],
    {
      currentPage: "/meta-ads",
      settings: { aggressiveness: "balanced", tone: input.tone || "professioneel", language: "nl", companyName: "Digitify" },
    },
  );

  try {
    return { ...fallback, ...JSON.parse(response || "{}"), provider, model };
  } catch {
    return { ...fallback, provider, model };
  }
}

async function pushPlanToMeta(ctx: { db: PrismaClient; user: NonNullable<Parameters<typeof workspaceScopeFromAuthenticatedUser>[0]> }, id: string) {
  const adsDb = ctx.db as any;
  const plan = await adsDb.metaAdPlan.findUnique({ where: { id } });
  if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Meta Ads draft niet gevonden." });
  ensureWorkspaceAccess(plan, ctx.user.workspaceId!);
  if (!["APPROVED", "FAILED"].includes(plan.status)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Alleen approved/failed drafts kunnen naar Meta gepusht worden." });
  }

  const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
  const config = await loadMetaAdsWorkspaceConfig(ctx.db, scope);
  if (!config.autoadsEnabled) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Meta Ads module is nog niet ingeschakeld voor deze workspace." });
  }
  validateBudgetGuard(plan, config.maxDailyBudgetCents);

  await adsDb.metaAdPlan.update({ where: { id }, data: { status: "PUSHING", lastError: null } });

  try {
    const externalIds = await pushPausedMetaAdPlan({ config, plan });
    const updated = await adsDb.metaAdPlan.update({
      where: { id },
      data: {
        status: "PUSHED_PAUSED",
        externalIds,
        pushedAt: new Date(),
        lastError: null,
      },
    });

    await createMetaAdsActivity(ctx.db, {
      userId: ctx.user.id,
      type: "META_AD_PUSHED_PAUSED",
      title: "Meta campagne gepauzeerd aangemaakt",
      metadata: { metaAdPlanId: id, externalIds },
    });

    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende Meta Ads fout";
    const partialExternalIds = error instanceof MetaAdsPushPartialError ? error.externalIds : undefined;
    await createMetaAdsActivity(ctx.db, {
      userId: ctx.user.id,
      type: "META_AD_FAILED",
      title: "Meta Ads push mislukt",
      metadata: { metaAdPlanId: id, error: message, partialExternalIds: partialExternalIds || null },
    });
    const updated = await adsDb.metaAdPlan.update({
      where: { id },
      data: {
        status: "FAILED",
        retryCount: Number(plan.retryCount || 0) + 1,
        lastError: message,
        externalIds: partialExternalIds ?? undefined,
      },
    });
    return updated;
  }
}

export const metaAdsRouter = router({
  connectionStatus: protectedProcedure.query(async ({ ctx }) => {
    const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
    const config = await loadMetaAdsWorkspaceConfig(ctx.db, scope);
    const selected = config.adAccountId
      ? await (ctx.db as any).metaAdAccount.findFirst({
          where: { createdById: ctx.user.workspaceId!, externalAccountId: normalizeAdAccountId(config.adAccountId) },
        }).catch(() => null)
      : null;

    return {
      hasAppCredentials: Boolean(config.appId && config.appSecret),
      connected: Boolean(config.accessToken),
      socialConnected: Boolean(config.pageId && config.pageAccessToken),
      selectedAdAccountId: config.adAccountId || null,
      selectedAdAccountName: selected?.name || null,
      businessId: config.businessId || null,
      autoadsEnabled: config.autoadsEnabled,
      defaultCurrency: config.defaultCurrency,
      maxDailyBudgetCents: config.maxDailyBudgetCents,
      requiredScopes: META_ADS_REQUIRED_SCOPES.slice(),
      configuredMarketingScopes: resolveConfiguredMarketingScopes(),
      missingConfiguredScopes: META_ADS_REQUIRED_SCOPES.filter((scope) => !resolveConfiguredMarketingScopes().includes(scope)),
      adsScopesEnabled: resolveConfiguredMarketingScopes().length === META_ADS_REQUIRED_SCOPES.length,
      oauthIncludeAdsEnv: process.env.META_OAUTH_INCLUDE_ADS?.trim() || null,
      missingOperationalRequirements: [
        !config.accessToken ? "META_SCOPE_MISSING" : null,
        !config.pageId ? "META_PAGE_MISSING" : null,
        !config.adAccountId ? "META_ACCOUNT_NOT_SELECTED" : null,
        resolveConfiguredMarketingScopes().length !== META_ADS_REQUIRED_SCOPES.length ? "META_SCOPE_MISSING" : null,
      ].filter(Boolean),
    };
  }),

  listAdAccounts: adminProcedure.query(async ({ ctx }) => {
    const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
    const config = await loadMetaAdsWorkspaceConfig(ctx.db, scope);
    if (!config.accessToken) throw new TRPCError({ code: "BAD_REQUEST", message: "Koppel Meta eerst via Integraties." });
    return listMetaAdAccounts(config.accessToken);
  }),

  selectAdAccount: adminProcedure
    .input(
      z.object({
        adAccountId: z.string().min(3),
        name: z.string().min(1).max(160).optional(),
        currency: z.string().min(3).max(3).optional(),
        timezoneName: z.string().optional(),
        businessId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const accountId = normalizeAdAccountId(input.adAccountId);
      const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
      await upsertMetaSettings(ctx.db, scope, [
        { key: "ads.meta_ad_account_id", value: accountId },
        { key: "ads.meta_business_id", value: input.businessId || "" },
      ]);
      await (ctx.db as any).metaAdAccount.updateMany({ where: { createdById: ctx.user.workspaceId! }, data: { isSelected: false } });
      const row = await (ctx.db as any).metaAdAccount.upsert({
        where: { createdById_externalAccountId: { createdById: ctx.user.workspaceId!, externalAccountId: accountId } },
        update: {
          name: input.name || accountId,
          currency: input.currency || "EUR",
          timezoneName: input.timezoneName || null,
          businessId: input.businessId || null,
          isSelected: true,
          lastSyncedAt: new Date(),
        },
        create: {
          createdById: ctx.user.workspaceId!,
          externalAccountId: accountId,
          name: input.name || accountId,
          currency: input.currency || "EUR",
          timezoneName: input.timezoneName || null,
          businessId: input.businessId || null,
          isSelected: true,
          lastSyncedAt: new Date(),
        },
      });
      return row;
    }),

  setAutoadsEnabled: adminProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
      await upsertMetaSettings(ctx.db, scope, [{ key: "ads.autoads_enabled", value: String(input.enabled) }]);
      return { enabled: input.enabled };
    }),

  listCampaigns: protectedProcedure.query(async ({ ctx }) => {
    const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
    const config = await loadMetaAdsWorkspaceConfig(ctx.db, scope);
    if (!config.accessToken || !config.adAccountId) return [];
    return listMetaCampaigns({ adAccountId: config.adAccountId, accessToken: config.accessToken });
  }),

  syncMetaCampaigns: adminProcedure.mutation(async ({ ctx }) => {
    const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
    const config = await loadMetaAdsWorkspaceConfig(ctx.db, scope);
    if (!config.accessToken || !config.adAccountId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Meta Ad Account of access token ontbreekt." });
    }
    const result = await syncMetaCampaigns({ adAccountId: config.adAccountId, accessToken: config.accessToken });
    await (ctx.db as any).metaAdAccount.updateMany({
      where: { createdById: ctx.user.workspaceId!, externalAccountId: normalizeAdAccountId(config.adAccountId) },
      data: { lastSyncedAt: new Date(result.syncedAt) },
    }).catch(() => null);

    const plans = await (ctx.db as any).metaAdPlan.findMany({
      where: { createdById: ctx.user.workspaceId!, status: { in: ["APPROVED", "PUSHED_PAUSED", "FAILED"] } },
      take: 100,
    }).catch(() => []);

    for (const row of plans) {
      const externalIds = asRecord(row.externalIds);
      const campaignId = String(externalIds.campaignId || "");
      if (!campaignId) continue;
      const remote = (result.campaigns as any[]).find((item) => String(item.id || "") === campaignId);
      if (!remote) continue;
      await (ctx.db as any).metaAdPlan.update({
        where: { id: row.id },
        data: {
          externalIds: {
            ...externalIds,
            syncedAt: result.syncedAt,
            metaState: {
              configuredStatus: remote.configured_status || remote.status || null,
              effectiveStatus: remote.effective_status || remote.status || null,
            },
          },
        },
      }).catch(() => null);
    }

    return result;
  }),

  getCampaign: protectedProcedure.input(z.object({ campaignId: z.string().min(1) })).query(async ({ ctx, input }) => {
    const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
    const config = await loadMetaAdsWorkspaceConfig(ctx.db, scope);
    if (!config.accessToken) throw new TRPCError({ code: "BAD_REQUEST", message: "Meta is niet gekoppeld." });
    return getMetaCampaign({ campaignId: input.campaignId, accessToken: config.accessToken });
  }),

  getCampaignDetails: protectedProcedure.input(z.object({ campaignId: z.string().min(1) })).query(async ({ ctx, input }) => {
    const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
    const config = await loadMetaAdsWorkspaceConfig(ctx.db, scope);
    if (!config.accessToken) throw new TRPCError({ code: "BAD_REQUEST", message: "Meta is niet gekoppeld." });
    return getMetaCampaignDetails({ campaignId: input.campaignId, accessToken: config.accessToken });
  }),

  getInsights: protectedProcedure
    .input(z.object({ datePreset: z.string().default("last_30d") }).optional())
    .query(async ({ ctx, input }) => {
      const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
      const config = await loadMetaAdsWorkspaceConfig(ctx.db, scope);
      if (!config.accessToken || !config.adAccountId) return [];
      return getMetaInsights({ adAccountId: config.adAccountId, accessToken: config.accessToken, datePreset: input?.datePreset, level: "campaign" });
    }),

  listInsights: protectedProcedure
    .input(z.object({ datePreset: z.string().default("last_30d"), level: insightLevelEnum.default("campaign") }).optional())
    .query(async ({ ctx, input }) => {
      const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
      const config = await loadMetaAdsWorkspaceConfig(ctx.db, scope);
      if (!config.accessToken || !config.adAccountId) return [];
      return getMetaInsights({
        adAccountId: config.adAccountId,
        accessToken: config.accessToken,
        datePreset: input?.datePreset,
        level: (input?.level || "campaign") as MetaInsightLevel,
      });
    }),

  listDrafts: protectedProcedure
    .input(z.object({ status: planStatusEnum.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { createdById: ctx.user.workspaceId! };
      if (input?.status) where.status = input.status;
      return (ctx.db as any).metaAdPlan.findMany({ where, orderBy: { updatedAt: "desc" }, take: 100 });
    }),

  getDraftById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const row = await (ctx.db as any).metaAdPlan.findUnique({ where: { id: input.id } });
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Meta Ads draft niet gevonden." });
    ensureWorkspaceAccess(row, ctx.user.workspaceId!);
    return row;
  }),

  createDraft: protectedProcedure.input(draftInputSchema).mutation(async ({ ctx, input }) => {
    const row = await (ctx.db as any).metaAdPlan.create({
      data: {
        createdById: ctx.user.workspaceId!,
        name: input.name.trim(),
        objective: input.objective,
        dailyBudgetCents: input.dailyBudgetCents || null,
        lifetimeBudgetCents: input.lifetimeBudgetCents || null,
        currency: input.currency.toUpperCase(),
        startTime: input.startTime || null,
        endTime: input.endTime || null,
        targeting: input.targeting || {},
        creatives: input.creatives || {},
        status: "DRAFT",
      },
    });
    await createMetaAdsActivity(ctx.db, {
      userId: ctx.user.id,
      type: "META_AD_DRAFT_CREATED",
      title: "Meta Ads draft aangemaakt",
      metadata: { metaAdPlanId: row.id },
    });
    return row;
  }),

  updateDraft: protectedProcedure.input(z.object({ id: z.string() }).merge(draftInputSchema.partial())).mutation(async ({ ctx, input }) => {
    const adsDb = ctx.db as any;
    const row = await adsDb.metaAdPlan.findUnique({ where: { id: input.id } });
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Meta Ads draft niet gevonden." });
    ensureWorkspaceAccess(row, ctx.user.workspaceId!);
    if (!["DRAFT", "FAILED", "CANCELLED"].includes(row.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Alleen drafts, failed of cancelled plannen kunnen aangepast worden." });
    }
    return adsDb.metaAdPlan.update({
      where: { id: input.id },
      data: {
        name: input.name?.trim(),
        objective: input.objective,
        dailyBudgetCents: input.dailyBudgetCents === undefined ? undefined : input.dailyBudgetCents,
        lifetimeBudgetCents: input.lifetimeBudgetCents === undefined ? undefined : input.lifetimeBudgetCents,
        currency: input.currency?.toUpperCase(),
        startTime: input.startTime === undefined ? undefined : input.startTime,
        endTime: input.endTime === undefined ? undefined : input.endTime,
        targeting: input.targeting === undefined ? undefined : input.targeting || {},
        creatives: input.creatives === undefined ? undefined : input.creatives || {},
        status: "DRAFT",
        lastError: null,
      },
    });
  }),

  duplicateDraft: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const adsDb = ctx.db as any;
    const row = await adsDb.metaAdPlan.findUnique({ where: { id: input.id } });
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Meta Ads draft niet gevonden." });
    ensureWorkspaceAccess(row, ctx.user.workspaceId!);
    return adsDb.metaAdPlan.create({
      data: {
        createdById: ctx.user.workspaceId!,
        name: `${row.name} (kopie)`,
        objective: row.objective,
        dailyBudgetCents: row.dailyBudgetCents,
        lifetimeBudgetCents: row.lifetimeBudgetCents,
        currency: row.currency,
        startTime: row.startTime,
        endTime: row.endTime,
        targeting: row.targeting || {},
        creatives: row.creatives || {},
        status: "DRAFT",
        approvedById: null,
        approvedAt: null,
        pushedAt: null,
        externalIds: null,
        retryCount: 0,
        lastError: null,
      },
    });
  }),

  archiveDraft: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const adsDb = ctx.db as any;
    const row = await adsDb.metaAdPlan.findUnique({ where: { id: input.id } });
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Meta Ads draft niet gevonden." });
    ensureWorkspaceAccess(row, ctx.user.workspaceId!);
    if (["PUSHING"].includes(row.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Een draft die nu naar Meta pusht kan niet gearchiveerd worden." });
    }
    return adsDb.metaAdPlan.update({
      where: { id: input.id },
      data: { status: "CANCELLED", lastError: "Gearchiveerd" },
    });
  }),

  generateSuggestion: protectedProcedure
    .input(z.object({ product: z.string().min(2).max(400), audience: z.string().max(400).optional(), tone: z.string().max(80).optional() }))
    .mutation(async ({ ctx, input }) => renderAdSuggestion(ctx.db, ctx.user.workspaceId!, input)),

  generateVariantSuggestion: protectedProcedure
    .input(
      z.object({
        product: z.string().min(2).max(400),
        audience: z.string().max(400).optional(),
        tone: z.string().max(80).optional(),
        angle: z.string().max(200).optional(),
        landingUrl: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => renderVariantSuggestion(ctx.db, ctx.user.workspaceId!, input)),

  scoreDraft: protectedProcedure
    .input(scoreInputSchema)
    .mutation(async ({ input }) => scoreMetaAdDraft(input)),

  submitForApproval: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const adsDb = ctx.db as any;
    const row = await adsDb.metaAdPlan.findUnique({ where: { id: input.id } });
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Meta Ads draft niet gevonden." });
    ensureWorkspaceAccess(row, ctx.user.workspaceId!);
    if (!["DRAFT", "FAILED", "CANCELLED"].includes(row.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Deze draft kan niet ter goedkeuring worden aangeboden." });
    }
    const updated = await adsDb.metaAdPlan.update({ where: { id: input.id }, data: { status: "PENDING_APPROVAL", lastError: null } });
    await createMetaAdsActivity(ctx.db, {
      userId: ctx.user.id,
      type: "META_AD_SUBMITTED",
      title: "Meta Ads draft wacht op goedkeuring",
      metadata: { metaAdPlanId: input.id },
    });
    return updated;
  }),

  approveDraft: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const adsDb = ctx.db as any;
    const row = await adsDb.metaAdPlan.findUnique({ where: { id: input.id } });
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Meta Ads draft niet gevonden." });
    ensureWorkspaceAccess(row, ctx.user.workspaceId!);
    if (!["PENDING_APPROVAL", "DRAFT", "FAILED"].includes(row.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Deze draft kan niet goedgekeurd worden." });
    }
    const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
    const config = await loadMetaAdsWorkspaceConfig(ctx.db, scope);
    validateBudgetGuard(row, config.maxDailyBudgetCents);
    const updated = await adsDb.metaAdPlan.update({
      where: { id: input.id },
      data: { status: "APPROVED", approvedById: ctx.user.id, approvedAt: new Date(), lastError: null, retryCount: 0 },
    });
    await createMetaAdsActivity(ctx.db, {
      userId: ctx.user.id,
      type: "META_AD_APPROVED",
      title: "Meta Ads draft goedgekeurd",
      metadata: { metaAdPlanId: input.id },
    });
    return updated;
  }),

  rejectDraft: adminProcedure
    .input(z.object({ id: z.string(), reason: z.string().max(1000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const adsDb = ctx.db as any;
      const row = await adsDb.metaAdPlan.findUnique({ where: { id: input.id } });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Meta Ads draft niet gevonden." });
      ensureWorkspaceAccess(row, ctx.user.workspaceId!);
      const reason = input.reason?.trim();
      const updated = await adsDb.metaAdPlan.update({
        where: { id: input.id },
        data: { status: "DRAFT", approvedById: null, approvedAt: null, lastError: reason ? `Afgekeurd: ${reason}` : "Afgekeurd" },
      });
      await createMetaAdsActivity(ctx.db, {
        userId: ctx.user.id,
        type: "META_AD_REJECTED",
        title: "Meta Ads draft afgekeurd",
        metadata: { metaAdPlanId: input.id, reason: reason || null },
      });
      return updated;
    }),

  pauseInMeta: adminProcedure.input(z.object({ campaignId: z.string().min(1), draftId: z.string().optional() })).mutation(async ({ ctx, input }) => {
    const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
    const config = await loadMetaAdsWorkspaceConfig(ctx.db, scope);
    if (!config.accessToken) throw new TRPCError({ code: "BAD_REQUEST", message: "Meta is niet gekoppeld." });
    await updateMetaCampaignStatus({ campaignId: input.campaignId, accessToken: config.accessToken, status: "PAUSED" });
    if (input.draftId) {
      const row = await (ctx.db as any).metaAdPlan.findUnique({ where: { id: input.draftId } });
      if (row) {
        ensureWorkspaceAccess(row, ctx.user.workspaceId!);
        const externalIds = asRecord(row.externalIds);
        await (ctx.db as any).metaAdPlan.update({
          where: { id: input.draftId },
          data: {
            externalIds: {
              ...externalIds,
              syncedAt: new Date().toISOString(),
              metaState: { configuredStatus: "PAUSED", effectiveStatus: "PAUSED" },
            },
          },
        });
      }
    }
    return { ok: true };
  }),

  resumeInMeta: adminProcedure.input(z.object({ campaignId: z.string().min(1), draftId: z.string().optional() })).mutation(async ({ ctx, input }) => {
    const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
    const config = await loadMetaAdsWorkspaceConfig(ctx.db, scope);
    if (!config.accessToken) throw new TRPCError({ code: "BAD_REQUEST", message: "Meta is niet gekoppeld." });
    await updateMetaCampaignStatus({ campaignId: input.campaignId, accessToken: config.accessToken, status: "ACTIVE" });
    if (input.draftId) {
      const row = await (ctx.db as any).metaAdPlan.findUnique({ where: { id: input.draftId } });
      if (row) {
        ensureWorkspaceAccess(row, ctx.user.workspaceId!);
        const externalIds = asRecord(row.externalIds);
        await (ctx.db as any).metaAdPlan.update({
          where: { id: input.draftId },
          data: {
            externalIds: {
              ...externalIds,
              syncedAt: new Date().toISOString(),
              metaState: { configuredStatus: "ACTIVE", effectiveStatus: "ACTIVE" },
            },
          },
        });
      }
    }
    return { ok: true };
  }),

  pushPausedToMeta: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => pushPlanToMeta(ctx as any, input.id)),

  cancelDraft: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const adsDb = ctx.db as any;
    const row = await adsDb.metaAdPlan.findUnique({ where: { id: input.id } });
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Meta Ads draft niet gevonden." });
    ensureWorkspaceAccess(row, ctx.user.workspaceId!);
    if (["PUSHING", "PUSHED_PAUSED"].includes(row.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Een gepushte Meta-campagne kan niet lokaal geannuleerd worden." });
    }
    return adsDb.metaAdPlan.update({ where: { id: input.id }, data: { status: "CANCELLED" } });
  }),

  retryFailed: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => pushPlanToMeta(ctx as any, input.id)),
});
