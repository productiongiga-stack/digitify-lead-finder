"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Handshake,
  FileText,
  Calendar,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import { useCommandPalette } from "@/hooks/use-command-palette";

/**
 * Global command palette (⌘K). Provides quick navigation, search, and
 * actions from anywhere in the app. Uses cmdk for the command interface.
 *
 * This is a simplified scaffold — production version would use cmdk library
 * with fuzzy search across contacts, deals, quotes, etc.
 */
export function CommandPalette({ workspaceSlug }: { workspaceSlug: string }) {
  const { isOpen, close, toggle } = useCommandPalette();
  const router = useRouter();

  // Keyboard shortcut: ⌘K
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape" && isOpen) {
        close();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, toggle, close]);

  if (!isOpen) return null;

  const navigate = (path: string) => {
    router.push(`/${workspaceSlug}${path}`);
    close();
  };

  const commands = [
    {
      group: "Navigatie",
      items: [
        { label: "Dashboard", icon: Search, action: () => navigate("") },
        { label: "Contacten", icon: Users, action: () => navigate("/contacts") },
        { label: "Deals", icon: Handshake, action: () => navigate("/deals") },
        { label: "Offertes", icon: FileText, action: () => navigate("/quotes") },
        { label: "Planning", icon: Calendar, action: () => navigate("/scheduling") },
        { label: "Instellingen", icon: Settings, action: () => navigate("/settings/general") },
      ],
    },
    {
      group: "Snel aanmaken",
      items: [
        { label: "Nieuw contact", icon: Plus, action: () => navigate("/contacts?new=1") },
        { label: "Nieuwe deal", icon: Plus, action: () => navigate("/deals?new=1") },
        { label: "Nieuwe offerte", icon: Plus, action: () => navigate("/quotes/new") },
      ],
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={close}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 rounded-xl border border-border bg-card shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            placeholder="Zoek contacten, deals, offertes..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Command groups */}
        <div className="max-h-[300px] overflow-y-auto p-2">
          {commands.map((group) => (
            <div key={group.group}>
              <p className="mb-1 mt-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.group}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={item.action}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
