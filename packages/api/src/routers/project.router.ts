import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, mutationProcedure, protectedProcedure, router } from "../trpc";
import { recordSecurityAuditEvent } from "../lib/security-audit";

const projectInput = z.object({
  name: z.string().trim().min(2).max(160),
  clientName: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).optional(),
  leadId: z.string().optional(),
  quoteId: z.string().optional(),
  startAt: z.coerce.date().optional(),
  dueAt: z.coerce.date().optional(),
});

async function validateSource(ctx: { db: any; user: { workspaceId?: string } }, input: { leadId?: string; quoteId?: string }) {
  const workspaceId = ctx.user.workspaceId!;
  if (input.leadId) {
    const lead = await ctx.db.lead.findFirst({ where: { id: input.leadId, createdById: workspaceId }, select: { id: true, status: true } });
    if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead niet gevonden in deze werkruimte." });
    if (lead.status !== "WON") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Een project kan pas starten vanuit een gewonnen lead." });
  }
  if (input.quoteId) {
    const quote = await ctx.db.quote.findFirst({ where: { id: input.quoteId, createdById: workspaceId }, select: { id: true, status: true } });
    if (!quote) throw new TRPCError({ code: "NOT_FOUND", message: "Offerte niet gevonden in deze werkruimte." });
    if (quote.status !== "ACCEPTED") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Een project kan pas starten vanuit een geaccepteerde offerte." });
  }
}

export const projectRouter = router({
  sources: protectedProcedure.query(async ({ ctx }) => {
    const workspaceId = ctx.user.workspaceId!;
    const [leads, quotes] = await Promise.all([
      ctx.db.lead.findMany({ where: { createdById: workspaceId, status: "WON" }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, companyName: true } }),
      ctx.db.quote.findMany({ where: { createdById: workspaceId, status: "ACCEPTED" }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, quoteNumber: true, clientName: true, total: true, leadId: true } }),
    ]);
    return { leads, quotes };
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const workspaceId = ctx.user.workspaceId!;
    const projects = await ctx.db.project.findMany({ where: { createdById: workspaceId }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, name: true, clientName: true, description: true, status: true, leadId: true, quoteId: true, startAt: true, dueAt: true, updatedAt: true } });
    const [leads, quotes] = await Promise.all([
      ctx.db.lead.findMany({ where: { createdById: workspaceId, id: { in: projects.flatMap((project) => project.leadId ? [project.leadId] : []) } }, select: { id: true, companyName: true } }),
      ctx.db.quote.findMany({ where: { createdById: workspaceId, id: { in: projects.flatMap((project) => project.quoteId ? [project.quoteId] : []) } }, select: { id: true, quoteNumber: true, total: true } }),
    ]);
    const leadNames = new Map(leads.map((lead) => [lead.id, lead.companyName]));
    const quoteNumbers = new Map(quotes.map((quote) => [quote.id, { number: quote.quoteNumber, total: quote.total }]));
    return projects.map((project) => ({ ...project, leadCompany: project.leadId ? leadNames.get(project.leadId) ?? null : null, quote: project.quoteId ? quoteNumbers.get(project.quoteId) ?? null : null }));
  }),

  create: adminProcedure.input(projectInput).mutation(async ({ ctx, input }) => {
    await validateSource(ctx, input);
    const project = await ctx.db.project.create({ data: { createdById: ctx.user.workspaceId!, name: input.name.trim(), clientName: input.clientName.trim(), description: input.description?.trim() || null, leadId: input.leadId, quoteId: input.quoteId, startAt: input.startAt, dueAt: input.dueAt }, select: { id: true, name: true, status: true } });
    await recordSecurityAuditEvent(ctx.db, { workspaceId: ctx.user.workspaceId, actorUserId: ctx.user.actorUserId ?? ctx.user.id, targetUserId: ctx.user.id, action: "PROJECT_CREATED", resource: "Project", resourceId: project.id, result: "SUCCESS", requestId: ctx.requestId, metadata: { name: project.name } });
    return project;
  }),

  update: adminProcedure.input(z.object({ id: z.string(), name: projectInput.shape.name.optional(), clientName: projectInput.shape.clientName.optional(), description: projectInput.shape.description, status: z.enum(["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]).optional(), startAt: z.coerce.date().nullable().optional(), dueAt: z.coerce.date().nullable().optional() })).mutation(async ({ ctx, input }) => {
    const project = await ctx.db.project.findFirst({ where: { id: input.id, createdById: ctx.user.workspaceId! }, select: { id: true } });
    if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project niet gevonden." });
    return ctx.db.project.update({ where: { id: project.id }, data: { ...(input.name !== undefined ? { name: input.name.trim() } : {}), ...(input.clientName !== undefined ? { clientName: input.clientName.trim() } : {}), ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}), ...(input.status !== undefined ? { status: input.status } : {}), ...(input.startAt !== undefined ? { startAt: input.startAt } : {}), ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}) }, select: { id: true, name: true, clientName: true, status: true, startAt: true, dueAt: true } });
  }),

  delete: mutationProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const project = await ctx.db.project.findFirst({ where: { id: input.id, createdById: ctx.user.workspaceId! }, select: { id: true } });
    if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project niet gevonden." });
    return ctx.db.project.delete({ where: { id: project.id }, select: { id: true } });
  }),
});
