import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/auth-guard";

/**
 * Workspace layout — resolves the current workspace from the URL slug
 * and provides workspace context to all child routes.
 *
 * Every route under /app/[workspaceSlug]/ inherits this.
 * The workspace data is resolved server-side and passed down.
 */
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  // This will redirect to /login if not authenticated or not a member
  const { workspace, membership } = await requireWorkspace(workspaceSlug);

  if (!workspace) {
    notFound();
  }

  // Workspace context is available via the URL params in child routes.
  // For deeper context sharing, use a React context provider here if needed.
  return <>{children}</>;
}
