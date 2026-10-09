import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { Prisma, type PrismaClient } from "@digitify/db";

export const adsWizardProviderSchema = z.enum(["META", "GOOGLE", "BOTH"]);
export const adsWizardStatusSchema = z.enum(["DRAFT", "READY", "ARCHIVED"]);
export const adsWizardStepSchema = z.enum(["briefing", "context", "platform", "review"]);

const httpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => !value || /^https?:\/\//i.test(value), "Gebruik een http(s)-URL of laat dit veld leeg.");

export const adsWizardBriefSchema = z
  .object({
    objective: z.string().trim().max(1000).default(""),
    product: z.string().trim().max(1000).default(""),
    audience: z.string().trim().max(1000).default(""),
    website: httpUrl.default(""),
    companyId: z.string().trim().max(120).optional(),
    leadId: z.string().trim().max(120).optional(),
    campaignId: z.string().trim().max(120).optional(),
    tone: z.string().trim().max(120).default("professioneel"),
    notes: z.string().trim().max(4000).default(""),
  })
  .strict();

const jsonObjectSchema = z.record(z.string(), z.unknown());
const selectedAssetIdsSchema = z.array(z.string().trim().min(1).max(160)).max(50).default([]);

export const adsWizardCreateInputSchema = z.object({
  providerSelection: adsWizardProviderSchema.default("META"),
  name: z.string().trim().min(1).max(160).optional(),
  brief: adsWizardBriefSchema.default({}),
  metaPlan: jsonObjectSchema.optional(),
  googlePlan: jsonObjectSchema.optional(),
  selectedAssetIds: selectedAssetIdsSchema.optional(),
  readiness: jsonObjectSchema.optional(),
  idempotencyKey: z.string().trim().min(8).max(160),
});

export const adsWizardSaveInputSchema = z.object({
  id: z.string().trim().min(1),
  expectedRevision: z.number().int().min(0),
  providerSelection: adsWizardProviderSchema.optional(),
  status: adsWizardStatusSchema.optional(),
  activeStep: adsWizardStepSchema.optional(),
  name: z.string().trim().min(1).max(160).nullable().optional(),
  brief: adsWizardBriefSchema.optional(),
  metaPlan: jsonObjectSchema.nullable().optional(),
  googlePlan: jsonObjectSchema.nullable().optional(),
  selectedAssetIds: selectedAssetIdsSchema.optional(),
  readiness: jsonObjectSchema.nullable().optional(),
});

export const adsWizardSharedReviewInputSchema = z.object({
  projectId: z.string().trim().min(1),
  expectedRevision: z.number().int().min(0),
});

export type AdsWizardBrief = z.infer<typeof adsWizardBriefSchema>;
// Use z.input for procedure arguments: defaults are applied at runtime, so a
// caller may intentionally submit a compact/empty briefing object.
export type AdsWizardCreateInput = z.input<typeof adsWizardCreateInputSchema>;
export type AdsWizardSaveInput = z.input<typeof adsWizardSaveInputSchema>;

export type AdsWizardSharedReviewInput = z.input<typeof adsWizardSharedReviewInputSchema>;

const MAX_JSON_BYTES = 160_000;

function jsonSize(value: unknown) {
  return Buffer.byteLength(JSON.stringify(value ?? null), "utf8");
}

function asJson(value: unknown, label: string): Prisma.InputJsonValue {
  if (jsonSize(value) > MAX_JSON_BYTES) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `${label} is te groot. Verwijder overbodige details en probeer opnieuw.` });
  }
  return value as Prisma.InputJsonValue;
}

export function normalizeAdsWizardBrief(value: unknown): AdsWizardBrief {
  return adsWizardBriefSchema.parse(value ?? {});
}

export function wizardIdempotencyKey(ownerUserId: string, requestedKey: string) {
  return createHash("sha256").update(`${ownerUserId}:${requestedKey.trim()}`).digest("hex").slice(0, 48);
}

function ownerId(ctx: { user: { ownerUserId?: string; id: string } }) {
  return ctx.user.ownerUserId || ctx.user.id;
}

