"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { CommandBar } from "./command-bar";
import { CommandPalette } from "./command-palette";
import type { Role } from "@prisma/client";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  brandColor: string;
  role: Role;
}

interface AppUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface AppShellProps {
  user: AppUser;
  workspaces: Workspace[];
  children: React.ReactNode;
}

/**
 * App Shell — the main layout container for the authenticated app.
 *
 * Structure:
 * ┌─────────┬────────────────────────────────────┐
 * │         │ Command Bar (search + actions)      │
 * │ Sidebar ├────────────────────────────────────┤
 * │         │                                    │
 * │         │ Page Content (children)            │
 * │         │                                    │
 * └─────────┴────────────────────────────────────┘
 */
export function AppShell({ user, workspaces, children }: AppShellProps) {
  const pathname = usePathname();

  // Extract current workspace slug from pathname
  const segments = pathname.split("/").filter(Boolean);
  const currentSlug = segments[0] ?? workspaces[0]?.slug;
  const currentWorkspace = workspaces.find((w) => w.slug === currentSlug);

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      {/* Sidebar */}
      <Sidebar
        user={user}
        workspaces={workspaces}
        currentWorkspace={currentWorkspace ?? workspaces[0]}
        currentPath={pathname}
      />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top command bar */}
        <CommandBar user={user} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-6 py-6">
            {children}
          </div>
        </main>
      </div>

      {/* Command palette (⌘K) — renders as a portal */}
      <CommandPalette workspaceSlug={currentSlug} />
    </div>
  );
}
