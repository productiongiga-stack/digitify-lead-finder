import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@digitify/db";
import { OpenClawClient } from "@digitify/openclaw";
import { z } from "zod";
import { adminProcedure, protectedProcedure, aiRateLimitedProcedure, router, mutationProcedure } from "../trpc";
import { loadAiProviderConfig } from "../lib/ai-provider-config";
import {
  defaultSearchTargeting,
  getGoogleAdsInsights,
  listGoogleAdCustomers,
  listGoogleCampaigns,
  loadGoogleAdsWorkspaceConfig,
  pushPausedGoogleAdPlan,
  suggestBeneluxGeoTargets,
  validateBudgetGuard,
} from "../lib/google-ads";
import {
  buildAudienceSignalsSystemPrompt,
  buildAudienceSignalsUserPrompt,
  buildSearchKeywordsSystemPrompt,
  buildSearchKeywordsUserPrompt,
  buildGoogleCampaignSystemPrompt,
  buildGoogleCampaignUserPrompt,
  extractJsonFromAiResponse,
  loadGoogleAdsAiContext,
  normalizeAudienceSignalsSuggestion,
  normalizeGoogleCampaignSuggestion,
  normalizeSearchKeywordsSuggestion,
} from "../lib/google-ads-ai";
import {
  normalizeGoogleCustomerId,
  resolveGoogleAdsDeveloperToken,
  upsertGoogleAdsSettings,
} from "../lib/google-ads-oauth";
import { workspaceScopeFromAuthenticatedUser } from "../lib/social-meta";

const PLAN_STATUS = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "PUSHING", "PUSHED_PAUSED", "FAILED", "CANCELLED"] as const;
const CAMPAIGN_TYPES = ["SEARCH", "PERFORMANCE_MAX"] as const;
const planStatusEnum = z.enum(PLAN_STATUS);
const campaignTypeEnum = z.enum(CAMPAIGN_TYPES);

const jsonRecord = z.record(z.any());

const draftInputSchema = z.object({
  name: z.string().min(2).max(160),
  campaignType: campaignTypeEnum.default("SEARCH"),
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
    throw new TRPCError({ code: "FORBIDDEN", message: "Geen toegang tot dit Google Ads plan." });
  }
}

async function createGoogleAdsActivity(
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
  input: { product: string; audience?: string; tone?: string; campaignType?: string },
) {
  const campaignType = input.campaignType === "PERFORMANCE_MAX" ? "PERFORMANCE_MAX" : "SEARCH";
  const fallback = {
    name: `${input.product.trim()} campagne`,
    campaignType,
    creatives: {
      finalUrl: "https://leads.digitify.be",
      headlines: ["Meer kwalitatieve leads", "Digitify lead generation", "Vraag vandaag een demo"],
      descriptions: ["Automatiseer leadgeneratie voor Belgische KMO's.", "Plan, keur goed en publiceer veilig als paused."],
      longHeadlines: [`Ontdek hoe ${input.product.trim()} meer kwalitatieve leads vindt`],
      path1: "offerte",
      path2: "demo",
    },
    targeting: defaultSearchTargeting(undefined),
    keywordBrief: "",
    imageBrief: "",
  };

  const aiContext = await loadGoogleAdsAiContext(db, workspaceId);
  const { provider, model, apiKey } = await loadAiProviderConfig(db, workspaceId);
  if (!apiKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Chatbot AI is niet gekoppeld. Stel een API-sleutel in via Instellingen → Integraties.",
    });
  }

  const client = new OpenClawClient({ provider, model, apiKey, maxTokens: 1000 });
  const response = await client.chat(
    [
      {
        role: "user",
        content: `${buildGoogleCampaignSystemPrompt({
          trainingNotes: aiContext.trainingNotes,
          responseStyle: aiContext.responseStyle,
          companyName: aiContext.companyName,
          campaignType,
        })}\n\n${buildGoogleCampaignUserPrompt({
          product: input.product,
          audience: input.audience,
          tone: input.tone,
          campaignType,
          website: aiContext.website,
        })}`,
      },
    ],
    {
      currentPage: "/google-ads",
      businessContext: aiContext.businessContext,
      settings: {
        aggressiveness: "balanced",
        tone: input.tone || aiContext.responseStyle || "professioneel",
        language: "nl",
        companyName: aiContext.companyName,
      },
    },
  );

  const parsed = extractJsonFromAiResponse(response || "");
  const normalized = normalizeGoogleCampaignSuggestion(parsed, fallback);
  const payload = normalized.payload as typeof fallback & Record<string, unknown>;

  return {
    ...payload,
    targeting: defaultSearchTargeting(payload.targeting ?? fallback.targeting),
    aiUsed: normalized.aiUsed,
    provider,
    model,
  };
}

