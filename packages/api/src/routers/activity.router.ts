import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { effectiveWorkspaceRole } from "../lib/effective-role";

const inputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  type: z.string().trim().max(80).optional(),
  actorUserId: z.string().optional(),
  resource: z.string().trim().max(80).optional(),
  result: z.enum(["SUCCESS", "DENIED", "FAILED"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).default({});

export const activityRouter = router({
  list: protectedProcedure.input(inputSchema).query(async ({ ctx, input }) => {
    const workspaceId = ctx.user.workspaceId!;
    const members = await ctx.db.workspaceMembership.findMany({
      where: { workspaceId, status: "ACTIVE" },
      select: { userId: true },
    });
    const memberIds = Array.from(new Set([workspaceId, ...members.map((member) => member.userId)]));
    const createdAt = input.from || input.to ? { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lte: input.to } : {}) } : undefined;

    const [activities, securityEvents] = await Promise.all([
      ctx.db.activity.findMany({
        where: {
          ...(createdAt ? { createdAt } : {}),
          ...(input.type ? { type: input.type as never } : {}),
          OR: [
            { lead: { createdById: workspaceId } },
            { userId: { in: memberIds } },
          ],
          ...(input.actorUserId ? { userId: input.actorUserId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        select: {
          id: true, type: true, title: true, createdAt: true, leadId: true,
          lead: { select: { id: true, companyName: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      ["OWNER", "ADMIN"].includes(effectiveWorkspaceRole(ctx))
        ? ctx.db.securityAuditEvent.findMany({
            where: {
              workspaceId,
              ...(createdAt ? { createdAt } : {}),
              ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
              ...(input.resource ? { resource: input.resource } : {}),
              ...(input.result ? { result: input.result } : {}),
            },
            orderBy: { createdAt: "desc" },
            take: input.limit,
            select: {
              id: true, action: true, resource: true, resourceId: true, result: true, reason: true, createdAt: true,
              actorUserId: true,
              targetUserId: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const workspaceUsers = memberIds.length
      ? await ctx.db.user.findMany({ where: { id: { in: memberIds } }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } })
      : [];
    const securityUserById = new Map(workspaceUsers.map((user) => [user.id, user]));

    const items = [
      ...activities.map((activity) => ({
        id: `activity:${activity.id}`,
        kind: "activity" as const,
        type: activity.type,
        title: activity.title,
        result: "SUCCESS",
        reason: null,
        resource: activity.lead?.companyName ?? null,
        resourceId: activity.leadId,
        createdAt: activity.createdAt,
        actor: activity.user,
      })),
      ...securityEvents.map((event) => ({
        id: `security:${event.id}`,
        kind: "security" as const,
        type: event.action,
        title: event.resource ? `${event.action} · ${event.resource}` : event.action,
        result: event.result,
        reason: event.reason,
        resource: event.resource,
        resourceId: event.resourceId,
        createdAt: event.createdAt,
        actor: event.actorUserId ? securityUserById.get(event.actorUserId) ?? null : null,
        target: event.targetUserId ? securityUserById.get(event.targetUserId) ?? null : null,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, input.limit);

    return { items, actors: workspaceUsers, includesSecurityEvents: ["OWNER", "ADMIN"].includes(effectiveWorkspaceRole(ctx)) };
  }),
});
