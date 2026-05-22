import { type PrismaClient, type UserRole } from "@digitify/db";

export type WorkspaceUser = {
  id: string;
  role: string;
  workspaceOwnerId?: string | null;
};

/**
 * Returns the user id that owns shared workspace data (leads, templates, campaigns, …).
 * OWNER accounts use their own id; team members use their workspace owner's id.
 */
export async function resolveWorkspaceOwnerId(
  db: PrismaClient,
  userId: string,
): Promise<string> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, workspaceOwnerId: true },
  });
  if (!user) return userId;
  if (user.workspaceOwnerId) return user.workspaceOwnerId;
  if (user.role === "OWNER") return user.id;

  const owner = await db.user.findFirst({
    where: { role: "OWNER" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return owner?.id ?? user.id;
}

export function isWorkspaceOwner(user: WorkspaceUser, workspaceId: string) {
  return user.id === workspaceId;
}

export async function getWorkspaceOwnerProfile(db: PrismaClient, workspaceId: string) {
  return db.user.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, email: true },
  });
}

export function workspaceMemberRoles(): UserRole[] {
  return ["ADMIN", "MODERATOR", "MEMBER", "TRIAL", "TESTER", "VIEWER"];
}

export type { WorkspaceScope } from "./workspace-settings";
export { workspaceScopeFromUser } from "./workspace-settings";
