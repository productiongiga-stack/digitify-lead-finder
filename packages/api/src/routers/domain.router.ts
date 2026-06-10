import { z } from "zod";
import { router, protectedProcedure, mutationProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@digitify/db";
import { analyzeWebsite } from "@digitify/connectors";
import { assertLeadAccess } from "../lib/tenant";
import { isValidDomainName, normalizeDomainName } from "../lib/domain-name";
import {
  deriveExpiryStatus,
  enrichDomainRecord,
  persistDomainAnalysis,
  syncWorkspaceDomainExpiry,
} from "../lib/domain-insights";

const domainNameSchema = z
  .string()
  .min(1, "Domeinnaam is verplicht.")
  .transform((value) => normalizeDomainName(value))
  .refine(isValidDomainName, {
    message: "Voer een geldige domeinnaam in, bijvoorbeeld voorbeeld.be.",
  });

const domainInclude: Prisma.DomainInclude = {
  lead: {
    select: {
      id: true,
      companyName: true,
      website: true,
      enrichmentData: {
        where: {
          OR: [{ source: "domain_analysis" }, { source: { startsWith: "website_tracker:" } }],
        },
        orderBy: { fetchedAt: "desc" },
        select: { data: true, fetchedAt: true, source: true },
      },
    },
  },
};

async function assertDomainNameAvailable(
  db: Parameters<typeof assertLeadAccess>[0],
  workspaceId: string,
  domainName: string,
  excludeId?: string,
) {
  const existing = await db.domain.findFirst({
    where: {
      createdById: workspaceId,
      domainName,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Domein "${domainName}" staat al in je lijst.`,
    });
  }
}

function mapDomainWriteError(error: unknown, domainName: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Domein "${domainName}" staat al in je lijst.`,
    });
  }
  throw error;
}

async function resolveDomainForWorkspace(
  db: Parameters<typeof assertLeadAccess>[0],
  workspaceId: string,
  input: { id?: string; domainName?: string },
) {
  if (input.id) {
    const domain = await db.domain.findFirst({
      where: { id: input.id, createdById: workspaceId },
      select: { id: true, domainName: true, leadId: true },
    });
    if (!domain) throw new TRPCError({ code: "NOT_FOUND", message: "Domein niet gevonden" });
    return domain;
  }
  if (input.domainName) {
    const domain = await db.domain.findFirst({
      where: { domainName: input.domainName, createdById: workspaceId },
      select: { id: true, domainName: true, leadId: true },
    });
    if (!domain) throw new TRPCError({ code: "NOT_FOUND", message: "Domein niet gevonden" });
    return domain;
  }
  throw new TRPCError({ code: "BAD_REQUEST", message: "Domein-id of -naam is verplicht." });
}

export const domainRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          status: z.string().optional(),
          search: z.string().trim().max(120).optional(),
          sort: z.enum(["updatedAt", "domainName", "expiresAt", "healthScore", "lastAnalyzedAt"]).default("updatedAt"),
          sortDir: z.enum(["asc", "desc"]).default("desc"),
          page: z.number().min(1).default(1),
          pageSize: z.number().min(1).max(100).default(24),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId!;
      await syncWorkspaceDomainExpiry(ctx.db, workspaceId);

      const {
        status,
        search,
        sort = "updatedAt",
        sortDir = "desc",
        page = 1,
        pageSize = 24,
      } = input ?? {};

      const where: Prisma.DomainWhereInput = { createdById: workspaceId };
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { domainName: { contains: search, mode: "insensitive" } },
          { registrar: { contains: search, mode: "insensitive" } },
          { notes: { contains: search, mode: "insensitive" } },
          { lead: { companyName: { contains: search, mode: "insensitive" } } },
        ];
      }

      const orderBy: Prisma.DomainOrderByWithRelationInput =
        sort === "domainName"
          ? { domainName: sortDir }
          : sort === "expiresAt"
            ? { expiresAt: sortDir }
            : sort === "healthScore"
              ? { healthScore: sortDir }
              : sort === "lastAnalyzedAt"
                ? { lastAnalyzedAt: sortDir }
                : { updatedAt: sortDir };

      const [domains, total] = await Promise.all([
        ctx.db.domain.findMany({
          where,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: domainInclude,
        }),
        ctx.db.domain.count({ where }),
      ]);

      return {
        domains: domains.map((domain) => enrichDomainRecord(domain)),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    }),

  getPortfolioStats: protectedProcedure.query(async ({ ctx }) => {
    const workspaceId = ctx.user.workspaceId!;
    await syncWorkspaceDomainExpiry(ctx.db, workspaceId);

    const domains = await ctx.db.domain.findMany({
      where: { createdById: workspaceId },
      include: domainInclude,
    });
    const enriched = domains.map((domain) => enrichDomainRecord(domain));

    return {
      total: enriched.length,
      active: enriched.filter((item) => item.status === "ACTIVE").length,
      expiring: enriched.filter((item) => item.status === "EXPIRING").length,
      expired: enriched.filter((item) => item.status === "EXPIRED").length,
      online: enriched.filter((item) => item.websiteStatus === "online").length,
      slow: enriched.filter((item) => item.websiteStatus === "slow").length,
      offline: enriched.filter((item) => item.websiteStatus === "offline").length,
      unknown: enriched.filter((item) => item.websiteStatus === "unknown").length,
      totalVisitors: enriched.reduce((sum, item) => sum + item.uniqueVisitors, 0),
      totalPageviews: enriched.reduce((sum, item) => sum + item.pageviews, 0),
      avgHealthScore:
        enriched.length > 0
          ? Math.round(enriched.reduce((sum, item) => sum + item.healthScore, 0) / enriched.length)
          : 0,
      needsAnalysis: enriched.filter((item) => !item.lastAnalyzedAt).length,
      withoutLead: enriched.filter((item) => !item.leadId).length,
      expiringSoon: enriched
        .filter((item) => item.status === "EXPIRING" && item.expiresAt)
        .sort((a, b) => new Date(a.expiresAt!).getTime() - new Date(b.expiresAt!).getTime())
        .slice(0, 5)
        .map((item) => ({
          id: item.id,
          domainName: item.domainName,
          expiresAt: item.expiresAt,
          leadName: item.lead?.companyName ?? null,
        })),
    };
  }),

  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const domain = await ctx.db.domain.findFirst({
      where: { id: input.id, createdById: ctx.user.workspaceId! },
      include: domainInclude,
    });

    if (!domain) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Domein niet gevonden" });
    }

    return enrichDomainRecord(domain);
  }),

  create: mutationProcedure
    .input(
      z.object({
        domainName: domainNameSchema,
        registrar: z.string().optional(),
        registeredAt: z.string().or(z.date()).optional(),
        expiresAt: z.string().or(z.date()).optional(),
        notes: z.string().optional(),
        leadId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId!;
      if (input.leadId) await assertLeadAccess(ctx.db, workspaceId, input.leadId);
      await assertDomainNameAvailable(ctx.db, workspaceId, input.domainName);

      const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
      const status = deriveExpiryStatus(expiresAt);

      try {
        return await ctx.db.domain.create({
          data: {
            domainName: input.domainName,
            registrar: input.registrar || null,
            registeredAt: input.registeredAt ? new Date(input.registeredAt) : null,
            expiresAt,
            status,
            notes: input.notes || null,
            leadId: input.leadId || null,
            createdById: workspaceId,
          },
        });
      } catch (error) {
        mapDomainWriteError(error, input.domainName);
      }
    }),

  createFromLead: mutationProcedure
    .input(z.object({ leadId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId!;
      await assertLeadAccess(ctx.db, workspaceId, input.leadId);
      const lead = await ctx.db.lead.findFirst({
        where: { id: input.leadId, createdById: workspaceId },
        select: { id: true, website: true },
      });
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead niet gevonden." });
      const website = String(lead.website || "").trim();
      if (!website) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Deze lead heeft geen website-URL." });
      }

      let hostname = "";
      try {
        hostname = normalizeDomainName(new URL(website.startsWith("http") ? website : `https://${website}`).hostname);
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Kon geen geldige domeinnaam uit de lead-website halen." });
      }

      const existing = await ctx.db.domain.findFirst({
        where: { createdById: workspaceId, domainName: hostname },
      });
      if (existing) {
        if (!existing.leadId) {
          return ctx.db.domain.update({
            where: { id: existing.id },
            data: { leadId: input.leadId },
          });
        }
        return existing;
      }

      return ctx.db.domain.create({
        data: {
          domainName: hostname,
          leadId: input.leadId,
          createdById: workspaceId,
          status: "ACTIVE",
        },
      });
    }),

  update: mutationProcedure
    .input(
      z.object({
        id: z.string(),
        domainName: domainNameSchema.optional(),
        registrar: z.string().optional(),
        registeredAt: z.string().or(z.date()).optional(),
        expiresAt: z.string().or(z.date()).optional(),
        status: z.enum(["ACTIVE", "EXPIRING", "EXPIRED", "TRANSFERRED"]).optional(),
        sslStatus: z.enum(["VALID", "EXPIRED", "NONE", "UNKNOWN"]).optional(),
        notes: z.string().optional(),
        leadId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await ctx.db.domain.findFirst({
        where: { id, createdById: ctx.user.workspaceId! },
        select: { id: true, status: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Domein niet gevonden" });
      const workspaceId = ctx.user.workspaceId!;
      if (data.leadId) await assertLeadAccess(ctx.db, workspaceId, data.leadId);
      if (data.domainName !== undefined) {
        await assertDomainNameAvailable(ctx.db, workspaceId, data.domainName, id);
      }

      const updateData: Prisma.DomainUpdateInput = {};
      if (data.domainName !== undefined) updateData.domainName = data.domainName;
      if (data.registrar !== undefined) updateData.registrar = data.registrar || null;
      if (data.registeredAt !== undefined) {
        updateData.registeredAt = data.registeredAt ? new Date(data.registeredAt) : null;
      }
      if (data.expiresAt !== undefined) {
        const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
        updateData.expiresAt = expiresAt;
        if (data.status === undefined) {
          updateData.status = deriveExpiryStatus(expiresAt, existing.status);
        }
      }
      if (data.status !== undefined) updateData.status = data.status;
      if (data.sslStatus !== undefined) updateData.sslStatus = data.sslStatus;
      if (data.notes !== undefined) updateData.notes = data.notes || null;
      if (data.leadId !== undefined) {
        updateData.lead = data.leadId ? { connect: { id: data.leadId } } : { disconnect: true };
      }

      try {
        return await ctx.db.domain.update({ where: { id }, data: updateData });
      } catch (error) {
        if (typeof data.domainName === "string") {
          mapDomainWriteError(error, data.domainName);
        }
        throw error;
      }
    }),

  delete: mutationProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db.domain.findFirst({
      where: { id: input.id, createdById: ctx.user.workspaceId! },
      select: { id: true },
    });
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Domein niet gevonden" });
    return ctx.db.domain.delete({ where: { id: input.id } });
  }),

  analyzeDomain: mutationProcedure
    .input(
      z
        .object({
          id: z.string().optional(),
          domainName: domainNameSchema.optional(),
        })
        .refine((value) => Boolean(value.id || value.domainName), {
          message: "Geef een domein-id of -naam op.",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId!;
      const domain = await resolveDomainForWorkspace(ctx.db, workspaceId, input);
      const analysis = await analyzeWebsite(domain.domainName);
      const persisted = await persistDomainAnalysis(ctx.db, {
        domainId: domain.id,
        leadId: domain.leadId,
        analysis,
      });

      return { ...analysis, healthScore: persisted.healthScore, domainId: domain.id };
    }),

  bulkAnalyze: mutationProcedure
    .input(z.object({ ids: z.array(z.string()).max(50).optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId!;
      const domains = await ctx.db.domain.findMany({
        where: {
          createdById: workspaceId,
          ...(input?.ids?.length ? { id: { in: input.ids } } : { status: { in: ["ACTIVE", "EXPIRING"] } }),
        },
        select: { id: true, domainName: true, leadId: true },
        take: 25,
        orderBy: { lastAnalyzedAt: "asc" },
      });

      const results: Array<{ id: string; domainName: string; ok: boolean; healthScore?: number; error?: string }> = [];
      for (const domain of domains) {
        try {
          const analysis = await analyzeWebsite(domain.domainName);
          const persisted = await persistDomainAnalysis(ctx.db, {
            domainId: domain.id,
            leadId: domain.leadId,
            analysis,
          });
          results.push({ id: domain.id, domainName: domain.domainName, ok: true, healthScore: persisted.healthScore });
        } catch (error) {
          results.push({
            id: domain.id,
            domainName: domain.domainName,
            ok: false,
            error: error instanceof Error ? error.message : "Analyse mislukt",
          });
        }
      }

      return {
        analyzed: results.filter((item) => item.ok).length,
        failed: results.filter((item) => !item.ok).length,
        results,
      };
    }),

  getAnalysis: protectedProcedure
    .input(
      z
        .object({
          id: z.string().optional(),
          domainName: domainNameSchema.optional(),
        })
        .refine((value) => Boolean(value.id || value.domainName), {
          message: "Geef een domein-id of -naam op.",
        }),
    )
    .query(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId!;
      const domain = await ctx.db.domain.findFirst({
        where: input.id
          ? { id: input.id, createdById: workspaceId }
          : { domainName: input.domainName, createdById: workspaceId },
        include: domainInclude,
      });
      if (!domain) return null;
      const enriched = enrichDomainRecord(domain);
      return {
        analysis: enriched.analysis,
        lastAnalyzedAt: domain.lastAnalyzedAt,
        healthScore: enriched.healthScore,
      };
    }),
});
