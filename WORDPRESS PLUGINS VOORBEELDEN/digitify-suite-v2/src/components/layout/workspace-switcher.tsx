"use client";

import { useRouter } from "next/navigation";
import { ChevronsUpDown, Plus, Check } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import type { Role } from "@prisma/client";
import { useState } from "react";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  brandColor: string;
  role: Role;
}

interface WorkspaceSwitcherProps {
  workspaces: Workspace[];
  currentWorkspace: Workspace;
}

export function WorkspaceSwitcher({
  workspaces,
  currentWorkspace,
}: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted"
      >
        {/* Workspace avatar */}
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
          style={{ backgroundColor: currentWorkspace.brandColor }}
        >
          {currentWorkspace.logo ? (
            <img
              src={currentWorkspace.logo}
              alt=""
              className="h-full w-full rounded-lg object-cover"
            />
          ) : (
            initials(currentWorkspace.name)
          )}
        </div>

        {/* Name + role */}
        <div className="flex-1 overflow-hidden">
          <p className="truncate text-sm font-semibold">
            {currentWorkspace.name}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {currentWorkspace.role === "OWNER"
              ? "Eigenaar"
              : currentWorkspace.role === "ADMIN"
                ? "Beheerder"
                : "Lid"}
          </p>
        </div>

        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-card p-1 shadow-lg">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => {
                  router.push(`/${ws.slug}`);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-md p-2 text-sm transition-colors hover:bg-muted"
              >
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white"
                  style={{ backgroundColor: ws.brandColor }}
                >
                  {initials(ws.name)}
                </div>
                <span className="flex-1 truncate text-left">{ws.name}</span>
                {ws.id === currentWorkspace.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}

            <div className="my-1 border-t border-border" />

            <button className="flex w-full items-center gap-3 rounded-md p-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Plus className="h-4 w-4" />
              <span>Nieuwe workspace</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
