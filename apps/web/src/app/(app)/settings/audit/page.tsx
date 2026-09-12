"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle, Badge, Skeleton } from "@digitify/ui";
import { ShieldCheck } from "lucide-react";

const labels: Record<string, string> = {
  ACCOUNT_VIEW_STARTED: "Accountweergave gestart",
  ACCOUNT_VIEW_ENDED: "Accountweergave beëindigd",
  MODULE_CHANGED: "Module gewijzigd",
  ROLE_CHANGED: "Rol gewijzigd",
  WORKSPACE_SWITCHED: "Workspace gewisseld",
};

export default function SecurityAuditPage() {
  const audit = trpc.securityAudit.list.useQuery({ limit: 100 }, { staleTime: 30_000 });
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
        <div><h1 className="text-xl font-bold tracking-tight">Security auditlog</h1><p className="text-sm text-muted-foreground">Beheeracties en accountweergave binnen deze workspace.</p></div>
      </div>
      <Card>
        <CardHeader><CardTitle>Recente acties</CardTitle></CardHeader>
        <CardContent className="p-0">
          {audit.isLoading ? <div className="space-y-3 p-5"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div> : audit.error ? <p className="p-5 text-sm text-destructive">{audit.error.message}</p> : audit.data?.length ? (
            <div className="divide-y">
              {audit.data.map((event) => <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"><div><p className="font-medium">{labels[event.action] || event.action}</p><p className="text-xs text-muted-foreground">{event.reason || event.resource || "Beveiligingsactie"} · {new Date(event.createdAt).toLocaleString("nl-BE")}</p></div><Badge variant={event.result === "SUCCESS" ? "secondary" : "destructive"}>{event.result === "SUCCESS" ? "Geslaagd" : event.result === "DENIED" ? "Geweigerd" : "Mislukt"}</Badge></div>)}
            </div>
          ) : <p className="p-5 text-sm text-muted-foreground">Nog geen security-acties geregistreerd.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
