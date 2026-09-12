import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@digitify/db";
import { adminProcedure, mutationProcedure, protectedProcedure, router } from "../trpc";

const triggerSchema = z.enum(["LEAD_CREATED", "LEAD_STATUS_CHANGED", "FORM_SUBMITTED", "TASK_DUE"]);
const actionSchema = z.object({
  type: z.enum(["CREATE_TASK", "SEND_EMAIL"]),
  title: z.string().trim().min(1).max(180),
});

function assertNotViewingAs(ctx: { user: { isViewingAs?: boolean } }) {
  if (ctx.user.isViewingAs) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Automatiseringen beheren is niet beschikbaar tijdens het bekijken van een account." });
  }
}

export const workflowRouter = router({
  list: protectedProcedure.query(async ({ ctx }) =>
    ctx.db.workflow.findMany({
      where: { createdById: ctx.user.workspaceId! },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, description: true, status: true, trigger: true, actions: true, updatedAt: true, _count: { select: { runs: true } } },
    }),
  ),

  create: adminProcedure
    .input(z.object({ name: z.string().trim().min(2).max(120), description: z.string().trim().max(500).optional(), trigger: triggerSchema, conditions: z.record(z.string(), z.unknown()).default({}), actions: z.array(actionSchema).min(1).max(10) }))
    .mutation(async ({ ctx, input }) => {
      assertNotViewingAs(ctx);
      return ctx.db.workflow.create({
        data: { createdById: ctx.user.workspaceId!, name: input.name, description: input.description || null, trigger: input.trigger, conditions: input.conditions as Prisma.InputJsonValue, actions: input.actions as Prisma.InputJsonValue },
        select: { id: true, name: true, status: true },
      });
    }),

  setStatus: adminProcedure
    .input(z.object({ id: z.string(), status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]) }))
    .mutation(async ({ ctx, input }) => {
      assertNotViewingAs(ctx);
      const workflow = await ctx.db.workflow.findFirst({ where: { id: input.id, createdById: ctx.user.workspaceId! }, select: { id: true } });
      if (!workflow) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow niet gevonden" });
      return ctx.db.workflow.update({ where: { id: workflow.id }, data: { status: input.status }, select: { id: true, status: true } });
    }),

  dryRun: mutationProcedure
    .input(z.object({ workflowId: z.string(), idempotencyKey: z.string().trim().min(8).max(120), triggerData: z.record(z.string(), z.unknown()).default({}) }))
    .mutation(async ({ ctx, input }) => {
      const workflow = await ctx.db.workflow.findFirst({ where: { id: input.workflowId, createdById: ctx.user.workspaceId! }, select: { id: true, status: true, actions: true } });
      if (!workflow) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow niet gevonden" });
      const actions = Array.isArray(workflow.actions) ? workflow.actions as Array<{ type: string; title: string }> : [];
      try {
        return await ctx.db.workflowRun.create({ data: { idempotencyKey: input.idempotencyKey, workflowId: workflow.id, status: "DRY_RUN", triggerData: input.triggerData as Prisma.InputJsonValue, result: { actions: actions.map((action) => ({ ...action, effect: action.type === "SEND_EMAIL" ? "blocked_by_approval" : "would_create_task" })) }, finishedAt: new Date() } });
      } catch (error) {
        if ((error as { code?: string }).code === "P2002") return ctx.db.workflowRun.findUniqueOrThrow({ where: { idempotencyKey: input.idempotencyKey } });
        throw error;
      }
    }),

  run: mutationProcedure
    .input(z.object({ workflowId: z.string(), idempotencyKey: z.string().trim().min(8).max(120), triggerData: z.record(z.string(), z.unknown()).default({}) }))
    .mutation(async ({ ctx, input }) => {
      const workflow = await ctx.db.workflow.findFirst({ where: { id: input.workflowId, createdById: ctx.user.workspaceId!, status: "ACTIVE" }, select: { id: true, actions: true } });
      if (!workflow) throw new TRPCError({ code: "NOT_FOUND", message: "Actieve workflow niet gevonden" });
      let run;
      try {
        run = await ctx.db.workflowRun.create({ data: { idempotencyKey: input.idempotencyKey, workflowId: workflow.id, status: "RUNNING", triggerData: input.triggerData as Prisma.InputJsonValue, startedAt: new Date() } });
      } catch (error) {
        if ((error as { code?: string }).code === "P2002") return ctx.db.workflowRun.findUniqueOrThrow({ where: { idempotencyKey: input.idempotencyKey } });
        throw error;
      }

      const leadId = typeof input.triggerData.leadId === "string" ? input.triggerData.leadId : null;
      const lead = leadId ? await ctx.db.lead.findFirst({ where: { id: leadId, createdById: ctx.user.workspaceId! }, select: { id: true, companyName: true } }) : null;
      const actions = Array.isArray(workflow.actions) ? workflow.actions as Array<{ type: string; title: string }> : [];
      const createdTaskIds: string[] = [];
      const blockedActions: string[] = [];
      try {
        for (const action of actions) {
          if (action.type === "SEND_EMAIL") { blockedActions.push(action.title); continue; }
          const task = await ctx.db.workspaceTask.create({ data: { createdById: ctx.user.workspaceId!, title: action.title, relatedType: lead ? "LEAD" : undefined, relatedId: lead?.id } });
          createdTaskIds.push(task.id);
        }
        if (lead) await ctx.db.activity.create({ data: { leadId: lead.id, userId: ctx.user.id, type: "NOTE_ADDED", title: `Workflow uitgevoerd voor ${lead.companyName}`, metadata: { workflowId: workflow.id, runId: run.idempotencyKey, createdTaskIds, blockedActions } } });
        return ctx.db.workflowRun.update({ where: { idempotencyKey: run.idempotencyKey }, data: { status: "SUCCEEDED", result: { createdTaskIds, blockedActions }, finishedAt: new Date() } });
      } catch (error) {
        return ctx.db.workflowRun.update({ where: { idempotencyKey: run.idempotencyKey }, data: { status: "FAILED", error: error instanceof Error ? error.message.slice(0, 500) : "Onbekende fout", finishedAt: new Date() } });
      }
    }),

  runs: protectedProcedure
    .input(z.object({ workflowId: z.string() }))
    .query(async ({ ctx, input }) => {
      const workflow = await ctx.db.workflow.findFirst({ where: { id: input.workflowId, createdById: ctx.user.workspaceId! }, select: { id: true } });
      if (!workflow) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow niet gevonden" });
      return ctx.db.workflowRun.findMany({ where: { workflowId: workflow.id }, orderBy: { createdAt: "desc" }, take: 50 });
    }),
});
