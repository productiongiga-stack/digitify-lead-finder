"use client";

import { useState } from "react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@digitify/ui";
import { Loader2, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { formatTrpcErrorMessage } from "@/lib/trpc/format-error";

export default function PlatformSettingsPage() {
  const [reason, setReason] = useState("");
  const accounts = trpc.platform.listAccounts.useQuery();
  const status = trpc.platform.updateStatus.useMutation({ onSuccess: () => accounts.refetch() });

  async function openSupport(workspaceId: string, userId: string) {
    if (reason.trim().length < 5) return;
    const response = await fetch("/api/account-view/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId, userId, reason, mode: "VIEW" }) });
    if (!response.ok) throw new Error("Supportmodus kon niet starten.");
    window.location.href = "/dashboard";
  }

  async function actAs(workspaceId: string, userId: string) {
    if (reason.trim().length < 5 || !window.confirm("Je gaat expliciet als dit bedrijf handelen. Externe verzendingen en publicaties kunnen daarna na de normale goedkeuring worden uitgevoerd. Doorgaan?")) return;
    const response = await fetch("/api/account-view/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId, userId, reason, mode: "ACT_AS", confirmExternalActions: true }) });
    if (!response.ok) throw new Error("Handelen als bedrijf kon niet starten.");
    window.location.href = "/dashboard";
  }

  return <div className="app-page space-y-6">
    <div className="app-page-header"><div><h1 className="app-page-title flex items-center gap-2"><ShieldCheck className="h-6 w-6" /> Platformbeheer</h1><p className="app-page-subtitle">Beheer klantbedrijven vanuit een gecontroleerde supportmodus. Elke actie wordt gelogd.</p></div></div>
    <Card><CardHeader><CardTitle className="text-base">Supportreden</CardTitle><CardDescription>Geef kort aan waarom je een klantaccount opent.</CardDescription></CardHeader><CardContent><Label htmlFor="support-reason">Reden</Label><Input id="support-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Bijvoorbeeld: fout bij lead opslaan" className="mt-2 max-w-xl" /></CardContent></Card>
    {accounts.isLoading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Accounts laden…</div> : accounts.isError ? <Card className="border-destructive/30"><CardContent className="pt-6 text-sm text-destructive">{formatTrpcErrorMessage(accounts.error.message)}</CardContent></Card> : <div className="grid gap-4">{accounts.data?.map((account) => <Card key={account.id}><CardHeader className="flex-row items-start justify-between gap-4"><div><CardTitle className="text-base">{account.name}</CardTitle><CardDescription>{account.owner?.name || account.owner?.email || "Onbekende eigenaar"} · {account.memberCount} leden</CardDescription></div><Badge variant={account.owner?.accountStatus === "ACTIVE" ? "secondary" : "destructive"}>{account.owner?.accountStatus || "ONBEKEND"}</Badge></CardHeader><CardContent className="flex flex-wrap items-center gap-2"><Badge variant="outline">{account.owner?.accountClass || "CLIENT_OWNER"}</Badge>{account.modules.slice(0, 6).map((module) => <Badge key={module.moduleId} variant="outline">{module.moduleId}: {module.status}</Badge>)}<div className="ml-auto flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={reason.trim().length < 5} onClick={() => void openSupport(account.id, account.ownerUserId)}>Bekijken</Button><Button size="sm" variant="outline" disabled={reason.trim().length < 5} onClick={() => void actAs(account.id, account.ownerUserId)}>Handelen als bedrijf</Button>{account.owner?.accountStatus === "ACTIVE" ? <Button size="sm" variant="ghost" onClick={() => status.mutate({ userId: account.ownerUserId, status: "SUSPENDED", reason })}>Blokkeren</Button> : <Button size="sm" variant="ghost" onClick={() => status.mutate({ userId: account.ownerUserId, status: "ACTIVE", reason })}>Herstellen</Button>}</div></CardContent></Card>)}</div>}
  </div>;
}
