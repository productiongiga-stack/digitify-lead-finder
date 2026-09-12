import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, mutationProcedure, protectedProcedure, router } from "../trpc";
import { recordSecurityAuditEvent } from "../lib/security-audit";

const contractInput = z.object({
  name: z.string().trim().min(2).max(160),
  clientName: z.string().trim().min(2).max(160),
  clientEmail: z.string().email().optional(),
  content: z.string().trim().min(1).max(50000),
  projectId: z.string().optional(),
  quoteId: z.string().optional(),
});

async function validateSource(ctx: { db: any; user: { workspaceId?: string } }, input: { projectId?: string; quoteId?: string }) {
  const workspaceId = ctx.user.workspaceId!;
  if (input.projectId) {
    const project = await ctx.db.project.findFirst({ where: { id: input.projectId, createdById: workspaceId }, select: { id: true } });
    if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project niet gevonden in deze werkruimte." });
  }
  if (input.quoteId) {
    const quote = await ctx.db.quote.findFirst({ where: { id: input.quoteId, createdById: workspaceId, status: "ACCEPTED" }, select: { id: true } });
    if (!quote) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Een contract kan alleen aan een geaccepteerde offerte worden gekoppeld." });
  }
}

export const contractRouter = router({
  sources: protectedProcedure.query(async ({ ctx }) => {
    const workspaceId = ctx.user.workspaceId!;
    const [projects, quotes] = await Promise.all([
      ctx.db.project.findMany({ where: { createdById: workspaceId, status: { not: "ARCHIVED" } }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, name: true, clientName: true } }),
      ctx.db.quote.findMany({ where: { createdById: workspaceId, status: "ACCEPTED" }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, quoteNumber: true, clientName: true, clientEmail: true } }),
    ]);
    return { projects, quotes };
  }),

  list: protectedProcedure.query(async ({ ctx }) => ctx.db.contract.findMany({ where: { createdById: ctx.user.workspaceId! }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, name: true, clientName: true, clientEmail: true, content: true, version: true, status: true, projectId: true, quoteId: true, sentAt: true, viewedAt: true, signedAt: true, declinedAt: true, updatedAt: true } })),

  create: adminProcedure.input(contractInput).mutation(async ({ ctx, input }) => {
    await validateSource(ctx, input);
    const contract = await ctx.db.contract.create({ data: { createdById: ctx.user.workspaceId!, name: input.name.trim(), clientName: input.clientName.trim(), clientEmail: input.clientEmail?.trim().toLowerCase(), content: input.content.trim(), projectId: input.projectId, quoteId: input.quoteId }, select: { id: true, name: true, status: true } });
    await recordSecurityAuditEvent(ctx.db, { workspaceId: ctx.user.workspaceId, actorUserId: ctx.user.actorUserId ?? ctx.user.id, targetUserId: ctx.user.id, action: "CONTRACT_CREATED", resource: "Contract", resourceId: contract.id, result: "SUCCESS", requestId: ctx.requestId, metadata: { name: contract.name } });
    return contract;
  }),

  updateStatus: mutationProcedure.input(z.object({ id: z.string(), status: z.enum(["SENT", "VIEWED", "SIGNED", "DECLINED", "EXPIRED"]) })).mutation(async ({ ctx, input }) => {
    const contract = await ctx.db.contract.findFirst({ where: { id: input.id, createdById: ctx.user.workspaceId! }, select: { id: true, status: true, name: true } });
    if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "Contract niet gevonden." });
    const allowed: Record<string, string[]> = { DRAFT: ["SENT", "EXPIRED"], SENT: ["VIEWED", "DECLINED", "EXPIRED"], VIEWED: ["SIGNED", "DECLINED", "EXPIRED"] };
    if (!allowed[contract.status]?.includes(input.status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Statusovergang van ${contract.status} naar ${input.status} is niet toegestaan.` });
    const now = new Date();
    const updated = await ctx.db.contract.update({ where: { id: contract.id }, data: { status: input.status, sentAt: input.status === "SENT" ? now : undefined, viewedAt: input.status === "VIEWED" ? now : undefined, signedAt: input.status === "SIGNED" ? now : undefined, declinedAt: input.status === "DECLINED" ? now : undefined }, select: { id: true, status: true, sentAt: true, viewedAt: true, signedAt: true, declinedAt: true } });
    await recordSecurityAuditEvent(ctx.db, { workspaceId: ctx.user.workspaceId, actorUserId: ctx.user.actorUserId ?? ctx.user.id, targetUserId: ctx.user.id, action: "CONTRACT_STATUS_CHANGED", resource: "Contract", resourceId: contract.id, result: "SUCCESS", requestId: ctx.requestId, metadata: { name: contract.name, from: contract.status, to: input.status } });
    return updated;
  }),

  delete: mutationProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const contract = await ctx.db.contract.findFirst({ where: { id: input.id, createdById: ctx.user.workspaceId! }, select: { id: true } });
    if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "Contract niet gevonden." });
    return ctx.db.contract.delete({ where: { id: contract.id }, select: { id: true } });
  }),
});
