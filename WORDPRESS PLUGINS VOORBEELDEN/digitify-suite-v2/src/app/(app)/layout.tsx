import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";

/**
 * App layout — wraps all authenticated routes.
 *
 * Responsibilities:
 * 1. Verify auth session exists (redirect to login if not)
 * 2. Fetch user's workspace memberships for the workspace switcher
 * 3. Render the app shell (sidebar + topbar + content area)
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Fetch workspaces this user belongs to
  const memberships = await db.workspaceMember.findMany({
    where: { userId: session.user.id },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          brandColor: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  const workspaces = memberships.map((m) => ({
    ...m.workspace,
    role: m.role,
  }));

  // If user has no workspaces, redirect to onboarding
  if (workspaces.length === 0) {
    redirect("/onboarding");
  }

  return (
    <AppShell
      user={{
        id: session.user.id,
        name: session.user.name ?? null,
        email: session.user.email ?? "",
        image: session.user.image ?? null,
      }}
      workspaces={workspaces}
    >
      {children}
    </AppShell>
  );
}