async function renderAudienceSignalsSuggestion(
  db: PrismaClient,
  workspaceId: string,
  input: { product: string; audience?: string; tone?: string; existingSignals?: string[] },
) {
  const existingSignals = (input.existingSignals || []).map((item) => item.trim()).filter(Boolean).slice(0, 25);
  const aiContext = await loadGoogleAdsAiContext(db, workspaceId);
  const { provider, model, apiKey } = await loadAiProviderConfig(db, workspaceId);
  if (!apiKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Chatbot AI is niet gekoppeld. Stel een API-sleutel in via Instellingen → Integraties.",
    });
  }

  const client = new OpenClawClient({ provider, model, apiKey, maxTokens: 500 });
  const response = await client.chat(
    [
      {
        role: "user",
        content: `${buildAudienceSignalsSystemPrompt({
          trainingNotes: aiContext.trainingNotes,
          responseStyle: aiContext.responseStyle,
          companyName: aiContext.companyName,
        })}\n\n${buildAudienceSignalsUserPrompt({
          product: input.product,
          audience: input.audience,
          tone: input.tone,
          existingSignals,
        })}`,
      },
    ],
    {
      currentPage: "/google-ads",
      businessContext: aiContext.businessContext,
      settings: {
        aggressiveness: "balanced",
        tone: input.tone || aiContext.responseStyle || "professioneel",
        language: "nl",
        companyName: aiContext.companyName,
      },
    },
  );

  const parsed = extractJsonFromAiResponse(response || "");
  const normalized = normalizeAudienceSignalsSuggestion(parsed, existingSignals);
  return {
    audienceSignals: normalized.audienceSignals,
    aiUsed: normalized.aiUsed,
    provider,
    model,
  };
}

async function renderSearchKeywordsSuggestion(
  db: PrismaClient,
  workspaceId: string,
  input: {
    product: string;
    audience?: string;
    tone?: string;
    existingKeywords?: string[];
    existingNegativeKeywords?: string[];
  },
) {
  const existingKeywords = (input.existingKeywords || []).map((item) => item.trim()).filter(Boolean).slice(0, 80);
  const existingNegativeKeywords = (input.existingNegativeKeywords || [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 80);
  const aiContext = await loadGoogleAdsAiContext(db, workspaceId);
  const { provider, model, apiKey } = await loadAiProviderConfig(db, workspaceId);
  if (!apiKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Chatbot AI is niet gekoppeld. Stel een API-sleutel in via Instellingen → Integraties.",
    });
  }

  const client = new OpenClawClient({ provider, model, apiKey, maxTokens: 700 });
  const response = await client.chat(
    [
      {
        role: "user",
        content: `${buildSearchKeywordsSystemPrompt({
          trainingNotes: aiContext.trainingNotes,
          responseStyle: aiContext.responseStyle,
          companyName: aiContext.companyName,
        })}\n\n${buildSearchKeywordsUserPrompt({
          product: input.product,
          audience: input.audience,
          tone: input.tone,
          existingKeywords,
          existingNegativeKeywords,
        })}`,
      },
    ],
    {
      currentPage: "/google-ads",
      businessContext: aiContext.businessContext,
      settings: {
        aggressiveness: "balanced",
        tone: input.tone || aiContext.responseStyle || "professioneel",
        language: "nl",
        companyName: aiContext.companyName,
      },
    },
  );

  const parsed = extractJsonFromAiResponse(response || "");
  const normalized = normalizeSearchKeywordsSuggestion(parsed, existingKeywords, existingNegativeKeywords);
  return {
    keywords: normalized.keywords,
    negativeKeywords: normalized.negativeKeywords,
    adGroupName: normalized.adGroupName,
    aiUsed: normalized.aiUsed,
    provider,
    model,
  };
}

