import { cache } from "react";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { prisma } from "@digitify/db";
import { resolveAccountView, ACCOUNT_VIEW_COOKIE } from "@digitify/api/src/lib/account-view";
import { authOptions } from "./options";

type SessionUser = {
  id?: string;
  email?: string;
  name?: string | null;
  role?: string;
  workspaceId?: string;
  workspaceRole?: string;
  isPersonalWorkspace?: boolean;
  disabledModules?: string[];
  isViewingAs?: boolean;
  actorUserId?: string;
  viewAsSessionId?: string;
  viewAsTargetName?: string | null;
};

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  workspaceId: string;
  workspaceRole: string;
  isPersonalWorkspace: boolean;
  disabledModules: string[];
  isViewingAs?: boolean;
  actorUserId?: string;
  viewAsSessionId?: string;
  viewAsTargetName?: string | null;
};

export const getSession = cache(async () => getServerSession(authOptions));

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // The JWT callback revalidates account, version and membership on each request.
  const session = await getSession();
  const user = session?.user as SessionUser | undefined;
  if (!user?.id || !user.email || !user.role || !user.workspaceId || !user.workspaceRole) return null;
  const cookieStore = await cookies();
  const viewToken = cookieStore.get(ACCOUNT_VIEW_COOKIE)?.value;
  const viewedUser = viewToken
    ? await resolveAccountView(
        prisma,
        user as { id: string; email: string; role: string; workspaceId?: string; workspaceRole?: string },
        viewToken,
      )
    : null;
  return viewedUser ?? {
    id: user.id, email: user.email, name: user.name ?? null, role: user.role,
    workspaceId: user.workspaceId, workspaceRole: user.workspaceRole,
    isPersonalWorkspace: user.isPersonalWorkspace ?? false,
    disabledModules: user.disabledModules ?? [],
  };
});

export function workspaceIdFor(user: { id: string; workspaceId?: string }) {
  return user.workspaceId ?? user.id;
}
