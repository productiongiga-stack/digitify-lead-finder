import { TRPCError } from "@trpc/server";
import { Prisma, type PrismaClient } from "@digitify/db";
import { z } from "zod";
import { adsWizardProviderSchema, type AdsWizardBrief } from "./ads-wizard";
import { performanceMaxPlanSchema, profileHashFromPlan, strategyFromPlan, type AdsWizardStrategy, type PerformanceMaxPlan } from "./ads-wizard-ai";

export const nativeDraftProviderSchema = adsWizardProviderSchema.extract(["META", "GOOGLE"]);

export const nativeDraftInputSchema = z.object({
  projectId: z.string().trim().min(1),
  provider: nativeDraftProviderSchema,
  expectedRevision: z.number().int().min(0),
  name: z.string().trim().max(160).nullable().optional(),
  dailyBudgetCents: z.number().int().min(100).nullable().optional(),
  lifetimeBudgetCents: z.number().int().min(100).nullable().optional(),
  currency: z.string().trim().length(3).default("EUR"),
});

export type NativeDraftInput = z.input<typeof nativeDraftInputSchema>;

export const nativeDraftReviewInputSchema = z.object({
  projectId: z.string().trim().min(1),
  provider: nativeDraftProviderSchema,
  expectedRevision: z.number().int().min(0),
});

export type NativeDraftReviewInput = z.input<typeof nativeDraftReviewInputSchema>;

export const nativeDraftApprovalInputSchema = nativeDraftReviewInputSchema.extend({
  confirmWarnings: z.boolean().default(false),
});

export type NativeDraftApprovalInput = z.input<typeof nativeDraftApprovalInputSchema>;

export const nativeDraftStatusInputSchema = nativeDraftReviewInputSchema;

export type NativeDraftStatusInput = z.input<typeof nativeDraftStatusInputSchema>;

type WizardContext = { user: { ownerUserId?: string; workspaceId?: string; id: string; isViewingAs?: boolean } };

function ownerId(ctx: WizardContext) {
  return ctx.user.ownerUserId || ctx.user.id;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function compactName(value: string, fallback: string) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  return (cleaned || fallback).slice(0, 160);
}

function uniqueDraftName(value: string, projectId: string) {
  return `${value.slice(0, 148).trim()} · ${projectId.slice(-8)}`.slice(0, 160);
}

function platformPlan(strategy: AdsWizardStrategy, provider: "META" | "GOOGLE") {
  return provider === "META"
    ? strategy.meta || { angles: [], audiences: [], creativeDirections: [], callsToAction: [] }
    : strategy.google || { keywordThemes: [], adGroups: [], headlineDirections: [], negativeKeywordThemes: [] };
}

