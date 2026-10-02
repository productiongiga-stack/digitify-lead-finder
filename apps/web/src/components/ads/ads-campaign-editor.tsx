"use client";

import { useState } from "react";
import { MetaAdObjectFields } from "./meta-ad-object-fields";
import { Button, Input, Label, Textarea, Tabs, TabsContent, TabsList, TabsTrigger } from "@digitify/ui";

type Snapshot = Record<string, any>;
type Field = { path: string; label: string; kind?: "number" | "list" | "json" | "boolean"; group: string };
export type AdPatch = { path: string; value: unknown };
const groups = [
  ["campaign", "Campagne"], ["budget", "Budget & planning"], ["targeting", "Targeting"],
  ["bidding", "Bieden"], ["creative", "Tekst & links"], ["media", "Media & CTA"],
  ["tracking", "Tracking"], ["preview", "Preview & controle"],
] as const;
const atPath = (value: Snapshot, path: string): any => path.split(".").reduce((v, k) => v?.[k], value);

function fieldsFor(provider: "GOOGLE" | "META", snapshot: Snapshot): Field[] {
  if (provider === "GOOGLE") return [
    { path: "name", label: "Campagnenaam", group: "campaign" },
    { path: "dailyBudgetCents", label: "Dagbudget in centen (€49 = 4900)", kind: "number", group: "budget" },
    ...["keywords", "negativeKeywords", "geoTargetConstants", "languageConstants"].map((key) => ({
      path: "targeting." + key, label: ({ keywords: "Zoekwoorden", negativeKeywords: "Uitsluitingswoorden", geoTargetConstants: "Google locatie-ID’s", languageConstants: "Google taal-ID’s" } as Record<string, string>)[key]!,
      kind: "list" as const, group: "targeting",
    })),
    { path: "targeting.adGroupName", label: "Advertentiegroep", group: "targeting" },
    { path: "targeting.matchType", label: "Matchtype (BROAD / PHRASE / EXACT)", group: "targeting" },
    { path: "targeting.searchPartners", label: "Zoekpartners", kind: "boolean", group: "targeting" },
    { path: "targeting.displayExpansion", label: "Display-uitbreiding", kind: "boolean", group: "targeting" },
    ...["headlines", "descriptions", ...(snapshot.campaignType === "PERFORMANCE_MAX" ? ["longHeadlines"] : [])].map((key) => ({
      path: "creatives." + key, label: key === "headlines" ? "Headlines (één per regel)" : key === "descriptions" ? "Beschrijvingen (één per regel)" : "Lange headlines",
      kind: "list" as const, group: "creative",
    })),
    ...["finalUrl", "path1", "path2"].map((key) => ({ path: "creatives." + key, label: key === "finalUrl" ? "Landingspagina" : key, group: "creative" })),
    ...(snapshot.campaignType === "PERFORMANCE_MAX" ? ["businessName", "assetGroupName", "imageUrl", "squareImageUrl", "logoUrl", "portraitImageUrl", "landscapeLogoUrl"].map((key) => ({ path: "creatives." + key, label: key, group: "media" })) : []),
    ...["trackingTemplate", "finalUrlSuffix"].map((key) => ({ path: "targeting.campaignSettings." + key, label: key === "trackingTemplate" ? "Trackingtemplate" : "URL-suffix", group: "tracking" })),
  ];
  const fields: Field[] = [{ path: "campaign.name", label: "Campagnenaam", group: "campaign" }];
  for (const key of ["daily_budget", "lifetime_budget"]) if (snapshot.campaign[key] != null) fields.push({
    path: "campaign." + key, label: key === "daily_budget" ? "Campagnedagbudget (centen)" : "Campagne lifetime-budget (centen)", group: "budget", kind: "number",
  });
  snapshot.adsets.forEach((adset: Snapshot, i: number) => {
    const base = "adsets." + i;
    fields.push({ path: base + ".name", label: "Ad set: " + adset.name, group: "campaign" });
    for (const key of ["daily_budget", "lifetime_budget", "start_time", "end_time"]) if (adset[key] != null) fields.push({
      path: base + "." + key, label: adset.name + " · " + key, group: "budget", kind: key.includes("budget") ? "number" : undefined,
    });
    fields.push({ path: base + ".targeting", label: adset.name + " · doelgroep (geavanceerd)", group: "targeting", kind: "json" });
    if (adset.bid_amount != null) fields.push({ path: base + ".bid_amount", label: adset.name + " · biedbedrag (centen)", group: "bidding", kind: "number" });
    adset.ads.forEach((ad: Snapshot, j: number) => {
      fields.push({ path: base + ".ads." + j + ".name", label: "Advertentie: " + ad.name, group: "creative" });
      if (ad.creative?.object_story_spec) fields.push({ path: base + ".ads." + j + ".creative.object_story_spec",
        label: ad.name + " · tekst, link, media en CTA (geavanceerd)", group: "media", kind: "json" });
    });
  });
  return fields;
}

