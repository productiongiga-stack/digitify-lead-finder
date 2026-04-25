import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";

export const pipelineRouter = router({
  getStages: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.pipelineStage.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { leads: true } } },
    });
  }),

  createStage: adminProcedure
    .input(z.object({ name: z.string().min(1), color: z.string().default("#6366f1") }))
    .mutation(async ({ ctx, input }) => {
      const maxOrder = await ctx.db.pipelineStage.aggregate({ _max: { sortOrder: true } });
      return ctx.db.pipelineStage.create({
        data: { ...input, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
      });
    }),

  updateStage: adminProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), color: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.pipelineStage.update({ where: { id }, data });
    }),

  deleteStage: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.pipelineStage.delete({ where: { id: input.id } });
      return { success: true };
    }),

  reorderStages: adminProcedure
    .input(z.object({ stageIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.stageIds.map((id, index) =>
          ctx.db.pipelineStage.update({ where: { id }, data: { sortOrder: index } })
        )
      );
      return { success: true };
    }),
});
