import { cache } from "react";
import { getServerSession } from "next-auth";
import { prisma } from "@digitify/db";
import { resolveWorkspaceOwnerId } from "@digitify/api/src/lib/workspace";
import { authOptions } from "./options";

type SessionUser = {
  id?: string;
  email?: string;
  name?: string | null;
  role?: string;
  workspaceId?: string;
  workspaceRole?: string;
  isPersonalWorkspace?: boolean;
};

export const getSession = cache(async () => getServerSession(authOptions));

export const getCurrentUser = cache(async () => {
  const session = await getSession();
  const sessionUser = session?.user as SessionUser | undefined;
  const userId = typeof sessionUser?.id === "string" ? sessionUser.id : "";
  if (!userId) return null;

  const workspaceIdFromSession =
    typeof sessionUser?.workspaceId === "string" ? sessionUser.workspaceId : "";
  if (
    workspaceIdFromSession &&
    typeof sessionUser?.email === "string" &&
    typeof sessionUser?.role === "string"
  ) {
    return {
      id: userId,
      email: sessionUser.email,
      name: sessionUser.name ?? null,
      role: sessionUser.role,
      workspaceId: workspaceIdFromSession,
      workspaceRole:
        typeof sessionUser.workspaceRole === "string" ? sessionUser.workspaceRole : sessionUser.role,
      isPersonalWorkspace:
        typeof sessionUser.isPersonalWorkspace === "boolean"
          ? sessionUser.isPersonalWorkspace
          : workspaceIdFromSession === userId,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, workspaceOwnerId: true },
  });
  if (!user) return null;

  const workspaceId = await resolveWorkspaceOwnerId(prisma, user.id);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    workspaceId,
    workspaceRole: user.role,
    isPersonalWorkspace: workspaceId === user.id,
  };
});

export function workspaceIdFor(user: { id: string; workspaceId?: string }) {
  return user.workspaceId ?? user.id;
}
