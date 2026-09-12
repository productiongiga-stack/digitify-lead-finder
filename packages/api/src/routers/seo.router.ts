import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, mutationProcedure, protectedProcedure, router } from "../trpc";
import { recordSecurityAuditEvent } from "../lib/security-audit";

const keywordInput = z.object({
  keyword: z.string().trim().min(2).max(160),
  domainId: z.string().optional(),
  location: z.string().trim().max(120).optional(),
  language: z.string().trim().max(20).optional(),
  targetUrl: z.string().url().max(500).optional(),
  currentRank: z.number().int().min(1).max(1000).optional(),
  previousRank: z.number().int().min(1).max(1000).optional(),
});

function keywordKey(value: string, location?: string) {
  return `${value.trim().toLocaleLowerCase("nl-BE")}::${(location ?? "").trim().toLocaleLowerCase("nl-BE")}`;
}

function assertNotViewingAs(ctx: { user: { isViewingAs?: boolean } }) {
  if (ctx.user.isViewingAs) {
    throw new TRPCError({ code: "FORBIDDEN", message: "SEO-instellingen wijzigen kan niet tijdens accountweergave." });
  }
}

async function assertDomain(ctx: { db: any; user: { workspaceId?: string } }, domainId?: string) {
  if (!domainId) return;
  const domain = await ctx.db.domain.findFirst({ where: { id: domainId, createdById: ctx.user.workspaceId! }, select: { id: true } });
  if (!domain) throw new TRPCError({ code: "NOT_FOUND", message: "Domein niet gevonden in deze werkruimte." });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export const seoRouter = router({
  overview: protectedProcedure.query(async ({ ctx }) => {
    const workspaceId = ctx.user.workspaceId!;
    const [keywords, competitors, domains] = await Promise.all([
      ctx.db.seoKeyword.findMany({ where: { createdById: workspaceId }, orderBy: { updatedAt: "desc" }, take: 200, select: { id: true, keyword: true, currentRank: true, previousRank: true, status: true, domainId: true, updatedAt: true } }),
      ctx.db.seoCompetitor.findMany({ where: { createdById: workspaceId }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, name: true, url: true, notes: true, domainId: true, updatedAt: true } }),
      ctx.db.domain.findMany({ where: { createdById: workspaceId }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, domainName: true, healthScore: true, lastAnalyzedAt: true, analysisData: true, status: true } }),
    ]);
    const rankValues = keywords.map((item) => item.currentRank).filter((rank): rank is number => rank !== null);
    const improved = keywords.filter((item) => item.currentRank !== null && item.previousRank !== null && item.currentRank < item.previousRank).length;
    const declined = keywords.filter((item) => item.currentRank !== null && item.previousRank !== null && item.currentRank > item.previousRank).length;
    const domainMap = new Map(domains.map((domain) => [domain.id, domain]));
    const audits = domains.map((domain) => {
      const data = record(domain.analysisData);
      const score = typeof data.seoScore === "number" ? data.seoScore : domain.healthScore;
      return { id: domain.id, domainName: domain.domainName, status: domain.status, score, lastAnalyzedAt: domain.lastAnalyzedAt, hasAnalysis: Boolean(domain.lastAnalyzedAt || domain.analysisData) };
    });
    return {
      stats: { trackedKeywords: keywords.filter((item) => item.status === "TRACKING").length, averageRank: rankValues.length ? Math.round((rankValues.reduce((sum, rank) => sum + rank, 0) / rankValues.length) * 10) / 10 : null, improved, declined, domains: domains.length, auditedDomains: audits.filter((domain) => domain.hasAnalysis).length, competitors: competitors.length },
      keywords: keywords.map((item) => ({ ...item, domainName: item.domainId ? domainMap.get(item.domainId)?.domainName ?? "Onbekend domein" : "Alle domeinen" })),
      competitors: competitors.map((item) => ({ ...item, domainName: item.domainId ? domainMap.get(item.domainId)?.domainName ?? "Onbekend domein" : "Alle domeinen" })),
      audits,
      lastUpdated: new Date(),
    };
  }),

  createKeyword: adminProcedure.input(keywordInput).mutation(async ({ ctx, input }) => {
    assertNotViewingAs(ctx);
    await assertDomain(ctx, input.domainId);
    const created = await ctx.db.seoKeyword.create({ data: { createdById: ctx.user.workspaceId!, domainId: input.domainId, keyword: input.keyword.trim(), keywordKey: keywordKey(input.keyword, input.location), location: input.location?.trim() || null, language: input.language?.trim() || null, targetUrl: input.targetUrl, currentRank: input.currentRank, previousRank: input.previousRank, lastCheckedAt: input.currentRank ? new Date() : null }, select: { id: true, keyword: true, currentRank: true, status: true } });
    await recordSecurityAuditEvent(ctx.db, { workspaceId: ctx.user.workspaceId, actorUserId: ctx.user.actorUserId ?? ctx.user.id, targetUserId: ctx.user.id, action: "SEO_KEYWORD_CREATED", resource: "SeoKeyword", resourceId: created.id, result: "SUCCESS", requestId: ctx.requestId, metadata: { keyword: created.keyword } });
    return created;
  }),

  updateKeyword: adminProcedure.input(z.object({ id: z.string(), keyword: keywordInput.shape.keyword, domainId: z.string().optional(), location: z.string().trim().max(120).optional(), language: z.string().trim().max(20).optional(), targetUrl: z.string().url().max(500).optional(), currentRank: z.number().int().min(1).max(1000).nullable().optional(), previousRank: z.number().int().min(1).max(1000).nullable().optional(), status: z.enum(["TRACKING", "PAUSED"]).optional() })).mutation(async ({ ctx, input }) => {
    assertNotViewingAs(ctx);
    const existing = await ctx.db.seoKeyword.findFirst({ where: { id: input.id, createdById: ctx.user.workspaceId! }, select: { id: true } });
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Zoekwoord niet gevonden." });
    await assertDomain(ctx, input.domainId);
    return ctx.db.seoKeyword.update({ where: { id: input.id }, data: { keyword: input.keyword.trim(), keywordKey: keywordKey(input.keyword, input.location), domainId: input.domainId, location: input.location?.trim() || null, language: input.language?.trim() || null, targetUrl: input.targetUrl, currentRank: input.currentRank, previousRank: input.previousRank, status: input.status, lastCheckedAt: input.currentRank ? new Date() : undefined }, select: { id: true, keyword: true, currentRank: true, previousRank: true, status: true } });
  }),

  setKeywordStatus: mutationProcedure.input(z.object({ id: z.string(), status: z.enum(["TRACKING", "PAUSED"]) })).mutation(async ({ ctx, input }) => {
    const keyword = await ctx.db.seoKeyword.findFirst({ where: { id: input.id, createdById: ctx.user.workspaceId! }, select: { id: true } });
    if (!keyword) throw new TRPCError({ code: "NOT_FOUND", message: "Zoekwoord niet gevonden." });
    return ctx.db.seoKeyword.update({ where: { id: keyword.id }, data: { status: input.status }, select: { id: true, status: true } });
  }),

  deleteKeyword: mutationProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const keyword = await ctx.db.seoKeyword.findFirst({ where: { id: input.id, createdById: ctx.user.workspaceId! }, select: { id: true } });
    if (!keyword) throw new TRPCError({ code: "NOT_FOUND", message: "Zoekwoord niet gevonden." });
    return ctx.db.seoKeyword.delete({ where: { id: keyword.id }, select: { id: true } });
  }),

  createCompetitor: adminProcedure.input(z.object({ name: z.string().trim().min(2).max(160), url: z.string().url().max(500), domainId: z.string().optional(), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
    assertNotViewingAs(ctx);
    await assertDomain(ctx, input.domainId);
    return ctx.db.seoCompetitor.create({ data: { createdById: ctx.user.workspaceId!, domainId: input.domainId, name: input.name.trim(), url: input.url, notes: input.notes?.trim() || null }, select: { id: true, name: true, url: true, notes: true } });
  }),

  deleteCompetitor: mutationProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const competitor = await ctx.db.seoCompetitor.findFirst({ where: { id: input.id, createdById: ctx.user.workspaceId! }, select: { id: true } });
    if (!competitor) throw new TRPCError({ code: "NOT_FOUND", message: "Concurrent niet gevonden." });
    return ctx.db.seoCompetitor.delete({ where: { id: competitor.id }, select: { id: true } });
  }),
});
