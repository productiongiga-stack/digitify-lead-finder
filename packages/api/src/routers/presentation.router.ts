import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma, PrismaClient } from "@digitify/db";
import { router, mutationProcedure, protectedProcedure } from "../trpc";
import { loadAiBusinessProfile, businessProfileToContext } from "../lib/ai-business-profile";
import { loadAiProviderConfig } from "../lib/ai-provider-config";
import { OpenClawClient } from "@digitify/openclaw";

const workspaceIdFor = (user: { workspaceId?: string; id: string }) => user.workspaceId ?? user.id;
const slideInput = z.object({
  title: z.string().trim().max(200).optional(),
  body: z.string().max(10000).optional(),
  backgroundUrl: z.string().url().optional().or(z.literal("")),
  sourcePage: z.number().int().min(1).optional(),
  settings: z.record(z.unknown()).optional(),
});
const hotspotInput = z.object({
  slideId: z.string().min(1),
  targetSlideId: z.string().min(1),
  label: z.string().trim().max(120).optional(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().gt(0).max(1),
  height: z.number().gt(0).max(1),
});

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function assertPresentation(db: PrismaClient, workspaceId: string, id: string) {
  const presentation = await db.presentation.findFirst({ where: { id, workspaceId } });
  if (!presentation) throw new TRPCError({ code: "NOT_FOUND", message: "Presentatie niet gevonden." });
  return presentation;
}

export const presentationRouter = router({
  list: protectedProcedure.query(({ ctx }) => ctx.db.presentation.findMany({
    where: { workspaceId: workspaceIdFor(ctx.user!), status: { not: "TRASHED" } },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { slides: { orderBy: { orderIndex: "asc" }, take: 1, select: { id: true, backgroundUrl: true, title: true } } },
  })),

  get: protectedProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ ctx, input }) => {
    const presentation = await assertPresentation(ctx.db, workspaceIdFor(ctx.user!), input.id);
    return ctx.db.presentation.findUniqueOrThrow({
      where: { id: presentation.id },
      include: {
        slides: { orderBy: { orderIndex: "asc" }, include: { hotspots: { orderBy: { createdAt: "asc" } } } },
        shares: { where: { revokedAt: null }, orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
  }),

  create: mutationProcedure.input(z.object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(1000).optional(),
    sourceFileId: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const workspaceId = workspaceIdFor(ctx.user!);
    if (input.sourceFileId) {
      const file = await ctx.db.workspaceFile.findFirst({ where: { id: input.sourceFileId, createdById: ctx.user!.ownerUserId ?? workspaceId, deletedAt: null }, select: { id: true, contentType: true } });
      if (!file || file.contentType !== "application/pdf") throw new TRPCError({ code: "BAD_REQUEST", message: "Kies een geldig PDF-bestand uit deze workspace." });
    }
    return ctx.db.presentation.create({
      data: {
        workspaceId,
        createdById: ctx.user!.id,
        title: input.title,
        description: input.description,
        sourceFileId: input.sourceFileId,
      },
    });
  }),

  update: mutationProcedure.input(z.object({ id: z.string(), title: z.string().trim().min(1).max(200).optional(), description: z.string().max(1000).optional(), status: z.enum(["DRAFT", "PUBLISHED", "TRASHED"]).optional(), settings: z.record(z.unknown()).optional() })).mutation(async ({ ctx, input }) => {
    const presentation = await assertPresentation(ctx.db, workspaceIdFor(ctx.user!), input.id);
    return ctx.db.presentation.update({ where: { id: presentation.id }, data: { title: input.title, description: input.description, status: input.status, settings: input.settings as Prisma.InputJsonObject | undefined } });
  }),

  addSlide: mutationProcedure.input(z.object({ presentationId: z.string(), ...slideInput.shape })).mutation(async ({ ctx, input }) => {
    await assertPresentation(ctx.db, workspaceIdFor(ctx.user!), input.presentationId);
    const last = await ctx.db.presentationSlide.findFirst({ where: { presentationId: input.presentationId }, orderBy: { orderIndex: "desc" }, select: { orderIndex: true } });
    return ctx.db.presentationSlide.create({ data: { presentationId: input.presentationId, orderIndex: (last?.orderIndex ?? -1) + 1, title: input.title, body: input.body, backgroundUrl: input.backgroundUrl || null, sourcePage: input.sourcePage, settings: input.settings as Prisma.InputJsonObject | undefined } });
  }),

  seedFromPdf: mutationProcedure.input(z.object({ presentationId: z.string(), pageCount: z.number().int().min(1).max(200) })).mutation(async ({ ctx, input }) => {
    await assertPresentation(ctx.db, workspaceIdFor(ctx.user!), input.presentationId);
    const existing = await ctx.db.presentationSlide.count({ where: { presentationId: input.presentationId } });
    if (existing > 0) return { created: 0 };
    const slides = Array.from({ length: input.pageCount }, (_, index) => ({ presentationId: input.presentationId, orderIndex: index, sourcePage: index + 1, title: `Pagina ${index + 1}` }));
    await ctx.db.presentationSlide.createMany({ data: slides });
    return { created: slides.length };
  }),

  updateSlide: mutationProcedure.input(z.object({ id: z.string(), ...slideInput.shape, orderIndex: z.number().int().min(0).optional() })).mutation(async ({ ctx, input }) => {
    const workspaceId = workspaceIdFor(ctx.user!);
    const slide = await ctx.db.presentationSlide.findFirst({ where: { id: input.id, presentation: { workspaceId } }, select: { id: true } });
    if (!slide) throw new TRPCError({ code: "NOT_FOUND", message: "Slide niet gevonden." });
    return ctx.db.presentationSlide.update({ where: { id: input.id }, data: { title: input.title, body: input.body, backgroundUrl: input.backgroundUrl || null, sourcePage: input.sourcePage, settings: input.settings as Prisma.InputJsonObject | undefined, orderIndex: input.orderIndex } });
  }),

  deleteSlide: mutationProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const slide = await ctx.db.presentationSlide.findFirst({ where: { id: input.id, presentation: { workspaceId: workspaceIdFor(ctx.user!) } }, select: { id: true } });
    if (!slide) throw new TRPCError({ code: "NOT_FOUND", message: "Slide niet gevonden." });
    return ctx.db.presentationSlide.delete({ where: { id: input.id } });
  }),

  createHotspot: mutationProcedure.input(hotspotInput).mutation(async ({ ctx, input }) => {
    const workspaceId = workspaceIdFor(ctx.user!);
    const slides = await ctx.db.presentationSlide.findMany({ where: { id: { in: [input.slideId, input.targetSlideId] }, presentation: { workspaceId } }, select: { id: true } });
    if (slides.length !== 2) throw new TRPCError({ code: "BAD_REQUEST", message: "Beide slides moeten in dezelfde presentatie staan." });
    return ctx.db.presentationHotspot.create({ data: input });
  }),

  deleteHotspot: mutationProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const hotspot = await ctx.db.presentationHotspot.findFirst({ where: { id: input.id, slide: { presentation: { workspaceId: workspaceIdFor(ctx.user!) } } }, select: { id: true } });
    if (!hotspot) throw new TRPCError({ code: "NOT_FOUND", message: "Knop niet gevonden." });
    return ctx.db.presentationHotspot.delete({ where: { id: input.id } });
  }),

  createShare: mutationProcedure.input(z.object({ presentationId: z.string(), expiresAt: z.coerce.date().optional() })).mutation(async ({ ctx, input }) => {
    await assertPresentation(ctx.db, workspaceIdFor(ctx.user!), input.presentationId);
    const token = randomBytes(32).toString("base64url");
    await ctx.db.presentationShare.create({ data: { presentationId: input.presentationId, tokenHash: tokenHash(token), expiresAt: input.expiresAt } });
    return { token };
  }),

  revokeShare: mutationProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const share = await ctx.db.presentationShare.findFirst({ where: { id: input.id, presentation: { workspaceId: workspaceIdFor(ctx.user!) } }, select: { id: true } });
    if (!share) throw new TRPCError({ code: "NOT_FOUND", message: "Deellink niet gevonden." });
    return ctx.db.presentationShare.update({ where: { id: input.id }, data: { revokedAt: new Date() } });
  }),

  generateOutline: mutationProcedure.input(z.object({ presentationId: z.string(), brief: z.string().trim().min(10).max(4000) })).mutation(async ({ ctx, input }) => {
    const workspaceId = workspaceIdFor(ctx.user!);
    await assertPresentation(ctx.db, workspaceId, input.presentationId);
    const profile = await loadAiBusinessProfile(ctx.db, workspaceId);
    const config = await loadAiProviderConfig(ctx.db, workspaceId);
    if (!config.apiKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Koppel eerst een AI-provider via Instellingen → Integraties." });
    const client = new OpenClawClient({ ...config, maxTokens: 1800, timeoutMs: 45_000 });
    const raw = await client.completeRaw(
      "Je maakt presentatiestructuren. Gebruik alleen de bedrijfscontext en opdracht. Verzin geen cijfers, klanten, resultaten of marktfeiten. Geef uitsluitend JSON met slides: een array van maximaal 12 objecten met title, body en notes. Schrijf compact in het Nederlands.",
      JSON.stringify({ brief: input.brief, businessProfile: businessProfileToContext(profile) }),
      1800,
    );
    const match = raw.match(/\{[\s\S]*\}/);
    let parsed: { slides?: Array<{ title?: string; body?: string; notes?: string }> } = {};
    try { parsed = match ? JSON.parse(match[0]) : {}; } catch { parsed = {}; }
    const slides = (Array.isArray(parsed.slides) ? parsed.slides : []).slice(0, 12).map((slide) => ({
      title: String(slide.title || "Nieuwe slide").trim().slice(0, 200),
      body: String(slide.body || "").trim().slice(0, 10000),
      notes: String(slide.notes || "").trim().slice(0, 1000),
    }));
    if (!slides.length) throw new TRPCError({ code: "BAD_GATEWAY", message: "De AI gaf geen bruikbare slides terug. Probeer een concretere opdracht." });
    return { slides, profileVersion: profile.version, profileHash: profile.hash, model: config.model };
  }),
});

export { tokenHash };
