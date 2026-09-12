"use client";

import { Search, Bell, Plus } from "lucide-react";
import { initials } from "@/lib/utils";
import { useCommandPalette } from "@/hooks/use-command-palette";

interface CommandBarProps {
  user: {
    name: string | null;
    email: string;
    image: string | null;
  };
}

/**
 * Top command bar — search trigger, quick actions, notifications, user menu.
 * Sits above the main content area. Slim and unobtrusive.
 */
export function CommandBar({ user }: CommandBarProps) {
  const { open: openPalette } = useCommandPalette();

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card px-6">
      {/* Search trigger */}
      <button
        onClick={openPalette}
        className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
      >
        <Search className="h-4 w-4" />
        <span>Zoeken of commando uitvoeren...</span>
        <kbd className="ml-auto hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </button>

      {/* Quick create */}
      <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90">
        <Plus className="h-4 w-4" />
      </button>

      {/* Notifications */}
      <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
        <Bell className="h-4 w-4" />
        {/* Unread badge */}
        {/* <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-destructive" /> */}
      </button>

      {/* User avatar */}
      <button className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
        {user.image ? (
          <img
            src={user.image}
            alt=""
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          initials(user.name ?? user.email)
        )}
      </button>
    </header>
  );
}
