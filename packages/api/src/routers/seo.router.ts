import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, mutationProcedure, protectedProcedure, router } from "../trpc";
import { recordSecurityAuditEvent } from "../lib/security-audit";
import { Prisma } from "@digitify/db";
import { loadAiBusinessProfile } from "../lib/ai-business-profile";
import { loadSeoConnectorStatus, listSearchConsoleProperties, runSeoResearch, seoResearchKey, type SeoResearchInput } from "../lib/seo-research";
import { resolveSettingDbKey, workspaceScopeFromUser } from "../lib/workspace-settings";
import { protectSettingValue } from "@digitify/db";

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

async function assertDomain(ctx: { db: any; user: { workspaceId?: string; ownerUserId?: string } }, domainId?: string) {
  if (!domainId) return;
  const domain = await ctx.db.domain.findFirst({ where: { id: domainId, createdById: ctx.user.ownerUserId! }, select: { id: true } });
  if (!domain) throw new TRPCError({ code: "NOT_FOUND", message: "Domein niet gevonden in deze werkruimte." });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

const researchInput = z.object({
  domainId: z.string().optional(),
  seeds: z.array(z.string().trim().min(2).max(160)).min(1).max(20),
  language: z.enum(["nl", "fr"]).default("nl"),
  location: z.string().trim().min(2).max(120).default("BE"),
  providers: z.array(z.enum(["GOOGLE_ADS", "SEARCH_CONSOLE"])).min(1).default(["GOOGLE_ADS"]),
  targetUrl: z.string().url().max(500).optional(),
});

const jsonValue = (value: unknown) => value as Prisma.InputJsonValue;

export const seoRouter = router({
  overview: protectedProcedure.query(async ({ ctx }) => {
    const workspaceId = ctx.user.workspaceId!;
    const [keywords, competitors, domains, researchRuns, clusters, briefs] = await Promise.all([
      ctx.db.seoKeyword.findMany({ where: { createdById: ctx.user.ownerUserId! }, orderBy: { updatedAt: "desc" }, take: 200, select: { id: true, keyword: true, currentRank: true, previousRank: true, status: true, source: true, intent: true, clusterId: true, domainId: true, location: true, language: true, targetUrl: true, updatedAt: true } }),
      ctx.db.seoCompetitor.findMany({ where: { createdById: ctx.user.ownerUserId! }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, name: true, url: true, notes: true, domainId: true, updatedAt: true } }),
      ctx.db.domain.findMany({ where: { createdById: ctx.user.ownerUserId! }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, domainName: true, healthScore: true, lastAnalyzedAt: true, analysisData: true, status: true } }),
      ctx.db.seoResearchRun.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, status: true, provider: true, language: true, location: true, seeds: true, results: true, error: true, createdAt: true, completedAt: true } }),
      ctx.db.seoKeywordCluster.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, name: true, intent: true, targetUrl: true, keywords: true, notes: true, updatedAt: true } }),
      ctx.db.seoContentBrief.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, title: true, status: true, targetUrl: true, clusterId: true, domainId: true, brief: true, profileHash: true, profileVersion: true, updatedAt: true } }),
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
      stats: { trackedKeywords: keywords.filter((item) => item.status === "TRACKING").length, averageRank: rankValues.length ? Math.round((rankValues.reduce((sum, rank) => sum + rank, 0) / rankValues.length) * 10) / 10 : null, improved, declined, domains: domains.length, auditedDomains: audits.filter((domain) => domain.hasAnalysis).length, competitors: competitors.length, researchRuns: researchRuns.length, clusters: clusters.length, briefs: briefs.length },
      keywords: keywords.map((item) => ({ ...item, domainName: item.domainId ? domainMap.get(item.domainId)?.domainName ?? "Onbekend domein" : "Alle domeinen" })),
      competitors: competitors.map((item) => ({ ...item, domainName: item.domainId ? domainMap.get(item.domainId)?.domainName ?? "Onbekend domein" : "Alle domeinen" })),
      audits,
      researchRuns,
      clusters,
      briefs,
      lastUpdated: new Date(),
    };
  }),

  createKeyword: adminProcedure.input(keywordInput).mutation(async ({ ctx, input }) => {
    assertNotViewingAs(ctx);
    await assertDomain(ctx, input.domainId);
    const existing = await ctx.db.seoKeyword.findFirst({ where: { createdById: ctx.user.ownerUserId!, keywordKey: keywordKey(input.keyword, input.location) }, select: { id: true, keyword: true, currentRank: true, status: true } });
    if (existing) return { ...existing, outcome: "reused" as const };
    const created = await ctx.db.seoKeyword.create({ data: { createdById: ctx.user.ownerUserId!, domainId: input.domainId, keyword: input.keyword.trim(), keywordKey: keywordKey(input.keyword, input.location), location: input.location?.trim() || null, language: input.language?.trim() || null, targetUrl: input.targetUrl, currentRank: input.currentRank, previousRank: input.previousRank, lastCheckedAt: input.currentRank ? new Date() : null, source: "MANUAL" }, select: { id: true, keyword: true, currentRank: true, status: true } });
    await recordSecurityAuditEvent(ctx.db, { workspaceId: ctx.user.workspaceId, actorUserId: ctx.user.actorUserId ?? ctx.user.id, targetUserId: ctx.user.id, action: "SEO_KEYWORD_CREATED", resource: "SeoKeyword", resourceId: created.id, result: "SUCCESS", requestId: ctx.requestId, metadata: { keyword: created.keyword } });
    return { ...created, outcome: "created" as const };
  }),

  updateKeyword: adminProcedure.input(z.object({ id: z.string(), keyword: keywordInput.shape.keyword, domainId: z.string().optional(), location: z.string().trim().max(120).optional(), language: z.string().trim().max(20).optional(), targetUrl: z.string().url().max(500).optional(), currentRank: z.number().int().min(1).max(1000).nullable().optional(), previousRank: z.number().int().min(1).max(1000).nullable().optional(), status: z.enum(["TRACKING", "PAUSED"]).optional() })).mutation(async ({ ctx, input }) => {
    assertNotViewingAs(ctx);
    const existing = await ctx.db.seoKeyword.findFirst({ where: { id: input.id, createdById: ctx.user.ownerUserId! }, select: { id: true } });
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Zoekwoord niet gevonden." });
    await assertDomain(ctx, input.domainId);
    return ctx.db.seoKeyword.update({ where: { id: input.id }, data: { keyword: input.keyword.trim(), keywordKey: keywordKey(input.keyword, input.location), domainId: input.domainId, location: input.location?.trim() || null, language: input.language?.trim() || null, targetUrl: input.targetUrl, currentRank: input.currentRank, previousRank: input.previousRank, status: input.status, lastCheckedAt: input.currentRank ? new Date() : undefined }, select: { id: true, keyword: true, currentRank: true, previousRank: true, status: true } });
  }),

  setKeywordStatus: mutationProcedure.input(z.object({ id: z.string(), status: z.enum(["TRACKING", "PAUSED"]) })).mutation(async ({ ctx, input }) => {
    const keyword = await ctx.db.seoKeyword.findFirst({ where: { id: input.id, createdById: ctx.user.ownerUserId! }, select: { id: true } });
    if (!keyword) throw new TRPCError({ code: "NOT_FOUND", message: "Zoekwoord niet gevonden." });
    return ctx.db.seoKeyword.update({ where: { id: keyword.id }, data: { status: input.status }, select: { id: true, status: true } });
  }),

  deleteKeyword: mutationProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const keyword = await ctx.db.seoKeyword.findFirst({ where: { id: input.id, createdById: ctx.user.ownerUserId! }, select: { id: true } });
    if (!keyword) throw new TRPCError({ code: "NOT_FOUND", message: "Zoekwoord niet gevonden." });
    return ctx.db.seoKeyword.delete({ where: { id: keyword.id }, select: { id: true } });
  }),

  createCompetitor: adminProcedure.input(z.object({ name: z.string().trim().min(2).max(160), url: z.string().url().max(500), domainId: z.string().optional(), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
    assertNotViewingAs(ctx);
    await assertDomain(ctx, input.domainId);
    return ctx.db.seoCompetitor.create({ data: { createdById: ctx.user.ownerUserId!, domainId: input.domainId, name: input.name.trim(), url: input.url, notes: input.notes?.trim() || null }, select: { id: true, name: true, url: true, notes: true } });
  }),

  deleteCompetitor: mutationProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const competitor = await ctx.db.seoCompetitor.findFirst({ where: { id: input.id, createdById: ctx.user.ownerUserId! }, select: { id: true } });
    if (!competitor) throw new TRPCError({ code: "NOT_FOUND", message: "Concurrent niet gevonden." });
    return ctx.db.seoCompetitor.delete({ where: { id: competitor.id }, select: { id: true } });
  }),

  connectorStatus: protectedProcedure.query(({ ctx }) => loadSeoConnectorStatus(ctx.db, { workspaceId: ctx.user.workspaceId!, memberId: ctx.user.id })),

  listSearchConsoleProperties: protectedProcedure.query(({ ctx }) => listSearchConsoleProperties(ctx.db, { workspaceId: ctx.user.workspaceId!, memberId: ctx.user.id })),

  selectSearchConsoleProperty: adminProcedure.input(z.object({ property: z.string().trim().min(3).max(500) })).mutation(async ({ ctx, input }) => {
    assertNotViewingAs(ctx);
    const scope = workspaceScopeFromUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
    const properties = await listSearchConsoleProperties(ctx.db, { workspaceId: scope.workspaceId, memberId: scope.memberId });
    if (!properties.some((property) => property.siteUrl === input.property)) throw new TRPCError({ code: "FORBIDDEN", message: "Deze Search Console-property is niet beschikbaar voor de gekoppelde Google-account." });
    const key = resolveSettingDbKey(scope, "seo.google_search_console_property");
    return ctx.db.setting.upsert({ where: { key }, update: { value: protectSettingValue("seo.google_search_console_property", input.property) as any }, create: { key, value: protectSettingValue("seo.google_search_console_property", input.property) as any } });
  }),

  listResearchRuns: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).optional()).query(({ ctx, input }) =>
    ctx.db.seoResearchRun.findMany({ where: { workspaceId: ctx.user.workspaceId! }, orderBy: { createdAt: "desc" }, take: input?.limit || 20 }),
  ),

  getResearchRun: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const run = await ctx.db.seoResearchRun.findFirst({ where: { id: input.id, workspaceId: ctx.user.workspaceId! }, include: { ideas: { orderBy: { searchVolume: "desc" } } } });
    if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Researchrun niet gevonden." });
    return run;
  }),

  startKeywordResearch: mutationProcedure.input(researchInput).mutation(async ({ ctx, input }) => {
    assertNotViewingAs(ctx);
    await assertDomain(ctx, input.domainId);
    const workspaceId = ctx.user.workspaceId!;
    const key = `${workspaceId}:${seoResearchKey(input)}`;
    const existing = await ctx.db.seoResearchRun.findUnique({ where: { idempotencyKey: key } });
    if (existing && ["PENDING", "RUNNING", "COMPLETED"].includes(existing.status)) return existing;
    const run = existing
      ? await ctx.db.seoResearchRun.update({ where: { id: existing.id }, data: { status: "PENDING", error: null, attempts: 0, completedAt: null } })
      : await ctx.db.seoResearchRun.create({ data: { workspaceId, createdById: ctx.user.id, domainId: input.domainId, provider: input.providers.join("+") || "GOOGLE_ADS", language: input.language, location: input.location, seeds: jsonValue(input.seeds), options: jsonValue({ targetUrl: input.targetUrl, providers: input.providers }), idempotencyKey: key } });
    try {
      await ctx.db.seoResearchRun.update({ where: { id: run.id }, data: { status: "RUNNING", attempts: { increment: 1 }, startedAt: new Date() } });
      const result = await runSeoResearch(ctx.db, { ...input, workspaceId, memberId: ctx.user.id } as SeoResearchInput);
      const savedIdeas = await ctx.db.$transaction(result.ideas.map((idea) => ctx.db.seoKeywordIdea.upsert({
        where: { workspaceId_keywordKey_language_location_source: { workspaceId, keywordKey: idea.keywordKey, language: idea.language, location: idea.location, source: idea.source } },
        update: { researchRunId: run.id, intent: idea.intent, searchVolume: idea.searchVolume, competition: idea.competition, cpcCents: idea.cpcCents, impressions: idea.impressions, clicks: idea.clicks, ctr: idea.ctr, averagePosition: idea.averagePosition, targetUrl: idea.targetUrl, evidence: idea.evidence ? jsonValue(idea.evidence) : undefined },
        create: { workspaceId, createdById: ctx.user.id, researchRunId: run.id, keyword: idea.keyword, keywordKey: idea.keywordKey, source: idea.source, language: idea.language, location: idea.location, intent: idea.intent, searchVolume: idea.searchVolume, competition: idea.competition, cpcCents: idea.cpcCents, impressions: idea.impressions, clicks: idea.clicks, ctr: idea.ctr, averagePosition: idea.averagePosition, targetUrl: idea.targetUrl, evidence: idea.evidence ? jsonValue(idea.evidence) : undefined },
      })));
      const completed = await ctx.db.seoResearchRun.update({ where: { id: run.id }, data: { status: "COMPLETED", results: jsonValue({ count: savedIdeas.length, errors: result.errors }), error: result.errors.length ? result.errors.join(" · ") : null, completedAt: new Date(), leaseUntil: null } });
      return { ...completed, ideas: savedIdeas };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Keyword research mislukt.";
      await ctx.db.seoResearchRun.update({ where: { id: run.id }, data: { status: message.includes("Koppel") || message.includes("configureer") ? "BLOCKED" : "FAILED", error: message, leaseUntil: null } });
      throw error;
    }
  }),

  saveResearchResult: mutationProcedure.input(z.object({ ideaId: z.string(), domainId: z.string().optional(), targetUrl: z.string().url().max(500).optional() })).mutation(async ({ ctx, input }) => {
    assertNotViewingAs(ctx);
    const idea = await ctx.db.seoKeywordIdea.findFirst({ where: { id: input.ideaId, workspaceId: ctx.user.workspaceId! } });
    if (!idea) throw new TRPCError({ code: "NOT_FOUND", message: "Keywordresultaat niet gevonden." });
    await assertDomain(ctx, input.domainId);
    const existing = await ctx.db.seoKeyword.findFirst({ where: { createdById: ctx.user.ownerUserId!, keywordKey: keywordKey(idea.keyword, idea.location) } });
    if (existing) return { lead: existing, outcome: "reused" as const };
    const created = await ctx.db.seoKeyword.create({ data: { createdById: ctx.user.ownerUserId!, domainId: input.domainId, keyword: idea.keyword, keywordKey: keywordKey(idea.keyword, idea.location), location: idea.location, language: idea.language, targetUrl: input.targetUrl || idea.targetUrl, source: idea.source, intent: idea.intent, currentRank: idea.averagePosition ? Math.round(idea.averagePosition) : null, lastCheckedAt: idea.averagePosition ? new Date() : null } });
    return { lead: created, outcome: "created" as const };
  }),

  createCluster: mutationProcedure.input(z.object({ name: z.string().trim().min(2).max(160), intent: z.enum(["INFORMATIONAL", "COMMERCIAL", "TRANSACTIONAL", "NAVIGATIONAL", "LOCAL", "UNKNOWN"]).default("UNKNOWN"), targetUrl: z.string().url().max(500).optional(), keywordIds: z.array(z.string()).max(100).default([]), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
    assertNotViewingAs(ctx);
    const ideas = input.keywordIds.length ? await ctx.db.seoKeywordIdea.findMany({ where: { id: { in: input.keywordIds }, workspaceId: ctx.user.workspaceId! }, select: { id: true, keyword: true } }) : [];
    if (ideas.length !== input.keywordIds.length) throw new TRPCError({ code: "NOT_FOUND", message: "Een of meer keywords horen niet bij deze workspace." });
    const cluster = await ctx.db.seoKeywordCluster.create({ data: { workspaceId: ctx.user.workspaceId!, createdById: ctx.user.id, name: input.name, intent: input.intent, targetUrl: input.targetUrl, keywords: jsonValue(ideas.map((idea) => idea.keyword)), notes: input.notes || null } });
    if (input.keywordIds.length) await ctx.db.seoKeyword.updateMany({ where: { id: { in: input.keywordIds }, createdById: ctx.user.ownerUserId! }, data: { clusterId: cluster.id } });
    return cluster;
  }),

  generateContentBrief: mutationProcedure.input(z.object({ clusterId: z.string(), domainId: z.string().optional(), targetUrl: z.string().url().max(500).optional() })).mutation(async ({ ctx, input }) => {
    assertNotViewingAs(ctx);
    const cluster = await ctx.db.seoKeywordCluster.findFirst({ where: { id: input.clusterId, workspaceId: ctx.user.workspaceId! } });
    if (!cluster) throw new TRPCError({ code: "NOT_FOUND", message: "Keywordcluster niet gevonden." });
    await assertDomain(ctx, input.domainId);
    const profile = await loadAiBusinessProfile(ctx.db, ctx.user.workspaceId!);
    const keywords = Array.isArray(cluster.keywords) ? cluster.keywords.map(String).slice(0, 50) : [];
    const brief = { summary: `Content rond ${cluster.name}`, primaryKeyword: keywords[0] || cluster.name, secondaryKeywords: keywords.slice(1), suggestedTitle: `${cluster.name} | ${profile.companyName}`, suggestedMetaDescription: `Ontdek ${cluster.name} en hoe ${profile.companyName} kan helpen.`, outline: ["Introductie", "Belangrijkste voordelen", "Praktische aanpak", "Veelgestelde vragen", "Volgende stap"], internalLinkIdeas: [], cta: profile.salesGoal || "Plan een gesprek", generatedBy: "SEO-template-v1" };
    return ctx.db.seoContentBrief.create({ data: { workspaceId: ctx.user.workspaceId!, createdById: ctx.user.id, clusterId: cluster.id, domainId: input.domainId, title: cluster.name, targetUrl: input.targetUrl || cluster.targetUrl, brief: jsonValue(brief), profileHash: profile.hash, profileVersion: profile.version } });
  }),

  handoffToAds: mutationProcedure.input(z.object({ destination: z.enum(["GOOGLE", "META"]), clusterId: z.string(), targetUrl: z.string().url().max(500).optional(), campaignContext: z.string().trim().max(1000).optional() })).mutation(async ({ ctx, input }) => {
    const cluster = await ctx.db.seoKeywordCluster.findFirst({ where: { id: input.clusterId, workspaceId: ctx.user.workspaceId! } });
    if (!cluster) throw new TRPCError({ code: "NOT_FOUND", message: "Keywordcluster niet gevonden." });
    const keywords = Array.isArray(cluster.keywords) ? cluster.keywords.map(String).filter(Boolean).slice(0, 80) : [];
    const params = new URLSearchParams({ seoClusterId: cluster.id, targetUrl: input.targetUrl || cluster.targetUrl || "", seoContext: input.campaignContext || cluster.name, seoKeywords: keywords.join("\n") });
    return { destination: input.destination, redirectUrl: input.destination === "GOOGLE" ? `/google-ads?${params.toString()}` : `/meta-ads?${params.toString()}`, keywords, context: input.campaignContext || cluster.name, requiresApproval: true };
  }),
});
