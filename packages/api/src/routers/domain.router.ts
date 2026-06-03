import { z } from "zod";
import { router, protectedProcedure, mutationProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { analyzeWebsite } from "@digitify/connectors";
import { assertLeadAccess } from "../lib/tenant";

export const domainRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        status: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(25),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { status, page = 1, pageSize = 25 } = input ?? {};
      const where: Record<string, unknown> = { createdById: ctx.user.workspaceId! };
      if (status) where.status = status;

      const [domains, total] = await Promise.all([
        ctx.db.domain.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            lead: {
              select: {
                id: true,
                companyName: true,
                enrichmentData: {
                  where: {
                    OR: [
                      { source: "domain_analysis" },
                      { source: { startsWith: "website_tracker:" } },
                    ],
                  },
                  orderBy: { fetchedAt: "desc" },
                  select: { data: true, fetchedAt: true, source: true },
                },
              },
            },
          },
        }),
        ctx.db.domain.count({ where }),
      ]);

      return { domains, total, page, pageSize };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const domain = await ctx.db.domain.findFirst({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
        include: {
          lead: {
            select: {
              id: true,
              companyName: true,
              website: true,
              enrichmentData: {
                where: {
                  OR: [
                    { source: "domain_analysis" },
                    { source: { startsWith: "website_tracker:" } },
                  ],
                },
                orderBy: { fetchedAt: "desc" },
                select: { source: true, data: true, fetchedAt: true },
              },
            },
          },
        },
      });

      if (!domain) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Domein niet gevonden" });
      }

      return domain;
    }),

  create: mutationProcedure
    .input(
      z.object({
        domainName: z.string().min(1),
        registrar: z.string().optional(),
        registeredAt: z.string().or(z.date()).optional(),
        expiresAt: z.string().or(z.date()).optional(),
        notes: z.string().optional(),
        leadId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.leadId) await assertLeadAccess(ctx.db, ctx.user.workspaceId!, input.leadId);
      return ctx.db.domain.create({
        data: {
          domainName: input.domainName,
          registrar: input.registrar || null,
          registeredAt: input.registeredAt ? new Date(input.registeredAt) : null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          notes: input.notes || null,
          leadId: input.leadId || null,
          createdById: ctx.user.workspaceId!,
        },
      });
    }),

  update: mutationProcedure
    .input(
      z.object({
        id: z.string(),
        domainName: z.string().min(1).optional(),
        registrar: z.string().optional(),
        registeredAt: z.string().or(z.date()).optional(),
        expiresAt: z.string().or(z.date()).optional(),
        status: z.enum(["ACTIVE", "EXPIRING", "EXPIRED", "TRANSFERRED"]).optional(),
        sslStatus: z.enum(["VALID", "EXPIRED", "NONE", "UNKNOWN"]).optional(),
        notes: z.string().optional(),
        leadId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await ctx.db.domain.findFirst({
        where: { id, createdById: ctx.user.workspaceId! },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Domein niet gevonden" });
      if (data.leadId) await assertLeadAccess(ctx.db, ctx.user.workspaceId!, data.leadId);
      const updateData: Record<string, unknown> = {};
      if (data.domainName !== undefined) updateData.domainName = data.domainName;
      if (data.registrar !== undefined) updateData.registrar = data.registrar || null;
      if (data.registeredAt !== undefined) updateData.registeredAt = data.registeredAt ? new Date(data.registeredAt) : null;
      if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.sslStatus !== undefined) updateData.sslStatus = data.sslStatus;
      if (data.notes !== undefined) updateData.notes = data.notes || null;
      if (data.leadId !== undefined) updateData.leadId = data.leadId || null;

      return ctx.db.domain.update({ where: { id }, data: updateData });
    }),

  delete: mutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.domain.findFirst({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Domein niet gevonden" });
      return ctx.db.domain.delete({ where: { id: input.id } });
    }),

  analyzeDomain: mutationProcedure
    .input(z.object({ domainName: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const analysis = await analyzeWebsite(input.domainName);

      // Update domain SSL status based on analysis
      const sslStatus = analysis.hasSSL ? "VALID" : "NONE";
      await ctx.db.domain.updateMany({
        where: { domainName: input.domainName, createdById: ctx.user.workspaceId! },
        data: { sslStatus },
      });

      // Find the domain to get its leadId
      const domain = await ctx.db.domain.findFirst({
        where: { domainName: input.domainName, createdById: ctx.user.workspaceId! },
        select: { leadId: true },
      });

      // Store analysis in EnrichmentData if domain is linked to a lead
      if (domain?.leadId) {
        await ctx.db.enrichmentData.upsert({
          where: {
            leadId_source: {
              leadId: domain.leadId,
              source: "domain_analysis",
            },
          },
          create: {
            leadId: domain.leadId,
            source: "domain_analysis",
            data: analysis as any,
          },
          update: {
            data: analysis as any,
            fetchedAt: new Date(),
          },
        });
      }

      return analysis;
    }),

  getAnalysis: protectedProcedure
    .input(z.object({ domainName: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const domain = await ctx.db.domain.findFirst({
        where: { domainName: input.domainName, createdById: ctx.user.workspaceId! },
        select: { leadId: true },
      });

      if (!domain?.leadId) return null;

      const enrichment = await ctx.db.enrichmentData.findUnique({
        where: {
          leadId_source: {
            leadId: domain.leadId,
            source: "domain_analysis",
          },
        },
      });

      return enrichment;
    }),
});
