"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { invalidateWorkspaceScopedCache } from "@/lib/invalidate-workspace-cache";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
} from "@digitify/ui";
import { Building2, Check, ChevronDown, Layers, UserCircle } from "lucide-react";

export function WorkspaceSwitcher() {
  const router = useRouter();
  const { update } = useSession();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);

  const { data: workspaces, isLoading } = trpc.workspace.listMine.useQuery(undefined, {
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const { data: invitations } = trpc.workspace.listPendingInvitations.useQuery(undefined, {
    enabled: open,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const switchWorkspace = trpc.workspace.switch.useMutation({
    onSuccess: async () => {
      await update();
      await invalidateWorkspaceScopedCache(utils);
      router.refresh();
    },
  });

  const active = workspaces?.find((item) => item.isActive);
  const pendingCount = invitations?.length ?? 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="hidden h-9 max-w-[220px] items-center gap-2 rounded-xl border-border/70 bg-card/70 px-3 text-xs font-medium sm:inline-flex"
        >
          {active?.isPersonal ? (
            <UserCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{active?.name || "Werkruimte"}</span>
          {open && pendingCount > 0 ? (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {pendingCount}
            </Badge>
          ) : null}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {isLoading ? (
          <div className="p-3">
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="mt-2 h-8 w-full rounded-lg" />
          </div>
        ) : (
          <>
            <DropdownMenuLabel className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Layers className="h-3.5 w-3.5" />
              Werkruimte
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces?.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                disabled={switchWorkspace.isPending || workspace.status === "INVITED"}
                className="flex items-start gap-2 py-2"
                onClick={() => {
                  if (workspace.isActive || workspace.status === "INVITED") return;
                  switchWorkspace.mutate({ workspaceId: workspace.id });
                }}
              >
                <div className="mt-0.5 shrink-0">
                  {workspace.isPersonal ? (
                    <UserCircle className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{workspace.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {workspace.isPersonal ? "Persoonlijk" : workspace.role || "Lid"}
                    {workspace.isActive ? " · actief" : ""}
                  </p>
                </div>
                {workspace.isActive ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
              </DropdownMenuItem>
            ))}
            {pendingCount > 0 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {pendingCount} openstaande uitnodiging{pendingCount === 1 ? "" : "en"}
                </DropdownMenuLabel>
              </>
            ) : null}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
