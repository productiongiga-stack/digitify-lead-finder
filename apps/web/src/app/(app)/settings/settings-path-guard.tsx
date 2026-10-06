"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@digitify/ui";
import { ShieldAlert } from "lucide-react";
import { canAccessSettingsPath } from "@/lib/permissions";

export function SettingsPathGuard({
  role,
  children,
  platformRole,
  accountClass,
}: {
  role: string | null | undefined;
  platformRole?: string | null;
  accountClass?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname.startsWith("/settings/platform") && platformRole !== "OWNER" && accountClass !== "PLATFORM_OWNER") {
    return <Card className="border-destructive/30 bg-destructive/5"><CardHeader><CardTitle>Geen toegang</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Platformbeheer is alleen beschikbaar voor Digitify platform-owners.</p><Link href="/settings"><Button variant="outline">Terug naar instellingen</Button></Link></CardContent></Card>;
  }
  if (!canAccessSettingsPath(role, pathname)) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <ShieldAlert className="h-5 w-5" />
            Geen toegang
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Je rol heeft geen rechten om deze instellingen te bekijken of te wijzigen.
          </p>
          <Link href="/settings">
            <Button variant="outline">Terug naar instellingen</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
