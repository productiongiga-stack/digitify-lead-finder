import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, platformProcedure } from "../trpc";
import { recordSecurityAuditEvent } from "../lib/security-audit";
import { startAccountView, endAccountView } from "../lib/account-view";

const accountClass = z.enum(["PLATFORM_OWNER", "PLATFORM_SUPPORT", "CLIENT_OWNER", "CLIENT_MEMBER", "TESTER", "TRIAL"]);
const accountStatus = z.enum(["ACTIVE", "SUSPENDED", "CLOSED"]);

async function assertWorkspace(db: any, workspaceId: string) {
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, name: true, type: true, ownerUserId: true, createdAt: true } });
  if (!workspace) throw new TRPCError({ code: "NOT_FOUND", message: "Bedrijf niet gevonden." });
  return workspace;
}

export const platformRouter = router({
  listAccounts: platformProcedure.query(async ({ ctx }) => {
    const workspaces = await ctx.db.workspace.findMany({
      orderBy: { createdAt: "asc" },
      take: 500,
      select: {
        id: true, name: true, type: true, ownerUserId: true, createdAt: true,
        owner: { select: { id: true, name: true, email: true, accountClass: true, accountStatus: true, platformRole: true, trialEndsAt: true, emailVerified: true } },
        memberships: { where: { status: "ACTIVE" }, select: { userId: true, role: true } },
        moduleEntitlements: { select: { moduleId: true, status: true, source: true, startsAt: true, endsAt: true } },
      },
    });
    return workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      type: workspace.type,
      ownerUserId: workspace.ownerUserId,
      createdAt: workspace.createdAt,
      owner: workspace.owner,
      memberCount: workspace.memberships.length,
      modules: workspace.moduleEntitlements,
    }));
  }),

  getAccount: platformProcedure.input(z.object({ workspaceId: z.string().min(1) })).query(async ({ ctx, input }) => {
    const workspace = await assertWorkspace(ctx.db, input.workspaceId);
    const members = await ctx.db.workspaceMembership.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, email: true, name: true, role: true, accountClass: true, accountStatus: true, platformRole: true, trialEndsAt: true, emailVerified: true } } } });
    const modules = await ctx.db.workspaceModuleEntitlement.findMany({ where: { workspaceId: workspace.id }, orderBy: { moduleId: "asc" } });
    return { workspace, members, modules };
  }),

  enterSupport: platformProcedure.input(z.object({ workspaceId: z.string().min(1), targetUserId: z.string().min(1), reason: z.string().trim().min(5).max(500), mode: z.enum(["VIEW", "ACT_AS"]).default("VIEW"), confirmExternalActions: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
    if (input.mode === "ACT_AS" && !input.confirmExternalActions) throw new TRPCError({ code: "BAD_REQUEST", message: "Bevestig eerst dat je expliciet als dit bedrijf handelt." });
    await assertWorkspace(ctx.db, input.workspaceId);
    const view = await startAccountView(ctx.db, { id: ctx.user.id, email: ctx.user.email, role: ctx.user.role, workspaceId: ctx.user.workspaceId, workspaceRole: ctx.user.workspaceRole, accountClass: ctx.user.accountClass, platformRole: ctx.user.platformRole }, input.targetUserId, input.workspaceId, ctx.requestId);
    await ctx.db.accountViewSession.update({ where: { id: view.sessionId }, data: { mode: input.mode, metadata: { reason: input.reason, confirmExternalActions: input.confirmExternalActions } } });
    await recordSecurityAuditEvent(ctx.db, { workspaceId: input.workspaceId, actorUserId: ctx.user.id, targetUserId: input.targetUserId, action: "SUPPORT_MODE_ENTERED", resource: "account_view_session", resourceId: view.sessionId, result: "SUCCESS", reason: input.reason, requestId: ctx.requestId, metadata: { mode: input.mode } });
    return view;
  }),

  exitSupport: platformProcedure.input(z.object({ sessionId: z.string().min(1), reason: z.string().trim().min(3).max(300).optional() })).mutation(async ({ ctx, input }) => {
    await endAccountView(ctx.db, input.sessionId, ctx.user.id, ctx.requestId);
    await recordSecurityAuditEvent(ctx.db, { actorUserId: ctx.user.id, action: "SUPPORT_MODE_EXITED", resource: "account_view_session", resourceId: input.sessionId, result: "SUCCESS", reason: input.reason, requestId: ctx.requestId });
    return { success: true };
  }),

  updateAccountClass: platformProcedure.input(z.object({ userId: z.string().min(1), accountClass })).mutation(async ({ ctx, input }) => {
    const target = await ctx.db.user.findUnique({ where: { id: input.userId }, select: { id: true, workspaceOwnerId: true } });
    if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Account niet gevonden." });
    const updated = await ctx.db.user.update({ where: { id: input.userId }, data: { accountClass: input.accountClass, platformRole: input.accountClass === "PLATFORM_OWNER" ? "OWNER" : input.accountClass === "PLATFORM_SUPPORT" ? "SUPPORT" : null, trialEndsAt: input.accountClass === "TRIAL" ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null, role: input.accountClass === "TESTER" ? "TESTER" : input.accountClass === "TRIAL" ? "TRIAL" : input.accountClass === "CLIENT_OWNER" || input.accountClass === "PLATFORM_OWNER" ? "OWNER" : "MEMBER" }, select: { id: true, accountClass: true, platformRole: true, role: true } });
    await recordSecurityAuditEvent(ctx.db, { actorUserId: ctx.user.id, targetUserId: input.userId, action: "ACCOUNT_CLASS_UPDATED", resource: "user", resourceId: input.userId, result: "SUCCESS", requestId: ctx.requestId, metadata: { accountClass: input.accountClass } });
    return updated;
  }),

  updateStatus: platformProcedure.input(z.object({ userId: z.string().min(1), status: accountStatus, reason: z.string().trim().min(3).max(500) })).mutation(async ({ ctx, input }) => {
    const updated = await ctx.db.user.update({ where: { id: input.userId }, data: { accountStatus: input.status, sessionVersion: { increment: 1 } }, select: { id: true, accountStatus: true } });
    await recordSecurityAuditEvent(ctx.db, { actorUserId: ctx.user.id, targetUserId: input.userId, action: input.status === "SUSPENDED" ? "ACCOUNT_SUSPENDED" : input.status === "ACTIVE" ? "ACCOUNT_RESTORED" : "ACCOUNT_CLOSED", resource: "user", resourceId: input.userId, result: "SUCCESS", reason: input.reason, requestId: ctx.requestId });
    return updated;
  }),

  setModuleEntitlement: platformProcedure.input(z.object({ workspaceId: z.string().min(1), moduleId: z.string().trim().min(1).max(80), status: z.enum(["ACTIVE", "TRIAL", "LOCKED"]), source: z.enum(["FREE", "TRIAL", "PAID", "MANUAL"]).default("MANUAL"), endsAt: z.coerce.date().nullable().optional(), reason: z.string().trim().min(3).max(300) })).mutation(async ({ ctx, input }) => {
    await assertWorkspace(ctx.db, input.workspaceId);
    const entitlement = await ctx.db.workspaceModuleEntitlement.upsert({ where: { workspaceId_moduleId: { workspaceId: input.workspaceId, moduleId: input.moduleId } }, create: { workspaceId: input.workspaceId, moduleId: input.moduleId, status: input.status, source: input.source, endsAt: input.endsAt ?? null }, update: { status: input.status, source: input.source, endsAt: input.endsAt ?? null } });
    await recordSecurityAuditEvent(ctx.db, { workspaceId: input.workspaceId, actorUserId: ctx.user.id, action: "MODULE_ENTITLEMENT_UPDATED", resource: "workspace_module_entitlement", resourceId: entitlement.id, result: "SUCCESS", reason: input.reason, requestId: ctx.requestId, metadata: { moduleId: input.moduleId, status: input.status, source: input.source } });
    return entitlement;
  }),

  listAuditEvents: platformProcedure.input(z.object({ workspaceId: z.string().optional(), limit: z.number().int().min(1).max(200).default(100) }).optional()).query(({ ctx, input }) => ctx.db.securityAuditEvent.findMany({ where: input?.workspaceId ? { workspaceId: input.workspaceId } : undefined, orderBy: { createdAt: "desc" }, take: input?.limit ?? 100, select: { id: true, workspaceId: true, actorUserId: true, targetUserId: true, action: true, resource: true, resourceId: true, result: true, reason: true, metadata: true, createdAt: true } })),

  revealSecret: platformProcedure.input(z.object({ workspaceId: z.string().min(1), key: z.string().trim().min(1).max(200), reason: z.string().trim().min(5).max(500), reauthenticated: z.literal(true) })).mutation(async ({ ctx, input }) => {
    await assertWorkspace(ctx.db, input.workspaceId);
    const row = await ctx.db.setting.findUnique({ where: { key: `workspace:${input.workspaceId}:${input.key}` }, select: { value: true } });
    await recordSecurityAuditEvent(ctx.db, { workspaceId: input.workspaceId, actorUserId: ctx.user.id, action: "SECRET_REVEALED", resource: "setting", resourceId: input.key, result: row ? "SUCCESS" : "FAILED", reason: input.reason, requestId: ctx.requestId, metadata: { key: input.key } });
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Geheime instelling niet gevonden." });
    return { key: input.key, value: row.value };
  }),
});