export function AdsCampaignEditor({ provider, snapshot, pending, onSubmit }: {
  provider: "GOOGLE" | "META"; snapshot: Snapshot; pending: boolean;
  onSubmit: (patches: AdPatch[], reason: string) => Promise<unknown>;
}) {
  const fields = fieldsFor(provider, snapshot);
  const [values, setValues] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const initialValue = (field: Field) => {
    const value = atPath(snapshot, field.path);
    return field.kind === "list" ? (value || []).join("\n") : field.kind === "json" ? JSON.stringify(value || {}, null, 2) : String(value ?? "");
  };
  const patches = (): AdPatch[] => fields.filter((f) => values[f.path] !== undefined && values[f.path] !== initialValue(f))
    .map((f) => ({ path: f.path, value: f.kind === "json" ? JSON.parse(values[f.path]!) : f.kind === "list" ? values[f.path]!.split("\n").map((v) => v.trim()).filter(Boolean)
      : f.kind === "number" ? Number(values[f.path]) : f.kind === "boolean" ? values[f.path] === "true" : values[f.path] }));
  async function submit() {
    setError("");
    try { await onSubmit(patches(), reason); }
    catch (err) { setError(err instanceof Error ? err.message : "Opslaan mislukt."); }
  }
  return <div className="space-y-5">
    {provider === "GOOGLE" ? <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">Je bewerkt {snapshot.editorTarget?.adId ? `RSA ${snapshot.editorTarget.adId} in advertentiegroep ${snapshot.editorTarget.adGroupId}` : snapshot.editorTarget?.assetGroupId ? `PMax-assetgroep ${snapshot.editorTarget.assetGroupId}` : "het standaard campagneonderdeel"}. Andere groepen blijven behouden. PMax-targeting, biedstrategieën, conversiedoelen en video’s zijn alleen-lezen; nieuwe PMax-beelden worden toegevoegd zonder bestaande beelden te verwijderen.</p> : null}
    <Tabs defaultValue="campaign">
      <TabsList className="flex h-auto flex-wrap justify-start gap-1">{groups.map(([id, title]) => <TabsTrigger key={id} value={id}>{title}</TabsTrigger>)}</TabsList>
      {groups.map(([id]) => <TabsContent value={id} key={id} className="space-y-4">
        {fields.filter((f) => f.group === id).map((field) => <fieldset className="space-y-2" key={field.path} disabled={pending || (provider === "GOOGLE" && snapshot.campaignType === "PERFORMANCE_MAX" && (field.group === "targeting" || /^creatives\.path[12]$/.test(field.path)))}>
          <Label htmlFor={"ad-" + field.path}>{field.label}</Label>
          {field.kind === "boolean" ? <select id={"ad-" + field.path} className="block rounded-md border bg-background p-2" value={values[field.path] ?? initialValue(field)}
            onChange={(e) => setValues((v) => ({ ...v, [field.path]: e.target.value }))}><option value="true">Aan</option><option value="false">Uit</option></select>
          : field.kind === "json" && provider === "META" ? <MetaAdObjectFields id={"ad-" + field.path} kind={field.group === "targeting" ? "targeting" : "creative"}
            value={values[field.path] ?? initialValue(field)} onChange={(value) => setValues((v) => ({ ...v, [field.path]: value }))} />
          : field.kind === "json" || field.kind === "list" ? <Textarea id={"ad-" + field.path} rows={field.kind === "json" ? 12 : 4}
            value={values[field.path] ?? initialValue(field)} onChange={(e) => setValues((v) => ({ ...v, [field.path]: e.target.value }))} />
          : <Input id={"ad-" + field.path} type={field.kind === "number" ? "number" : "text"} value={values[field.path] ?? initialValue(field)}
            onChange={(e) => setValues((v) => ({ ...v, [field.path]: e.target.value }))} />}
          {provider === "GOOGLE" && snapshot.campaignType === "PERFORMANCE_MAX" && (field.group === "targeting" || /^creatives\.path[12]$/.test(field.path)) ? <p className="text-xs text-muted-foreground">Alleen-lezen voor Performance Max; bestaande instellingen blijven behouden.</p> : null}
        </fieldset>)}
        {id === "preview" ? <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Je voorstel wordt lokaal gevalideerd. Google/Meta controleren het advertentiebeleid bij publicatie. Een nieuwe Meta-creative blijft gepauzeerd.</p>
          {fields.filter((f) => values[f.path] !== undefined && values[f.path] !== initialValue(f)).map((f) => <div key={f.path} className="rounded-lg border p-3 text-sm">
            <p className="font-medium">{f.label}</p><div className="mt-2 grid gap-3 md:grid-cols-2"><pre className="whitespace-pre-wrap break-all text-muted-foreground">{initialValue(f)}</pre><pre className="whitespace-pre-wrap break-all">{values[f.path]}</pre></div>
          </div>)}
        </div> : !fields.some((f) => f.group === id) ? <p className="text-sm text-muted-foreground">Deze instellingen zijn voor dit campagnetype alleen-lezen. De bestaande instellingen blijven behouden.</p> : null}
      </TabsContent>)}
    </Tabs>
    <Label htmlFor="ad-change-reason">Reden voor deze wijziging</Label>
    <Textarea id="ad-change-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Wat wil je verbeteren?" />
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    <Button disabled={pending || reason.trim().length < 3 || !Object.keys(values).length} onClick={submit}>{pending ? "Opslaan…" : "Voorstel ter goedkeuring opslaan"}</Button>
  </div>;
}
