import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { mutationProcedure, protectedProcedure, router } from "../trpc";
import { recordSecurityAuditEvent } from "../lib/security-audit";

const relatedTypeSchema = z.enum(["LEAD", "QUOTE", "CUSTOMER", "PROJECT"]).optional();
const fileListInput = z.object({ relatedType: relatedTypeSchema, relatedId: z.string().optional() })
  .refine((value) => Boolean(value.relatedType) === Boolean(value.relatedId), "Bestandsrelatie is onvolledig.");

export const fileRouter = router({
  list: protectedProcedure
    .input(fileListInput.default({}))
    .query(async ({ ctx, input }) => {
      return ctx.db.workspaceFile.findMany({
        where: {
          createdById: ctx.user.workspaceId!,
          ...(input.relatedType ? { relatedType: input.relatedType } : {}),
          ...(input.relatedId ? { relatedId: input.relatedId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          name: true,
          storage: true,
          contentType: true,
          size: true,
          relatedType: true,
          relatedId: true,
          createdAt: true,
          uploadedBy: { select: { id: true, name: true, email: true } },
        },
      });
    }),

  delete: mutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const file = await ctx.db.workspaceFile.findFirst({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
        select: { id: true, name: true },
      });
      if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "Bestand niet gevonden." });

      await ctx.db.workspaceFile.delete({ where: { id: file.id } });
      await recordSecurityAuditEvent(ctx.db, {
        workspaceId: ctx.user.workspaceId,
        actorUserId: ctx.user.actorUserId ?? ctx.user.id,
        targetUserId: ctx.user.id,
        action: "FILE_DELETED",
        resource: "WorkspaceFile",
        resourceId: file.id,
        result: "SUCCESS",
        requestId: ctx.requestId,
        metadata: { name: file.name },
      });
      return { ok: true };
    }),
});
