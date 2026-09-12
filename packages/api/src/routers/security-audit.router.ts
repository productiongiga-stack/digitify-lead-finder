import { z } from "zod";
import { adminProcedure, router } from "../trpc";

/** Explicit browser-safe projection. Audit metadata can contain operational context and never leaves the server. */
export const SECURITY_AUDIT_PUBLIC_SELECT = {
  id: true,
  action: true,
  resource: true,
  resourceId: true,
  result: true,
  reason: true,
  createdAt: true,
  actorUserId: true,
  targetUserId: true,
} as const;

export const securityAuditRouter = router({
  list: adminProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(100).default(50),
      action: z.string().trim().max(80).optional(),
      resource: z.string().trim().max(80).optional(),
      actorUserId: z.string().optional(),
      targetUserId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.securityAuditEvent.findMany({
        where: {
          workspaceId: ctx.user.workspaceId!,
          ...(input.action ? { action: input.action } : {}),
          ...(input.resource ? { resource: input.resource } : {}),
          ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
          ...(input.targetUserId ? { targetUserId: input.targetUserId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        select: SECURITY_AUDIT_PUBLIC_SELECT,
      });
    }),
});
