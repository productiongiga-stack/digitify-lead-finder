"use client";

import { usePathname } from "next/navigation";
import { useMyModules } from "@/components/layout/modules-provider";
import { isModuleDisabled, moduleLabel, resolveModuleIdForPath } from "@/lib/module-access";
import { Button, Card, CardContent } from "@digitify/ui";
import { RouteLoading } from "@/components/layout/route-states";
import { Lock } from "lucide-react";
import Link from "next/link";

export function ModuleAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data, isLoading } = useMyModules();

  if (isLoading) {
    return <RouteLoading />;
  }

  const disabled = new Set(data?.disabled ?? []);
  const moduleId = resolveModuleIdForPath(pathname);
  const blocked = isModuleDisabled(pathname, disabled);

  if (!blocked) {
    return <>{children}</>;
  }

  if (moduleId) {
    return (
      <Card className="mx-auto mt-8 max-w-lg border-dashed">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold">Module niet beschikbaar</p>
            <p className="text-sm text-muted-foreground">
              {moduleLabel(moduleId)} is uitgeschakeld voor jouw account. Vraag de workspace-eigenaar om toegang
              via Instellingen → Team & Rollen.
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard">Naar dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