function strategyForProvider(value: unknown, provider: "META" | "GOOGLE") {
  const strategy = strategyFromPlan(value);
  if (!strategy) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Maak eerst de AI-strategie voor ${provider === "META" ? "Meta" : "Google"}.` });
  return strategy;
}

function currentDraftState(project: { readiness: unknown }, provider: "META" | "GOOGLE") {
  const readiness = asRecord(project.readiness);
  const drafts = asRecord(readiness.drafts);
  return { readiness, drafts, state: asRecord(drafts[provider]) };
}

async function selectedMediaForDraft(db: Pick<PrismaClient, "mediaGeneration">, ctx: WizardContext, project: { selectedAssetIds?: unknown }, createdById: string) {
  const ids = Array.isArray(project.selectedAssetIds) ? [...new Set(project.selectedAssetIds.map(String).filter(Boolean))] : [];
  if (!ids.length) return [] as Array<{ id: string; type: string; blobUrl: string }>;
  const workspaceId = ctx.user.workspaceId || createdById;
  const rows = await db.mediaGeneration.findMany({
    where: { id: { in: ids }, workspaceId, status: "COMPLETED", blobUrl: { not: null } },
    select: { id: true, type: true, blobUrl: true },
  });
  if (rows.length !== ids.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Een geselecteerde media-creatie is nog niet duurzaam opgeslagen of hoort niet bij deze workspace." });
  return rows.map((row) => ({ id: row.id, type: String(row.type), blobUrl: String(row.blobUrl) }));
}

export function missingForDraft(provider: "META" | "GOOGLE", brief: AdsWizardBrief, strategy: AdsWizardStrategy, performanceMaxPlan?: PerformanceMaxPlan | null) {
  const missing = ["Budget", "Advertentieaccount"];
  if (!brief.website) missing.push("Doel-URL");
  if (provider === "GOOGLE") {
    if (performanceMaxPlan) {
      if (performanceMaxPlan.headlines.length < 3) missing.push("Minstens 3 PMax-headlines");
      if (!performanceMaxPlan.longHeadlines.length) missing.push("PMax long headline");
      if (performanceMaxPlan.descriptions.length < 2) missing.push("Minstens 2 PMax-descriptions");
      if (!performanceMaxPlan.assets.some((asset) => asset.role === "LANDSCAPE")) missing.push("PMax liggende afbeelding");
      if (!performanceMaxPlan.assets.some((asset) => asset.role === "SQUARE")) missing.push("PMax vierkante afbeelding");
      if (!performanceMaxPlan.assets.some((asset) => asset.role === "LOGO")) missing.push("PMax logo");
      if (!performanceMaxPlan.businessName) missing.push("PMax bedrijfsnaam");
    } else if (!strategy.google?.headlineDirections?.length || !strategy.google?.keywordThemes?.length) {
      missing.push("Google Search-richtingen");
    }
  }
  if (provider === "META" && (!strategy.meta?.angles?.length || !strategy.meta?.callsToAction?.length)) {
    missing.push("Meta-creative-richtingen");
  }
  return missing;
}

function reviewCheck(id: string, label: string, ok: boolean, severity: "BLOCKING" | "WARNING", message: string) {
  return { id, label, ok, severity, message };
}

export function buildNativeDraftReview(provider: "META" | "GOOGLE", draft: { name: string; dailyBudgetCents: number | null; lifetimeBudgetCents: number | null; targeting: unknown; creatives: unknown; campaignType?: string; updatedAt?: Date | string }) {
  const targeting = asRecord(draft.targeting);
  const creatives = asRecord(draft.creatives);
  const checks = [
    reviewCheck("name", "Campagnenaam", Boolean(draft.name.trim()), "BLOCKING", "Geef de draft een herkenbare naam."),
    reviewCheck("budget", "Budget", Boolean((draft.dailyBudgetCents || 0) > 0 || (draft.lifetimeBudgetCents || 0) > 0), "BLOCKING", "Vul een dag- of lifetimebudget in voordat je approval aanvraagt."),
    reviewCheck("account", "Advertentieaccount", false, "BLOCKING", "Selecteer en controleer het juiste advertentieaccount in de provider-editor."),
  ];
  if (provider === "META") {
    const adsets = Array.isArray(targeting.adsets) ? targeting.adsets : [];
    const primaryText = String(creatives.primaryText || creatives.message || "").trim();
    const headline = String(creatives.headline || "").trim();
    const linkUrl = String(creatives.linkUrl || creatives.url || "").trim();
    const hasImage = ["feedImageUrl", "squareImageUrl", "storyImageUrl", "imageUrl"].some((key) => Boolean(String(creatives[key] || "").trim()));
    checks.push(
      reviewCheck("adsets", "Advertentieset", adsets.length > 0, "BLOCKING", "Voeg minstens één doelgroep en plaatsing toe."),
      reviewCheck("copy", "Advertentietekst", Boolean(primaryText && headline), "BLOCKING", "Controleer primaire tekst en headline."),
      reviewCheck("url", "Doel-URL", /^https:\/\//i.test(linkUrl), "BLOCKING", "Gebruik een volledige publieke https-URL."),
      reviewCheck("image", "Beeldasset", hasImage, "WARNING", "Voeg minstens één beeldasset toe voor Meta-plaatsingen."),
    );
  } else if (String(draft.campaignType || "SEARCH").toUpperCase() === "PERFORMANCE_MAX") {
    const headlines = Array.isArray(creatives.headlines) ? creatives.headlines.map(String).filter(Boolean) : [];
    const longHeadlines = Array.isArray(creatives.longHeadlines) ? creatives.longHeadlines.map(String).filter(Boolean) : [];
    const descriptions = Array.isArray(creatives.descriptions) ? creatives.descriptions.map(String).filter(Boolean) : [];
    const finalUrl = String(creatives.finalUrl || "").trim();
    const hasLandscape = Boolean(String(creatives.imageUrl || "").trim());
    const hasSquare = Boolean(String(creatives.squareImageUrl || "").trim());
    const hasLogo = Boolean(String(creatives.logoUrl || "").trim());
    checks.push(
      reviewCheck("url", "Final URL", /^https:\/\//i.test(finalUrl), "BLOCKING", "Gebruik een volledige https final URL voor PMax."),
      reviewCheck("headlines", "PMax-headlines", headlines.length >= 3 && headlines.every((item) => item.length <= 30), "BLOCKING", "PMax vereist minstens 3 headlines van maximaal 30 tekens."),
      reviewCheck("longHeadlines", "Lange headlines", longHeadlines.length >= 1 && longHeadlines.every((item) => item.length <= 90), "BLOCKING", "PMax vereist minstens 1 long headline van maximaal 90 tekens."),
      reviewCheck("descriptions", "PMax-descriptions", descriptions.length >= 2 && descriptions.every((item) => item.length <= 90), "BLOCKING", "PMax vereist minstens 2 descriptions van maximaal 90 tekens."),
      reviewCheck("landscape", "Liggande afbeelding", hasLandscape, "BLOCKING", "Koppel een liggende marketingafbeelding aan de PMax-assetgroep."),
      reviewCheck("square", "Vierkante afbeelding", hasSquare, "BLOCKING", "Koppel een vierkante marketingafbeelding aan de PMax-assetgroep."),
      reviewCheck("logo", "Logo", hasLogo, "BLOCKING", "Koppel een logo aan de PMax-assetgroep."),
      reviewCheck("businessName", "Bedrijfsnaam", Boolean(String(creatives.businessName || "").trim()) && String(creatives.businessName).trim().length <= 25, "BLOCKING", "PMax vereist een bedrijfsnaam van maximaal 25 tekens."),
      reviewCheck("brandGuidelines", "Brand guidelines", !creatives.brandGuidelinesEnabled, "BLOCKING", "Brand guidelines zijn in deze flow nog niet ondersteund; zet ze uit of beheer de campagne handmatig."),
    );
  } else {
    const headlines = Array.isArray(creatives.headlines) ? creatives.headlines.map(String).filter(Boolean) : [];
    const descriptions = Array.isArray(creatives.descriptions) ? creatives.descriptions.map(String).filter(Boolean) : [];
    const keywords = Array.isArray(targeting.keywords) ? targeting.keywords.map(String).filter(Boolean) : [];
    const adGroups = Array.isArray(targeting.adGroups) ? targeting.adGroups.map(asRecord).filter((group) => String(group.name || "").trim()) : [];
    const finalUrl = String(creatives.finalUrl || "").trim();
    checks.push(
      reviewCheck("url", "Final URL", /^https:\/\//i.test(finalUrl), "BLOCKING", "Gebruik een volledige https final URL."),
      reviewCheck("headlines", "Headlines", headlines.length >= 3 && headlines.every((item) => item.length <= 30), "BLOCKING", "Google Search vereist minstens 3 headlines van maximaal 30 tekens."),
      reviewCheck("descriptions", "Descriptions", descriptions.length >= 2 && descriptions.every((item) => item.length <= 90), "BLOCKING", "Google Search vereist minstens 2 descriptions van maximaal 90 tekens."),
      reviewCheck("adGroups", "Advertentiegroepen", adGroups.length > 0 || Boolean(String(targeting.adGroupName || "").trim()), "BLOCKING", "Voeg minstens één benoemde Google Search-advertentiegroep toe."),
      reviewCheck("keywords", "Keywords", keywords.length > 0, "BLOCKING", "Voeg minstens één keyword of bevestigd keywordthema toe."),
    );
  }
  const blockingIssues = checks.filter((check) => !check.ok && check.severity === "BLOCKING").map((check) => check.message);
  const warnings = checks.filter((check) => !check.ok && check.severity === "WARNING").map((check) => check.message);
  const score = Math.max(0, Math.min(100, 100 - blockingIssues.length * 18 - warnings.length * 8));
  return {
    status: blockingIssues.length ? "BLOCKED" : warnings.length ? "READY_WITH_WARNINGS" : "READY",
    score,
    checks,
    blockingIssues,
    warnings,
    draftUpdatedAt: draft.updatedAt ? new Date(draft.updatedAt).toISOString() : undefined,
    checkedAt: new Date().toISOString(),
  };
}

export async function reviewAdsWizardNativeDraft(
  db: PrismaClient,
  ctx: WizardContext,
  input: NativeDraftReviewInput,
) {
  const createdById = ownerId(ctx);
  const project = await db.adsWizardProject.findFirst({ where: { id: input.projectId, createdById } });
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Campagneconcept niet gevonden in deze workspace." });
  if (project.status === "ARCHIVED") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Dit campagneconcept is gearchiveerd. Hervat het eerst." });
  const { readiness, drafts, state } = currentDraftState(project, input.provider);
  const draftId = typeof state.draftId === "string" ? state.draftId : "";
  if (!draftId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Maak eerst de ${input.provider === "META" ? "Meta" : "Google"}-draft.` });
  if (project.revision !== input.expectedRevision) throw new TRPCError({ code: "CONFLICT", message: "Dit concept is intussen gewijzigd. Herlaad het voor je de controle uitvoert." });
  const draft = input.provider === "META"
    ? await db.metaAdPlan.findFirst({ where: { id: draftId, createdById } })
    : await db.googleAdPlan.findFirst({ where: { id: draftId, createdById } });
  if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "De gekoppelde advertentiedraft bestaat niet meer." });
  const review = buildNativeDraftReview(input.provider, draft);
  const nextReadiness = {
    ...readiness,
    drafts: { ...drafts, [input.provider]: { ...state, review } },
  };
  const updated = await db.adsWizardProject.updateMany({
    where: { id: project.id, createdById, revision: input.expectedRevision, status: { not: "ARCHIVED" } },
    data: { readiness: jsonValue(nextReadiness), revision: { increment: 1 } },
  });
  if (!updated.count) throw new TRPCError({ code: "CONFLICT", message: "Dit concept is intussen gewijzigd. Herlaad de nieuwste versie." });
  const saved = await db.adsWizardProject.findFirst({ where: { id: project.id, createdById } });
  return { project: saved, draft, review };
}