async function pushPlanToGoogle(
  ctx: { db: PrismaClient; user: NonNullable<Parameters<typeof workspaceScopeFromAuthenticatedUser>[0]> },
  id: string,
) {
  const adsDb = ctx.db as any;
  const plan = await adsDb.googleAdPlan.findUnique({ where: { id } });
  if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Google Ads draft niet gevonden." });
  ensureWorkspaceAccess(plan, ctx.user.workspaceId!);
  if (!["APPROVED", "FAILED"].includes(plan.status)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Alleen approved/failed drafts kunnen naar Google gepusht worden." });
  }

  const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
  const config = await loadGoogleAdsWorkspaceConfig(ctx.db, scope);
  if (!config.autoadsEnabled) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Google Ads module is nog niet ingeschakeld voor deze workspace." });
  }
  validateBudgetGuard(plan, config.maxDailyBudgetCents);

  await adsDb.googleAdPlan.update({ where: { id }, data: { status: "PUSHING", lastError: null } });

  try {
    const externalIds = await pushPausedGoogleAdPlan({ config, plan });
    const updated = await adsDb.googleAdPlan.update({
      where: { id },
      data: {
        status: "PUSHED_PAUSED",
        externalIds,
        pushedAt: new Date(),
        lastError: null,
      },
    });

    await createGoogleAdsActivity(ctx.db, {
      userId: ctx.user.id,
      type: "GOOGLE_AD_PUSHED_PAUSED",
      title: "Google campagne gepauzeerd aangemaakt",
      metadata: { googleAdPlanId: id, externalIds },
    });

    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende Google Ads fout";
    await createGoogleAdsActivity(ctx.db, {
      userId: ctx.user.id,
      type: "GOOGLE_AD_FAILED",
      title: "Google Ads push mislukt",
      metadata: { googleAdPlanId: id, error: message },
    });
    return adsDb.googleAdPlan.update({
      where: { id },
      data: { status: "FAILED", retryCount: Number(plan.retryCount || 0) + 1, lastError: message },
    });
  }
}

