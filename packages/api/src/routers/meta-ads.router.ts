import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@digitify/db";
import { OpenClawClient } from "@digitify/openclaw";
import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../trpc";
import { loadAiProviderConfig } from "../lib/ai-provider-config";
import { upsertMetaSettings, workspaceScopeFromAuthenticatedUser } from "../lib/social-meta";
import {
  getMetaCampaign,
  getMetaInsights,
  listMetaAdAccounts,
  listMetaCampaigns,
  loadMetaAdsWorkspaceConfig,
  normalizeAdAccountId,
  pushPausedMetaAdPlan,
  resolveConfiguredMarketingScopes,
  validateBudgetGuard,
  META_ADS_REQUIRED_SCOPES,
} from "../lib/meta-ads";

const PLAN_STATUS = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "PUSHING", "PUSHED_PAUSED", "FAILED", "CANCELLED"] as const;
const OBJECTIVES = ["OUTCOME_TRAFFIC", "OUTCOME_LEADS", "LINK_CLICKS", "LEAD_GENERATION"] as const;
const planStatusEnum = z.enum(PLAN_STATUS);
const objectiveEnum = z.enum(OBJECTIVES);

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
    primaryText: `Ontdek hoe ${input.product.trim()} je bedrijf helpt groeien. Vraag vandaag nog meer info aan.`,
    headline: `Meer resultaat met ${input.product.trim()}`,
    description: "Veilig voorbereid als gepauzeerde Meta-campagne.",
    targeting: {
      geo_locations: { countries: ["BE"] },
      age_min: 24,
      age_max: 60,
      publisher_platforms: ["facebook", "instagram"],
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
          `Gebruik velden name, primaryText, headline, description, targeting. ` +
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
    return { ...fallback, ...parsed, provider, model };
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
    await createMetaAdsActivity(ctx.db, {
      userId: ctx.user.id,
      type: "META_AD_FAILED",
      title: "Meta Ads push mislukt",
      metadata: { metaAdPlanId: id, error: message },
    });
    const updated = await adsDb.metaAdPlan.update({
      where: { id },
      data: { status: "FAILED", retryCount: Number(plan.retryCount || 0) + 1, lastError: message },
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

  listCampaigns: protectedProcedure.query(async ({ ctx }) => {
    const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
    const config = await loadMetaAdsWorkspaceConfig(ctx.db, scope);
    if (!config.accessToken || !config.adAccountId) return [];
    return listMetaCampaigns({ adAccountId: config.adAccountId, accessToken: config.accessToken });
  }),

  getCampaign: protectedProcedure.input(z.object({ campaignId: z.string().min(1) })).query(async ({ ctx, input }) => {
    const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
    const config = await loadMetaAdsWorkspaceConfig(ctx.db, scope);
    if (!config.accessToken) throw new TRPCError({ code: "BAD_REQUEST", message: "Meta is niet gekoppeld." });
    return getMetaCampaign({ campaignId: input.campaignId, accessToken: config.accessToken });
  }),

  getInsights: protectedProcedure
    .input(z.object({ datePreset: z.string().default("last_30d") }).optional())
    .query(async ({ ctx, input }) => {
      const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
      const config = await loadMetaAdsWorkspaceConfig(ctx.db, scope);
      if (!config.accessToken || !config.adAccountId) return [];
      return getMetaInsights({ adAccountId: config.adAccountId, accessToken: config.accessToken, datePreset: input?.datePreset });
    }),

  listDrafts: protectedProcedure
    .input(z.object({ status: planStatusEnum.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { createdById: ctx.user.workspaceId! };
      if (input?.status) where.status = input.status;
      return (ctx.db as any).metaAdPlan.findMany({ where, orderBy: { updatedAt: "desc" }, take: 100 });
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

  generateSuggestion: protectedProcedure
    .input(z.object({ product: z.string().min(2).max(400), audience: z.string().max(400).optional(), tone: z.string().max(80).optional() }))
    .mutation(async ({ ctx, input }) => renderAdSuggestion(ctx.db, ctx.user.workspaceId!, input)),

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