export async function submitAdsWizardNativeDraftForApproval(
  db: PrismaClient,
  ctx: WizardContext,
  input: NativeDraftApprovalInput,
) {
  if (ctx.user.isViewingAs) throw new TRPCError({ code: "FORBIDDEN", message: "Goedkeuren of indienen is niet beschikbaar in supportweergave." });
  const createdById = ownerId(ctx);
  const project = await db.adsWizardProject.findFirst({ where: { id: input.projectId, createdById } });
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Campagneconcept niet gevonden in deze workspace." });
  const { readiness, drafts, state } = currentDraftState(project, input.provider);
  const draftId = typeof state.draftId === "string" ? state.draftId : "";
  if (!draftId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Maak eerst een advertentiedraft." });
  if (project.revision !== input.expectedRevision) throw new TRPCError({ code: "CONFLICT", message: "Dit concept is intussen gewijzigd. Herlaad het voor je indient." });
  const draft = input.provider === "META"
    ? await db.metaAdPlan.findFirst({ where: { id: draftId, createdById } })
    : await db.googleAdPlan.findFirst({ where: { id: draftId, createdById } });
  if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "De gekoppelde advertentiedraft bestaat niet meer." });
  if (draft.status === "PENDING_APPROVAL") return { project, draft, reused: true };
  if (!["DRAFT", "FAILED", "CANCELLED"].includes(draft.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "Deze draft kan niet opnieuw ter goedkeuring worden aangeboden." });
  const review = asRecord(state.review);
  if (!review.status) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Controleer de draft eerst voordat je deze indient." });
  if (review.status === "BLOCKED") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Los eerst de blokkerende punten van de draftcontrole op." });
  if (review.status === "READY_WITH_WARNINGS" && !input.confirmWarnings) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Bevestig eerst dat je de waarschuwingen hebt gecontroleerd." });
  if (review.draftUpdatedAt && new Date(String(review.draftUpdatedAt)).getTime() !== draft.updatedAt.getTime()) {
    throw new TRPCError({ code: "CONFLICT", message: "De draft is gewijzigd na de laatste controle. Voer de controle opnieuw uit." });
  }
  const approvalStatus = { status: "PENDING", submittedAt: new Date().toISOString(), warningsConfirmed: input.confirmWarnings };
  const nextReadiness = { ...readiness, drafts: { ...drafts, [input.provider]: { ...state, approval: approvalStatus } } };
  const updated = await db.$transaction(async (tx) => {
    const claimed = await tx.adsWizardProject.updateMany({
      where: { id: project.id, createdById, revision: input.expectedRevision, status: { not: "ARCHIVED" } },
      data: { readiness: jsonValue(nextReadiness), revision: { increment: 1 } },
    });
    if (!claimed.count) throw new TRPCError({ code: "CONFLICT", message: "Dit concept is intussen gewijzigd. Herlaad het voor je indient." });
    const updatedDraft = input.provider === "META"
      ? await tx.metaAdPlan.update({ where: { id: draftId }, data: { status: "PENDING_APPROVAL", lastError: null } })
      : await tx.googleAdPlan.update({ where: { id: draftId }, data: { status: "PENDING_APPROVAL", lastError: null } });
    await tx.activity.create({ data: {
      userId: ctx.user.id,
      type: input.provider === "META" ? "META_AD_SUBMITTED" : "GOOGLE_AD_SUBMITTED",
      title: `${input.provider === "META" ? "Meta" : "Google"} Ads draft ingediend vanuit wizard`,
      metadata: jsonValue({ wizardProjectId: project.id, planId: draftId, warningsConfirmed: input.confirmWarnings }),
    } });
    const savedProject = await tx.adsWizardProject.findFirst({ where: { id: project.id, createdById } });
    return { project: savedProject, draft: updatedDraft };
  });
  return { ...updated, reused: false };
}

