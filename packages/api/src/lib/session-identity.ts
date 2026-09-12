import type { PrismaClient } from "@digitify/db";

/** Resolve authority from current rows, never from JWT role/workspace claims. */
export async function resolveSessionIdentity(
  db: PrismaClient,
  userId: string,
  sessionVersion: unknown,
) {
  if (!Number.isInteger(sessionVersion)) return null;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, name: true, role: true, emailVerified: true,
      sessionVersion: true, activeWorkspaceId: true, workspaceOwnerId: true,
    },
  });
  if (!user || !user.emailVerified || user.sessionVersion !== sessionVersion) return null;
  const workspaceId = user.activeWorkspaceId || user.workspaceOwnerId || user.id;
  const membership = await db.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true, status: true },
  });
  if (workspaceId !== user.id && membership?.status !== "ACTIVE") return null;
  const modules = await db.setting.findUnique({
    where: { key: `user:${userId}:modules.disabled` }, select: { value: true },
  });
  const disabledModules = (typeof modules?.value === "string" ? modules.value : "").split(",").map((id) => id.trim()).filter(Boolean);
  return {
    id: user.id, email: user.email, name: user.name, role: user.role,
    sessionVersion: user.sessionVersion,
    disabledModules,
    workspaceId,
    workspaceRole: workspaceId === user.id ? "OWNER" : membership!.role,
    isPersonalWorkspace: workspaceId === user.id,
  };
}
