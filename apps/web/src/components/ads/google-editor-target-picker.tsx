"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button, Label } from "@digitify/ui";

type Target = { adGroupId?: string; adId?: string; assetGroupId?: string };
export function GoogleEditorTargetPicker({ campaignId, pending, onSelect }: {
  campaignId: string; pending: boolean; onSelect: (target: Target) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [choice, setChoice] = useState("");
  const targets = trpc.googleAds.workflowTargets.useQuery({ campaignId }, { enabled, retry: false, staleTime: 30000 });
  const selected = targets.data?.[Number(choice)];
  return <div className="space-y-3 rounded-lg border p-4">
    <p className="text-sm font-medium">Advertentiegroep of assetgroep kiezen</p>
    <p className="text-sm text-muted-foreground">Haal de bestaande RSA’s en PMax-assetgroepen op. Elke keuze krijgt een eigen snapshot en goedkeuringsvoorstel; andere groepen blijven behouden.</p>
    <Button size="sm" variant="outline" disabled={targets.isFetching || pending} onClick={() => { if (enabled) void targets.refetch(); else setEnabled(true); }}>Groepen ophalen</Button>
    {targets.error ? <p role="alert" className="text-sm text-destructive">{targets.error.message}</p> : null}
    {targets.data ? <div className="space-y-2">
      <Label htmlFor="google-editor-target">Bestaande groep en advertentie</Label>
      <select id="google-editor-target" className="w-full rounded-md border bg-background p-3" value={choice} onChange={(e) => setChoice(e.target.value)}>
        <option value="">Kies een groep/RSA</option>{targets.data.map((item, i) => <option key={JSON.stringify(item.target)} value={i}>{item.label}</option>)}
      </select>
      {!targets.data.length ? <p className="text-sm text-muted-foreground">Geen bestaande RSA’s of PMax-assetgroepen gevonden.</p> : null}
      <Button size="sm" disabled={!choice || !selected || pending} onClick={() => { if (selected) onSelect(selected.target); }}>Gekozen onderdeel bewerken</Button>
    </div> : null}
  </div>;
}
