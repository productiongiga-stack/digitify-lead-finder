"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@digitify/ui";
import { ShieldAlert } from "lucide-react";
import { canAccessSettingsPath } from "@/lib/permissions";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (status === "loading") return <>{children}</>;

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
