import { type PrismaClient, type UserRole } from "@digitify/db";

export type WorkspaceUser = {
  id: string;
  role: string;
  workspaceOwnerId?: string | null;
};

/** Resolve workspace owner id from an already-loaded user row (no DB). */
export function resolveWorkspaceOwnerIdSync(user: WorkspaceUser): string {
  if (user.workspaceOwnerId) return user.workspaceOwnerId;
  if (user.role === "OWNER") return user.id;
  return user.id;
}

const workspaceIdCache = new Map<string, { expiresAt: number; workspaceId: string }>();
const WORKSPACE_ID_CACHE_TTL_MS = 5 * 60_000;

/**
 * Returns the user id that owns shared workspace data (leads, templates, campaigns, …).
 * OWNER accounts use their own id; team members use their workspace owner's id.
 */
export async function resolveWorkspaceOwnerId(
  db: PrismaClient,
  userId: string,
): Promise<string> {
  const cached = workspaceIdCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) return cached.workspaceId;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, workspaceOwnerId: true },
  });
  const workspaceId = user ? resolveWorkspaceOwnerIdSync(user) : userId;
  workspaceIdCache.set(userId, {
    workspaceId,
    expiresAt: Date.now() + WORKSPACE_ID_CACHE_TTL_MS,
  });
  return workspaceId;
}

export function invalidateWorkspaceOwnerIdCache(userId: string) {
  workspaceIdCache.delete(userId);
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
export {
  assertWorkspaceMember,
  countWorkspaceOwners,
  notifyWorkspaceAdmins,
  workspaceMemberWhere,
} from "./workspace-members";