function approvalStateForDraftStatus(status: string, previous: Record<string, unknown>) {
  const now = new Date().toISOString();
  if (status === "PENDING_APPROVAL") return { ...previous, status: "PENDING", updatedAt: now };
  if (status === "APPROVED") return { ...previous, status: "APPROVED", updatedAt: now };
  if (status === "PUSHING" || status === "PUSHED_PAUSED") return { ...previous, status: "PUBLISHED", updatedAt: now };
  if (status === "FAILED") return { ...previous, status: "FAILED", updatedAt: now };
  if (status === "DRAFT" || status === "CANCELLED") return { ...previous, status: "REJECTED", updatedAt: now };
  return previous;
}

/**
 * Pulls the status of the existing provider draft back into the resumable
 * wizard. Provider editors remain the source of truth; this only mirrors
 * their local approval/publication state and never calls a provider API.
 */
export async function syncAdsWizardNativeDraftStatus(
  db: PrismaClient,
  ctx: WizardContext,
  input: NativeDraftStatusInput,
) {
  const createdById = ownerId(ctx);
  const project = await db.adsWizardProject.findFirst({ where: { id: input.projectId, createdById } });
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Campagneconcept niet gevonden in deze workspace." });
  const { readiness, drafts, state } = currentDraftState(project, input.provider);
  const draftId = typeof state.draftId === "string" ? state.draftId : "";
  if (!draftId) return { project, draft: null, changed: false };
  const draft = input.provider === "META"
    ? await db.metaAdPlan.findFirst({ where: { id: draftId, createdById } })
    : await db.googleAdPlan.findFirst({ where: { id: draftId, createdById } });
  if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "De gekoppelde advertentiedraft bestaat niet meer." });
  const previousApproval = asRecord(state.approval);
  const nextApproval = approvalStateForDraftStatus(String(draft.status), previousApproval);
  if (nextApproval.status === previousApproval.status) return { project, draft, changed: false };
  if (project.revision !== input.expectedRevision) throw new TRPCError({ code: "CONFLICT", message: "Dit concept is intussen gewijzigd. Herlaad de nieuwste versie." });
  const nextReadiness = { ...readiness, drafts: { ...drafts, [input.provider]: { ...state, approval: nextApproval, providerStatus: draft.status } } };
  const updated = await db.adsWizardProject.updateMany({
    where: { id: project.id, createdById, revision: input.expectedRevision, status: { not: "ARCHIVED" } },
    data: { readiness: jsonValue(nextReadiness), revision: { increment: 1 } },
  });
  if (!updated.count) throw new TRPCError({ code: "CONFLICT", message: "Dit concept is intussen gewijzigd. Herlaad de nieuwste versie." });
  const saved = await db.adsWizardProject.findFirst({ where: { id: project.id, createdById } });
  return { project: saved, draft, changed: true };
}

