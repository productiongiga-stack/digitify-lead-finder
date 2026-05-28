import { getServerSession } from "next-auth";
import { prisma } from "@digitify/db";
import { resolveWorkspaceOwnerId } from "@digitify/api/src/lib/workspace";
import { authOptions } from "./options";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  const sessionUser = session?.user as ({ id?: string; role?: string } & Record<string, unknown>) | undefined;
  const userId = typeof sessionUser?.id === "string" ? sessionUser.id : "";
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, workspaceOwnerId: true },
  });
  if (!user) return null;

  const workspaceId = await resolveWorkspaceOwnerId(prisma, user.id);

  return {
    ...sessionUser,
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    workspaceId,
  };
}

export function workspaceIdFor(user: { id: string; workspaceId?: string }) {
  return user.workspaceId ?? user.id;
}
