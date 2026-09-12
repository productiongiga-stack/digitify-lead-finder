"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { navigation, bottomNavigation } from "@/config/navigation";
import { WorkspaceSwitcher } from "./workspace-switcher";
import type { Role } from "@prisma/client";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  brandColor: string;
  role: Role;
}

interface SidebarProps {
  user: { id: string; name: string | null; email: string; image: string | null };
  workspaces: Workspace[];
  currentWorkspace: Workspace;
  currentPath: string;
}

export function Sidebar({
  user,
  workspaces,
  currentWorkspace,
  currentPath,
}: SidebarProps) {
  const basePath = `/${currentWorkspace.slug}`;

  function isActive(href: string): boolean {
    const fullPath = `${basePath}${href}`;
    if (href === "") return currentPath === basePath || currentPath === `${basePath}/`;
    return currentPath.startsWith(fullPath);
  }

  return (
    <aside className="flex w-[260px] flex-col border-r border-border bg-card">
      {/* Workspace switcher */}
      <div className="border-b border-border p-3">
        <WorkspaceSwitcher
          workspaces={workspaces}
          currentWorkspace={currentWorkspace}
        />
      </div>

      {/* Main navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {navigation.map((section, sIdx) => (
          <div key={sIdx} className="mb-1">
            {section.label && (
              <p className="mb-1 mt-4 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </p>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={`${basePath}${item.href}`}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom navigation */}
      <div className="border-t border-border px-3 py-2">
        {bottomNavigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={`${basePath}${item.href}`}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