/**
 * Materialises a wizard plan into the existing local provider draft models.
 * This deliberately stops before any provider API call. The optimistic
 * revision update and draft creation share one transaction, so retries cannot
 * leave a second native draft behind.
 */
export async function createAdsWizardNativeDraft(
  db: PrismaClient,
  ctx: WizardContext,
  input: NativeDraftInput,
) {
  if (ctx.user.isViewingAs) throw new TRPCError({ code: "FORBIDDEN", message: "Advertentiedrafts maken is niet beschikbaar in supportweergave." });
  const createdById = ownerId(ctx);

  return db.$transaction(async (tx) => {
    const project = await tx.adsWizardProject.findFirst({ where: { id: input.projectId, createdById } });
    if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Campagneconcept niet gevonden in deze workspace." });
    if (project.status === "ARCHIVED") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Dit campagneconcept is gearchiveerd. Hervat het eerst." });
    const selection = adsWizardProviderSchema.parse(project.providerSelection);
    if (!(selection === "BOTH" || selection === input.provider)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Dit platform is niet geselecteerd in de briefing." });
    }

    const { readiness, drafts, state } = currentDraftState(project, input.provider);
    if (state.status === "READY" && typeof state.draftId === "string") {
      const existing = input.provider === "META"
        ? await tx.metaAdPlan.findFirst({ where: { id: state.draftId, createdById } })
        : await tx.googleAdPlan.findFirst({ where: { id: state.draftId, createdById } });
      if (existing) return { project, draft: existing, provider: input.provider, reused: true, missing: Array.isArray(state.missing) ? state.missing : [] };
    }
    if (project.revision !== input.expectedRevision) {
      throw new TRPCError({ code: "CONFLICT", message: "Dit concept is intussen gewijzigd. Herlaad de nieuwste versie voordat je een draft maakt." });
    }

    const brief = asRecord(project.brief) as AdsWizardBrief;
    const plan = input.provider === "META" ? project.metaPlan : project.googlePlan;
    const strategy = strategyForProvider(plan, input.provider);
    const sourcePlan = platformPlan(strategy, input.provider);
    const selectedMedia = await selectedMediaForDraft(tx, ctx, project, createdById);
    const selectedImages = selectedMedia.filter((asset) => asset.type === "IMAGE");
    const selectedVideos = selectedMedia.filter((asset) => asset.type === "VIDEO" || asset.type === "MARKETING_AD");
    const firstImageUrl = selectedImages[0]?.blobUrl || "";
    const firstVideoUrl = selectedVideos[0]?.blobUrl || "";
    const storedPlan = input.provider === "GOOGLE" && plan && typeof plan === "object" && !Array.isArray(plan)
      ? asRecord((plan as Record<string, unknown>).searchPlan)
      : {};
    const performanceMaxPlan = input.provider === "GOOGLE" && plan && typeof plan === "object" && !Array.isArray(plan) && (plan as Record<string, unknown>).performanceMaxPlan
      ? performanceMaxPlanSchema.parse((plan as Record<string, unknown>).performanceMaxPlan)
      : null;
    const storedGroups: Array<Record<string, unknown>> = Array.isArray(storedPlan.adGroups) ? storedPlan.adGroups.map(asRecord) : [];
    const storedKeywords = storedGroups.flatMap((group: Record<string, unknown>) => Array.isArray(group.keywords) ? group.keywords.map((keyword: unknown) => String(asRecord(keyword).text || "").trim()).filter(Boolean) : []);
    const storedNegativeKeywords = storedGroups.flatMap((group: Record<string, unknown>) => Array.isArray(group.negativeKeywords) ? group.negativeKeywords.map((keyword: unknown) => String(asRecord(keyword).text || "").trim()).filter(Boolean) : []);
    const storedHeadlines = Array.isArray(storedGroups[0]?.headlines) ? storedGroups[0].headlines.map(String).filter(Boolean) : [];
    const storedDescriptions = Array.isArray(storedGroups[0]?.descriptions) ? storedGroups[0].descriptions.map(String).filter(Boolean) : [];
    const baseName = compactName(input.name || project.name || brief.product || "Nieuwe campagne", "Nieuwe campagne");
    const name = uniqueDraftName(baseName, project.id);
    const currency = (input.currency || "EUR").trim().toUpperCase();
    const provenance = {
      source: "ADS_WIZARD",
      wizardProjectId: project.id,
      profileHash: profileHashFromPlan(plan) || null,
      strategyConfidence: strategy.confidence,
      createdAt: new Date().toISOString(),
    };
    const missing = missingForDraft(input.provider, brief, strategy, performanceMaxPlan);
    const draft = input.provider === "META"
      ? await tx.metaAdPlan.create({
        data: {
          createdById,
          name,
          objective: /sales|verkoop/i.test(brief.objective || "") ? "OUTCOME_SALES" : /lead|offerte|contact/i.test(brief.objective || "") ? "OUTCOME_LEADS" : "OUTCOME_TRAFFIC",
          dailyBudgetCents: input.dailyBudgetCents ?? null,
          lifetimeBudgetCents: input.lifetimeBudgetCents ?? null,
          currency,
          targeting: jsonValue({ ...provenance, strategy: sourcePlan, adsets: [] }),
          creatives: jsonValue({
            ...provenance,
            website: brief.website || null,
            strategy: sourcePlan,
            selectedMedia,
            feedImageUrl: firstImageUrl,
            imageUrl: firstImageUrl,
            videoUrl: firstVideoUrl,
            adsets: [],
          }),
          status: "DRAFT",
        },
      })
      : await tx.googleAdPlan.create({
        data: {
          createdById,
          name,
          campaignType: performanceMaxPlan ? "PERFORMANCE_MAX" : "SEARCH",
          dailyBudgetCents: input.dailyBudgetCents ?? null,
          lifetimeBudgetCents: input.lifetimeBudgetCents ?? null,
          currency,
          targeting: jsonValue({
            ...provenance,
            strategy: sourcePlan,
            searchPlan: Object.keys(storedPlan).length ? storedPlan : null,
            performanceMaxPlan: performanceMaxPlan || null,
            selectedMedia,
            adGroups: storedGroups,
            adGroupName: String(storedGroups[0]?.name || ""),
            keywordThemes: performanceMaxPlan ? [] : strategy.google?.keywordThemes || [],
            negativeKeywordThemes: performanceMaxPlan ? [] : strategy.google?.negativeKeywordThemes || [],
            keywords: storedKeywords,
            negativeKeywords: storedNegativeKeywords,
            campaignSettings: performanceMaxPlan ? {
              biddingStrategy: performanceMaxPlan.biddingStrategy || undefined,
              conversionGoal: performanceMaxPlan.conversionGoal || undefined,
            } : undefined,
          }),
          creatives: jsonValue({
            ...provenance,
            finalUrl: String(performanceMaxPlan?.finalUrl || storedPlan.finalUrl || brief.website || "") || null,
            strategy: sourcePlan,
            selectedMedia,
            headlines: performanceMaxPlan?.headlines || storedHeadlines,
            longHeadlines: performanceMaxPlan?.longHeadlines || [],
            descriptions: performanceMaxPlan?.descriptions || storedDescriptions,
            businessName: performanceMaxPlan?.businessName || "",
            assetGroupName: performanceMaxPlan?.assetGroupName || String(storedGroups[0]?.name || ""),
            imageUrl: performanceMaxPlan?.assets.find((asset) => asset.role === "LANDSCAPE")?.url || "",
            squareImageUrl: performanceMaxPlan?.assets.find((asset) => asset.role === "SQUARE")?.url || "",
            portraitImageUrl: performanceMaxPlan?.assets.find((asset) => asset.role === "PORTRAIT")?.url || "",
            logoUrl: performanceMaxPlan?.assets.find((asset) => asset.role === "LOGO")?.url || "",
            landscapeLogoUrl: performanceMaxPlan?.assets.find((asset) => asset.role === "LANDSCAPE_LOGO")?.url || "",
            brandGuidelinesEnabled: performanceMaxPlan?.brandGuidelinesEnabled || false,
            audienceSignals: performanceMaxPlan?.audienceSignals || [],
            searchThemes: performanceMaxPlan?.searchThemes || [],
            path1: String(storedGroups[0]?.path1 || ""),
            path2: String(storedGroups[0]?.path2 || ""),
          }),
          status: "DRAFT",
        },
      });

    const nextReadiness = {
      ...readiness,
      drafts: {
        ...drafts,
        [input.provider]: {
          status: "READY",
          draftId: draft.id,
          provider: input.provider,
          missing,
          strategyConfidence: strategy.confidence,
          profileHash: profileHashFromPlan(plan) || null,
          createdAt: new Date().toISOString(),
        },
      },
    };
    const updated = await tx.adsWizardProject.updateMany({
      where: { id: project.id, createdById, revision: input.expectedRevision, status: { not: "ARCHIVED" } },
      data: { readiness: jsonValue(nextReadiness), revision: { increment: 1 } },
    });
    if (!updated.count) throw new TRPCError({ code: "CONFLICT", message: "Dit concept is intussen gewijzigd. Herlaad de nieuwste versie." });
    const saved = await tx.adsWizardProject.findFirst({ where: { id: project.id, createdById } });
    return { project: saved, draft, provider: input.provider, reused: false, missing };
  });
}
