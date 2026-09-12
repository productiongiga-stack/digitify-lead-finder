"use client";

import { useRouter } from "next/navigation";
import { Button } from "@digitify/ui";
import { Eye, LogOut } from "lucide-react";

export function AccountViewBanner({ targetName }: { targetName?: string | null }) {
  const router = useRouter();
  async function stop() {
    await fetch("/api/account-view/stop", { method: "POST" });
    router.refresh();
    window.location.href = "/settings/team";
  }

  return (
    <div className="sticky top-0 z-50 flex min-h-10 items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">Je bekijkt dit account als <strong>{targetName || "teamlid"}</strong>.</span>
        <span className="hidden text-amber-800/80 md:inline">Gevoelige acties zijn geblokkeerd.</span>
      </div>
      <Button size="sm" variant="outline" className="h-7 shrink-0 border-amber-400 bg-amber-100 px-2 text-xs hover:bg-amber-200" onClick={stop}>
        <LogOut className="mr-1.5 h-3.5 w-3.5" /> Terug naar mijn account
      </Button>
    </div>
  );
}
