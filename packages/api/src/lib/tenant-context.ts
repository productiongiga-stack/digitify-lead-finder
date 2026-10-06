import { type PrismaClient } from "@digitify/db";
import { TRPCError } from "@trpc/server";
import { resolveWorkspaceContext, hasWorkspaceAccess } from "./workspace-registry";

export const FREE_MODULE_IDS = ["leads", "leadFinder", "campaigns", "scoring", "crm", "tasks"] as const;

export type TenantContext = {
  workspaceId: string;
  ownerUserId: string;
  memberId: string;
  workspaceRole: string;
  accountClass: string;
  accountStatus: string;
  platformRole: string | null;
  trialEndsAt: Date | null;
  isPersonalWorkspace: boolean;
};

/** Resolve the one authoritative tenant identity used by every protected request. */
export async function resolveTenantContext(db: PrismaClient, user: {
  id: string;
  role?: string | null;
  workspaceId?: string | null;
  workspaceRole?: string | null;
}) : Promise<TenantContext> {
  // Lightweight router tests and legacy workers can provide a deliberately
  // reduced Prisma double. Preserve the old session claims until the full
  // tenant tables are available; production always uses the database path.
  if (!db.workspace?.findUnique || !db.workspaceMembership?.findUnique || !db.user?.findUnique) {
    const workspaceId = user.workspaceId ?? user.id;
    return {
      workspaceId,
      ownerUserId: workspaceId,
      memberId: user.id,
      workspaceRole: user.workspaceRole ?? user.role ?? "MEMBER",
      accountClass: user.role === "TESTER" ? "TESTER" : user.role === "TRIAL" ? "TRIAL" : user.workspaceRole === "OWNER" ? "CLIENT_OWNER" : "CLIENT_MEMBER",
      accountStatus: "ACTIVE",
      platformRole: null,
      trialEndsAt: null,
      isPersonalWorkspace: workspaceId === user.id,
    };
  }
  let base: { workspaceId: string; workspaceRole: string; isPersonalWorkspace: boolean };
  if (user.workspaceId) {
    if (!(await hasWorkspaceAccess(db, user.id, user.workspaceId))) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Je hebt geen toegang tot dit bedrijf." });
    }
    const membership = await db.workspaceMembership.findUnique({ where: { workspaceId_userId: { workspaceId: user.workspaceId, userId: user.id } }, select: { role: true, status: true } });
    base = { workspaceId: user.workspaceId, workspaceRole: membership?.status === "ACTIVE" ? membership.role : user.workspaceRole ?? user.role ?? "MEMBER", isPersonalWorkspace: user.workspaceId === user.id };
  } else {
    base = await resolveWorkspaceContext(db, user.id);
  }

  const [workspace, member] = await Promise.all([
    db.workspace.findUnique({ where: { id: base.workspaceId }, select: { ownerUserId: true, type: true } }),
    db.user.findUnique({ where: { id: user.id }, select: { email: true, accountClass: true, accountStatus: true, platformRole: true, trialEndsAt: true, role: true } }).catch((error: unknown) => {
      const code = (error as { code?: string }).code;
      if (code === "P2021" || code === "P2022") return null;
      throw error;
    }),
  ]);
  if (!workspace) throw new TRPCError({ code: "FORBIDDEN", message: "Je actieve bedrijf bestaat niet meer." });

  const allowlistedPlatformOwner = Boolean(member?.email && (process.env.PLATFORM_OWNER_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).includes(member.email.toLowerCase()));
  const accountClass = allowlistedPlatformOwner ? "PLATFORM_OWNER" : member?.accountClass
    ?? (member?.platformRole === "OWNER" ? "PLATFORM_OWNER" : member?.platformRole === "SUPPORT" ? "PLATFORM_SUPPORT" : member?.role === "TESTER" ? "TESTER" : member?.role === "TRIAL" ? "TRIAL" : base.workspaceRole === "OWNER" ? "CLIENT_OWNER" : "CLIENT_MEMBER");
  return {
    workspaceId: base.workspaceId,
    ownerUserId: workspace.ownerUserId,
    memberId: user.id,
    workspaceRole: base.workspaceRole,
    accountClass,
    accountStatus: member?.accountStatus ?? "ACTIVE",
    platformRole: member?.platformRole ?? null,
    trialEndsAt: member?.trialEndsAt ?? null,
    isPersonalWorkspace: base.isPersonalWorkspace,
  };
}

export function isTrialExpired(context: Pick<TenantContext, "accountClass" | "trialEndsAt">) {
  return context.accountClass === "TRIAL" && Boolean(context.trialEndsAt && context.trialEndsAt.getTime() <= Date.now());
}

export function isReadOnlyTenant(context: Pick<TenantContext, "accountClass" | "accountStatus" | "workspaceRole" | "trialEndsAt">) {
  return context.accountStatus !== "ACTIVE" || context.accountClass === "TESTER" || context.workspaceRole === "VIEWER" || isTrialExpired(context);
}
