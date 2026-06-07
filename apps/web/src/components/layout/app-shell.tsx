"use client";

import { useSidebarLayout, useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { collapsed: sidebarCollapsed } = useSidebarLayout();
  const mobileSidebarOpen = useUIStore((state) => state.mobileSidebarOpen);

  return (
    <div
      className={cn(
        "relative flex max-w-full flex-1 flex-col overflow-x-clip transition-all duration-300",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(180deg,rgba(255,255,255,0.5),transparent_20%)] before:content-[''] dark:before:bg-[linear-gradient(180deg,rgba(15,23,42,0.5),transparent_22%)]",
        mobileSidebarOpen ? "pl-0" : "pl-0 lg:pl-[4.25rem]",
        !mobileSidebarOpen && !sidebarCollapsed ? "lg:pl-60" : ""
      )}
    >
      <div className="relative flex min-h-screen max-w-full flex-col overflow-x-clip">{children}</div>
    </div>
  );
}