function workspaceId(ctx: { user: { workspaceId?: string; ownerUserId?: string; id: string } }) {
  return ctx.user.workspaceId || ownerId(ctx);
}

function projectWhere(ownerUserId: string, id: string) {
  return { id, createdById: ownerUserId };
}

async function assertSelectedMediaAssets(db: PrismaClient, ctx: { user: { workspaceId?: string; ownerUserId?: string; id: string } }, ids: string[]) {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!uniqueIds.length) return;
  const rows = await db.mediaGeneration.findMany({
    where: { id: { in: uniqueIds }, workspaceId: workspaceId(ctx) },
    select: { id: true, status: true, blobUrl: true },
  });
  if (rows.length !== uniqueIds.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Een geselecteerde media-creatie hoort niet bij deze workspace." });
  }
  const notReady = rows.find((row) => row.status !== "COMPLETED" || !row.blobUrl);
  if (notReady) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Sla elke media-creatie eerst duurzaam op voordat je deze aan een advertentie koppelt." });
  }
}

export async function listAdsWizardAssets(db: PrismaClient, ctx: { user: { workspaceId?: string; ownerUserId?: string; id: string } }) {
  return db.mediaGeneration.findMany({
    where: { workspaceId: workspaceId(ctx), status: "COMPLETED", blobUrl: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { id: true, type: true, model: true, prompt: true, blobUrl: true, metadata: true, createdAt: true },
  });
}

export async function createAdsWizardProject(db: PrismaClient, ctx: { user: { workspaceId?: string; ownerUserId?: string; id: string } }, input: AdsWizardCreateInput) {
  const createdById = ownerId(ctx);
  const idempotencyKey = wizardIdempotencyKey(createdById, input.idempotencyKey);
  const existing = await db.adsWizardProject.findFirst({ where: { createdById, idempotencyKey } });
  if (existing) return existing;
  if (input.selectedAssetIds) await assertSelectedMediaAssets(db, ctx, input.selectedAssetIds);

  const data = {
    createdById,
    providerSelection: input.providerSelection ?? "META",
    status: "DRAFT",
    activeStep: "briefing",
    name: input.name?.trim() || null,
    brief: asJson(normalizeAdsWizardBrief(input.brief), "De briefing"),
    metaPlan: input.metaPlan === undefined ? undefined : input.metaPlan === null ? Prisma.JsonNull : asJson(input.metaPlan, "Het Meta-plan"),
    googlePlan: input.googlePlan === undefined ? undefined : input.googlePlan === null ? Prisma.JsonNull : asJson(input.googlePlan, "Het Google-plan"),
    selectedAssetIds: input.selectedAssetIds ? asJson([...new Set(input.selectedAssetIds)], "De geselecteerde bestanden") : undefined,
    readiness: input.readiness === undefined ? undefined : asJson(input.readiness, "De readiness-controle"),
    idempotencyKey,
  } satisfies Prisma.AdsWizardProjectUncheckedCreateInput;

  try {
    return await db.adsWizardProject.create({ data });
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
    const concurrent = await db.adsWizardProject.findFirst({ where: { createdById, idempotencyKey } });
    if (!concurrent) throw error;
    return concurrent;
  }
}

export async function saveAdsWizardProject(db: PrismaClient, ctx: { user: { workspaceId?: string; ownerUserId?: string; id: string } }, input: AdsWizardSaveInput) {
  const createdById = ownerId(ctx);
  const current = await db.adsWizardProject.findFirst({ where: projectWhere(createdById, input.id) });
  if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Campagnewizard niet gevonden in deze workspace." });
  if (current.status === "ARCHIVED") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Dit campagneconcept is gearchiveerd. Hervat het eerst." });
  if (input.selectedAssetIds !== undefined) await assertSelectedMediaAssets(db, ctx, input.selectedAssetIds);

  const data: Prisma.AdsWizardProjectUpdateInput = {
    providerSelection: input.providerSelection,
    status: input.status,
    activeStep: input.activeStep,
    name: input.name === undefined ? undefined : input.name?.trim() || null,
    brief: input.brief === undefined ? undefined : asJson(normalizeAdsWizardBrief(input.brief), "De briefing"),
    metaPlan: input.metaPlan === undefined ? undefined : asJson(input.metaPlan, "Het Meta-plan"),
    googlePlan: input.googlePlan === undefined ? undefined : asJson(input.googlePlan, "Het Google-plan"),
    selectedAssetIds: input.selectedAssetIds === undefined ? undefined : asJson([...new Set(input.selectedAssetIds)], "De geselecteerde bestanden"),
    readiness: input.readiness === undefined ? undefined : input.readiness === null ? Prisma.JsonNull : asJson(input.readiness, "De readiness-controle"),
    revision: { increment: 1 },
  };
  const updated = await db.adsWizardProject.updateMany({
    where: { ...projectWhere(createdById, input.id), revision: input.expectedRevision, status: { not: "ARCHIVED" } },
    data,
  });
  if (!updated.count) {
    const latest = await db.adsWizardProject.findFirst({ where: projectWhere(createdById, input.id), select: { id: true } });
    if (!latest) throw new TRPCError({ code: "NOT_FOUND", message: "Campagnewizard niet gevonden in deze workspace." });
    throw new TRPCError({ code: "CONFLICT", message: "Dit concept is in een ander tabblad gewijzigd. Herlaad de nieuwste versie voordat je verdergaat." });
  }
  return db.adsWizardProject.findFirst({ where: projectWhere(createdById, input.id) });
}

type SharedReviewProject = {
  providerSelection: string;
  brief: unknown;
  metaPlan?: unknown;
  googlePlan?: unknown;
  selectedAssetIds?: unknown;
  readiness?: unknown;
};

function recordValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function textList(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

/**
 * Reviews both platform plans together without calling Meta, Google or an AI
 * provider. Each platform keeps its own blockers and draft status so a
 * successful Meta preparation can never hide an incomplete Google plan.
 */
export function buildAdsWizardSharedReview(project: SharedReviewProject) {
  const selection = adsWizardProviderSchema.parse(project.providerSelection);
  const brief = recordValue(project.brief);
  const readiness = recordValue(project.readiness);
  const draftStates = recordValue(readiness.drafts);
  const selectedAssets = [...new Set(Array.isArray(project.selectedAssetIds) ? project.selectedAssetIds.map(String).filter(Boolean) : [])];
  const sharedBlockers = [
    !String(brief.objective || "").trim() ? "Vul het campagnedoel in." : null,
    !String(brief.product || "").trim() ? "Vul het product of de dienst in." : null,
    String(brief.website || "").trim() && !/^https?:\/\//i.test(String(brief.website).trim()) ? "Gebruik een geldige http(s)-URL." : null,
  ].filter(Boolean) as string[];

  const reviewPlatform = (provider: "META" | "GOOGLE", planValue: unknown) => {
    const plan = recordValue(planValue);
    const strategy = recordValue(plan.strategy);
    const platformStrategy = recordValue(strategy[provider === "META" ? "meta" : "google"]);
    const state = recordValue(draftStates[provider]);
    const blockers = [...sharedBlockers];
    const warnings: string[] = [];
    if (!Object.keys(strategy).length) blockers.push("Maak eerst de gedeelde AI-strategie.");
    if (!Object.keys(platformStrategy).length) blockers.push(`${provider === "META" ? "Meta" : "Google"}-richting ontbreekt in het platformplan.`);
    if (!selectedAssets.length) warnings.push("Er zijn nog geen gedeelde bibliotheekassets geselecteerd.");
    const draftStatus = String(state.status || "NOT_CREATED");
    const draftReview = recordValue(state.review);
    if (draftStatus === "NOT_CREATED") blockers.push("Maak eerst de lokale platformdraft.");
    if (String(draftReview.status || "") === "BLOCKED") blockers.push(...textList(draftReview.blockingIssues).slice(0, 5));
    if (String(draftReview.status || "") === "READY_WITH_WARNINGS") warnings.push(...textList(draftReview.warnings).slice(0, 5));
    if (draftStatus === "PENDING_APPROVAL") warnings.push("De draft wacht op de bestaande approvalflow.");
    if (draftStatus === "PUSHED_PAUSED") warnings.push("De campagne is extern aangemaakt en blijft gepauzeerd tot een aparte activatie.");
    return {
      provider,
      status: blockers.length ? "BLOCKED" : warnings.length ? "READY_WITH_WARNINGS" : "READY",
      blockers: [...new Set(blockers)],
      warnings: [...new Set(warnings)],
      draftStatus,
      selectedAssetCount: selectedAssets.length,
    };
  };

  const platforms = {
    ...(selection === "META" || selection === "BOTH" ? { META: reviewPlatform("META", project.metaPlan) } : {}),
    ...(selection === "GOOGLE" || selection === "BOTH" ? { GOOGLE: reviewPlatform("GOOGLE", project.googlePlan) } : {}),
  };
  const platformValues = Object.values(platforms);
  const blockers = [...new Set(platformValues.flatMap((item) => item.blockers))];
  const warnings = [...new Set(platformValues.flatMap((item) => item.warnings))];
  return {
    selection,
    status: blockers.length ? "BLOCKED" : warnings.length ? "READY_WITH_WARNINGS" : "READY",
    blockers,
    warnings,
    selectedAssetCount: selectedAssets.length,
    platforms,
    checkedAt: new Date().toISOString(),
  };
}

export async function reviewAdsWizardProject(
  db: PrismaClient,
  ctx: { user: { ownerUserId?: string; id: string } },
  input: AdsWizardSharedReviewInput,
) {
  const createdById = ownerId(ctx);
  const project = await db.adsWizardProject.findFirst({ where: projectWhere(createdById, input.projectId) });
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Campagneconcept niet gevonden in deze workspace." });
  if (project.status === "ARCHIVED") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Dit campagneconcept is gearchiveerd. Hervat het eerst." });
  if (project.revision !== input.expectedRevision) throw new TRPCError({ code: "CONFLICT", message: "Dit concept is intussen gewijzigd. Herlaad de nieuwste versie voor de gedeelde controle." });
  const review = buildAdsWizardSharedReview(project);
  const updated = await db.adsWizardProject.updateMany({
    where: { ...projectWhere(createdById, input.projectId), revision: input.expectedRevision, status: { not: "ARCHIVED" } },
    data: {
      status: review.status === "READY" ? "READY" : "DRAFT",
      readiness: asJson({ ...recordValue(project.readiness), sharedReview: review }, "De gedeelde controle"),
      revision: { increment: 1 },
    },
  });
  if (!updated.count) throw new TRPCError({ code: "CONFLICT", message: "Dit concept is intussen gewijzigd. Herlaad de nieuwste versie." });
  const saved = await db.adsWizardProject.findFirst({ where: projectWhere(createdById, input.projectId) });
  return { project: saved, review };
}

export async function archiveAdsWizardProject(db: PrismaClient, ctx: { user: { ownerUserId?: string; id: string } }, id: string) {
  const createdById = ownerId(ctx);
  const updated = await db.adsWizardProject.updateMany({ where: projectWhere(createdById, id), data: { status: "ARCHIVED", archivedAt: new Date(), revision: { increment: 1 } } });
  if (!updated.count) throw new TRPCError({ code: "NOT_FOUND", message: "Campagnewizard niet gevonden in deze workspace." });
  return db.adsWizardProject.findFirst({ where: projectWhere(createdById, id) });
}

export async function resumeAdsWizardProject(db: PrismaClient, ctx: { user: { ownerUserId?: string; id: string } }, id: string) {
  const createdById = ownerId(ctx);
  const updated = await db.adsWizardProject.updateMany({ where: { ...projectWhere(createdById, id), status: "ARCHIVED" }, data: { status: "DRAFT", archivedAt: null, revision: { increment: 1 } } });
  if (!updated.count) throw new TRPCError({ code: "NOT_FOUND", message: "Gearchiveerd campagneconcept niet gevonden in deze workspace." });
  return db.adsWizardProject.findFirst({ where: projectWhere(createdById, id) });
}

export function wizardOwnerId(ctx: { user: { ownerUserId?: string; id: string } }) {
  return ownerId(ctx);
}
