import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Server-side auth guard. Call at the top of any protected server component
 * or server action. Returns the authenticated user or redirects to login.
 */
export async function requireAuth() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return session.user as { id: string; email: string; name?: string | null };
}

/**
 * Resolves the current workspace from a slug and verifies the user
 * is a member. Returns workspace + membership or throws.
 */
export async function requireWorkspace(workspaceSlug: string) {
  const user = await requireAuth();

  const membership = await db.workspaceMember.findFirst({
    where: {
      userId: user.id,
      workspace: { slug: workspaceSlug },
    },
    include: {
      workspace: true,
    },
  });

  if (!membership) {
    redirect("/login");
  }

  return {
    user,
    workspace: membership.workspace,
    membership,
    role: membership.role,
  };
}
