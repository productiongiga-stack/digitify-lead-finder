import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";

export const pipelineRouter = router({
  getStages: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.pipelineStage.findMany({
      where: { createdById: ctx.user.workspaceId! },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { leads: true } } },
    });
  }),

  createStage: adminProcedure
    .input(z.object({ name: z.string().min(1), color: z.string().default("#6366f1") }))
    .mutation(async ({ ctx, input }) => {
      const maxOrder = await ctx.db.pipelineStage.aggregate({
        where: { createdById: ctx.user.workspaceId! },
        _max: { sortOrder: true },
      });
      return ctx.db.pipelineStage.create({
        data: { ...input, createdById: ctx.user.workspaceId!, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
      });
    }),

  updateStage: adminProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), color: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const stage = await ctx.db.pipelineStage.findFirst({
        where: { id, createdById: ctx.user.workspaceId! },
        select: { id: true },
      });
      if (!stage) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline stage niet gevonden." });
      }
      return ctx.db.pipelineStage.update({ where: { id }, data });
    }),

  deleteStage: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const stage = await ctx.db.pipelineStage.findFirst({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
        select: { id: true },
      });
      if (!stage) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline stage niet gevonden." });
      }
      await ctx.db.pipelineStage.delete({ where: { id: input.id } });
      return { success: true };
    }),

  reorderStages: adminProcedure
    .input(z.object({ stageIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.stageIds.map((id, index) =>
          ctx.db.pipelineStage.updateMany({
            where: { id, createdById: ctx.user.workspaceId! },
            data: { sortOrder: index },
          })
        )
      );
      return { success: true };
    }),
});