export const googleAdsRouter = router({
  connectionStatus: protectedProcedure.query(async ({ ctx }) => {
    const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
    const config = await loadGoogleAdsWorkspaceConfig(ctx.db, scope);
    const selected = config.customerId
      ? await (ctx.db as any).googleAdAccount
          .findFirst({
            where: {
              createdById: ctx.user.workspaceId!,
              externalCustomerId: normalizeGoogleCustomerId(config.customerId),
            },
          })
          .catch(() => null)
      : null;

    const missingOperationalRequirements: string[] = [];
    if (!resolveGoogleAdsDeveloperToken()) missingOperationalRequirements.push("GOOGLE_DEV_TOKEN_MISSING");
    if (!config.refreshToken) missingOperationalRequirements.push("GOOGLE_OAUTH_MISSING");
    if (!config.customerId) missingOperationalRequirements.push("GOOGLE_CUSTOMER_NOT_SELECTED");
    if (!config.autoadsEnabled) missingOperationalRequirements.push("GOOGLE_AUTOMATION_DISABLED");

    return {
      hasOAuthClient: Boolean(config.clientId && config.clientSecret),
      hasDeveloperToken: Boolean(resolveGoogleAdsDeveloperToken()),
      connected: Boolean(config.refreshToken),
      accountEmail: config.accountEmail || null,
      selectedCustomerId: config.customerId || null,
      selectedCustomerName: selected?.name || null,
      loginCustomerId: config.loginCustomerId || null,
      autoadsEnabled: config.autoadsEnabled,
      defaultCurrency: config.defaultCurrency,
      maxDailyBudgetCents: config.maxDailyBudgetCents,
      missingOperationalRequirements,
    };
  }),

  listCustomers: adminProcedure.query(async ({ ctx }) => {
    const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
    const config = await loadGoogleAdsWorkspaceConfig(ctx.db, scope);
    if (!config.refreshToken) throw new TRPCError({ code: "BAD_REQUEST", message: "Koppel Google Ads eerst via Integraties." });
    return listGoogleAdCustomers(config);
  }),

  selectCustomer: adminProcedure
    .input(
      z.object({
        customerId: z.string().min(3),
        name: z.string().min(1).max(160).optional(),
        currency: z.string().min(3).max(3).optional(),
        timezoneName: z.string().optional(),
        loginCustomerId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const customerId = normalizeGoogleCustomerId(input.customerId);
      const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
      await upsertGoogleAdsSettings(ctx.db, scope, [
        { key: "ads.google_customer_id", value: customerId },
        { key: "ads.google_login_customer_id", value: normalizeGoogleCustomerId(input.loginCustomerId || "") },
      ]);
      await (ctx.db as any).googleAdAccount.updateMany({
        where: { createdById: ctx.user.workspaceId! },
        data: { isSelected: false },
      });
      return (ctx.db as any).googleAdAccount.upsert({
        where: {
          createdById_externalCustomerId: { createdById: ctx.user.workspaceId!, externalCustomerId: customerId },
        },
        update: {
          name: input.name || customerId,
          currency: input.currency || "EUR",
          timezoneName: input.timezoneName || null,
          isSelected: true,
          lastSyncedAt: new Date(),
        },
        create: {
          createdById: ctx.user.workspaceId!,
          externalCustomerId: customerId,
          name: input.name || customerId,
          currency: input.currency || "EUR",
          timezoneName: input.timezoneName || null,
          isSelected: true,
          lastSyncedAt: new Date(),
        },
      });
    }),

  setAutoadsEnabled: adminProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
      await upsertGoogleAdsSettings(ctx.db, scope, [
        { key: "ads.google_autoads_enabled", value: String(input.enabled) },
      ]);
      return { enabled: input.enabled };
    }),

  listCampaigns: protectedProcedure.query(async ({ ctx }) => {
    const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
    const config = await loadGoogleAdsWorkspaceConfig(ctx.db, scope);
    if (!config.refreshToken || !config.customerId) return [];
    return listGoogleCampaigns(config);
  }),

  getInsights: protectedProcedure.query(async ({ ctx }) => {
    const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
    const config = await loadGoogleAdsWorkspaceConfig(ctx.db, scope);
    if (!config.refreshToken || !config.customerId) return [];
    return getGoogleAdsInsights(config);
  }),

  searchGeoLocations: protectedProcedure
    .input(z.object({ query: z.string().min(2).max(80) }))
    .query(async ({ ctx, input }) => {
      const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
      const config = await loadGoogleAdsWorkspaceConfig(ctx.db, scope);
      if (!config.refreshToken) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Koppel Google Ads eerst via Integraties." });
      }
      if (!config.customerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Selecteer eerst een Google Ads customer." });
      }
      try {
        return await suggestBeneluxGeoTargets(config, input.query);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Locatiezoekopdracht mislukt.",
        });
      }
    }),

  listDrafts: protectedProcedure
    .input(z.object({ status: planStatusEnum.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { createdById: ctx.user.workspaceId! };
      if (input?.status) where.status = input.status;
      return (ctx.db as any).googleAdPlan.findMany({ where, orderBy: { updatedAt: "desc" }, take: 100 });
    }),

  createDraft: mutationProcedure.input(draftInputSchema).mutation(async ({ ctx, input }) => {
    const row = await (ctx.db as any).googleAdPlan.create({
      data: {
        createdById: ctx.user.workspaceId!,
        name: input.name.trim(),
        campaignType: input.campaignType,
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
    await createGoogleAdsActivity(ctx.db, {
      userId: ctx.user.id,
      type: "GOOGLE_AD_DRAFT_CREATED",
      title: "Google Ads draft aangemaakt",
      metadata: { googleAdPlanId: row.id },
    });
    return row;
  }),

  updateDraft: mutationProcedure
    .input(z.object({ id: z.string() }).merge(draftInputSchema.partial()))
    .mutation(async ({ ctx, input }) => {
      const adsDb = ctx.db as any;
      const row = await adsDb.googleAdPlan.findUnique({ where: { id: input.id } });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Google Ads draft niet gevonden." });
      ensureWorkspaceAccess(row, ctx.user.workspaceId!);
      if (!["DRAFT", "FAILED", "CANCELLED"].includes(row.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Alleen drafts, failed of cancelled plannen kunnen aangepast worden." });
      }
      return adsDb.googleAdPlan.update({
        where: { id: input.id },
        data: {
          name: input.name?.trim(),
          campaignType: input.campaignType,
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

  generateSuggestion: aiRateLimitedProcedure
    .input(
      z.object({
        product: z.string().min(2).max(400),
        audience: z.string().max(400).optional(),
        tone: z.string().max(80).optional(),
        campaignType: campaignTypeEnum.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => renderAdSuggestion(ctx.db, ctx.user.workspaceId!, input)),

  generateAudienceSignals: aiRateLimitedProcedure
    .input(
      z.object({
        product: z.string().min(2).max(400),
        audience: z.string().max(400).optional(),
        tone: z.string().max(80).optional(),
        existingSignals: z.array(z.string().max(80)).max(25).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      renderAudienceSignalsSuggestion(ctx.db, ctx.user.workspaceId!, {
        product: input.product,
        audience: input.audience,
        tone: input.tone,
        existingSignals: input.existingSignals,
      }),
    ),

  generateSearchKeywords: aiRateLimitedProcedure
    .input(
      z.object({
        product: z.string().min(2).max(400),
        audience: z.string().max(400).optional(),
        tone: z.string().max(80).optional(),
        existingKeywords: z.array(z.string().max(80)).max(80).optional(),
        existingNegativeKeywords: z.array(z.string().max(80)).max(80).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      renderSearchKeywordsSuggestion(ctx.db, ctx.user.workspaceId!, {
        product: input.product,
        audience: input.audience,
        tone: input.tone,
        existingKeywords: input.existingKeywords,
        existingNegativeKeywords: input.existingNegativeKeywords,
      }),
    ),

  submitForApproval: mutationProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const adsDb = ctx.db as any;
    const row = await adsDb.googleAdPlan.findUnique({ where: { id: input.id } });
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Google Ads draft niet gevonden." });
    ensureWorkspaceAccess(row, ctx.user.workspaceId!);
    if (!["DRAFT", "FAILED", "CANCELLED"].includes(row.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Deze draft kan niet ter goedkeuring worden aangeboden." });
    }
    const updated = await adsDb.googleAdPlan.update({
      where: { id: input.id },
      data: { status: "PENDING_APPROVAL", lastError: null },
    });
    await createGoogleAdsActivity(ctx.db, {
      userId: ctx.user.id,
      type: "GOOGLE_AD_SUBMITTED",
      title: "Google Ads draft wacht op goedkeuring",
      metadata: { googleAdPlanId: input.id },
    });
    return updated;
  }),

  approveDraft: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const adsDb = ctx.db as any;
    const row = await adsDb.googleAdPlan.findUnique({ where: { id: input.id } });
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Google Ads draft niet gevonden." });
    ensureWorkspaceAccess(row, ctx.user.workspaceId!);
    if (!["PENDING_APPROVAL", "DRAFT", "FAILED"].includes(row.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Deze draft kan niet goedgekeurd worden." });
    }
    const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
    const config = await loadGoogleAdsWorkspaceConfig(ctx.db, scope);
    validateBudgetGuard(row, config.maxDailyBudgetCents);
    const updated = await adsDb.googleAdPlan.update({
      where: { id: input.id },
      data: { status: "APPROVED", approvedById: ctx.user.id, approvedAt: new Date(), lastError: null, retryCount: 0 },
    });
    await createGoogleAdsActivity(ctx.db, {
      userId: ctx.user.id,
      type: "GOOGLE_AD_APPROVED",
      title: "Google Ads draft goedgekeurd",
      metadata: { googleAdPlanId: input.id },
    });
    return updated;
  }),

  rejectDraft: adminProcedure
    .input(z.object({ id: z.string(), reason: z.string().max(1000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const adsDb = ctx.db as any;
      const row = await adsDb.googleAdPlan.findUnique({ where: { id: input.id } });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Google Ads draft niet gevonden." });
      ensureWorkspaceAccess(row, ctx.user.workspaceId!);
      const reason = input.reason?.trim();
      const updated = await adsDb.googleAdPlan.update({
        where: { id: input.id },
        data: { status: "DRAFT", approvedById: null, approvedAt: null, lastError: reason ? `Afgekeurd: ${reason}` : "Afgekeurd" },
      });
      await createGoogleAdsActivity(ctx.db, {
        userId: ctx.user.id,
        type: "GOOGLE_AD_REJECTED",
        title: "Google Ads draft afgekeurd",
        metadata: { googleAdPlanId: input.id, reason: reason || null },
      });
      return updated;
    }),

  pushPausedToGoogle: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => pushPlanToGoogle(ctx as any, input.id)),

  cancelDraft: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const adsDb = ctx.db as any;
    const row = await adsDb.googleAdPlan.findUnique({ where: { id: input.id } });
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Google Ads draft niet gevonden." });
    ensureWorkspaceAccess(row, ctx.user.workspaceId!);
    if (["PUSHING", "PUSHED_PAUSED"].includes(row.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Een gepushte Google-campagne kan niet lokaal geannuleerd worden." });
    }
    return adsDb.googleAdPlan.update({ where: { id: input.id }, data: { status: "CANCELLED" } });
  }),

  retryFailed: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => pushPlanToGoogle(ctx as any, input.id)),
});
