"use client";
import { Input, Label, Textarea } from "@digitify/ui";

export function MetaAdObjectFields({ id, kind, value, onChange }: {
  id: string; kind: "targeting" | "creative"; value: string; onChange: (value: string) => void;
}) {
  let data: Record<string, any>;
  try { data = JSON.parse(value); } catch { return <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={10} />; }
  const update = (key: string, next: unknown) => onChange(JSON.stringify({ ...data, [key]: next }, null, 2));
  const link = data.link_data || data.video_data;
  const updateLink = (key: string, next: unknown) => {
    const root = data.link_data ? "link_data" : "video_data";
    update(root, { ...link, [key]: next });
  };
  return <div className="space-y-3 rounded-xl border p-4">
    {kind === "targeting" ? <div className="grid gap-3 sm:grid-cols-2">
      <div><Label htmlFor={id + "-min"}>Minimumleeftijd</Label><Input id={id + "-min"} type="number" min={18} max={65} value={data.age_min ?? 18} onChange={(e) => update("age_min", Number(e.target.value))} /></div>
      <div><Label htmlFor={id + "-max"}>Maximumleeftijd</Label><Input id={id + "-max"} type="number" min={18} max={65} value={data.age_max ?? 65} onChange={(e) => update("age_max", Number(e.target.value))} /></div>
      <div className="sm:col-span-2"><Label htmlFor={id + "-countries"}>Landen (bijvoorbeeld BE, NL)</Label><Input id={id + "-countries"} value={(data.geo_locations?.countries || []).join(", ")}
        onChange={(e) => update("geo_locations", { ...data.geo_locations, countries: e.target.value.split(",").map((v) => v.trim().toUpperCase()).filter(Boolean) })} /></div>
    </div> : link ? <div className="space-y-3">
      <div><Label htmlFor={id + "-text"}>Advertentietekst</Label><Textarea id={id + "-text"} value={link.message || ""} onChange={(e) => updateLink("message", e.target.value)} /></div>
      <div><Label htmlFor={id + "-headline"}>Headline</Label><Input id={id + "-headline"} value={link.name || link.title || ""}
        onChange={(e) => updateLink(data.link_data ? "name" : "title", e.target.value)} /></div>
      {data.link_data ? <>
        <div><Label htmlFor={id + "-description"}>Beschrijving</Label><Input id={id + "-description"} value={link.description || ""} onChange={(e) => updateLink("description", e.target.value)} /></div>
        <div><Label htmlFor={id + "-link"}>Landingspagina</Label><Input id={id + "-link"} value={link.link || ""} onChange={(e) => updateLink("link", e.target.value)} /></div>
        <div><Label htmlFor={id + "-image"}>Afbeelding-URL</Label><Input id={id + "-image"} value={link.picture || ""} onChange={(e) => {
          const next: Record<string, unknown> = { ...link, picture: e.target.value }; delete next.image_hash; update("link_data", next);
        }} /></div>
      </> : <div><Label htmlFor={id + "-video"}>Meta-video-ID</Label><Input id={id + "-video"} value={link.video_id || ""} onChange={(e) => updateLink("video_id", e.target.value)} /></div>}
      <div><Label htmlFor={id + "-cta"}>Call-to-action</Label><select id={id + "-cta"} className="block w-full rounded-md border bg-background p-2" value={link.call_to_action?.type || "LEARN_MORE"}
        onChange={(e) => updateLink("call_to_action", { ...link.call_to_action, type: e.target.value, value: { ...link.call_to_action?.value, link: link.link || link.call_to_action?.value?.link || "" } })}>
        {[...new Set([link.call_to_action?.type || "LEARN_MORE", "LEARN_MORE", "SIGN_UP", "CONTACT_US", "GET_QUOTE", "SHOP_NOW", "BOOK_TRAVEL"])].map((cta) => <option key={cta}>{cta}</option>)}
      </select></div>
      <p className="text-xs text-muted-foreground">Een gewijzigde creative krijgt een nieuwe versie. De bestaande advertentie blijft behouden en wordt gepauzeerd bij de wissel.</p>
    </div> : <p className="text-sm text-muted-foreground">Dit creative-formaat gebruikt de geavanceerde instellingen hieronder.</p>}
    <details><summary className="cursor-pointer text-sm font-medium">Geavanceerde instellingen</summary>
      <Textarea id={id} className="mt-2 font-mono text-xs" rows={10} value={value} onChange={(e) => onChange(e.target.value)} /></details>
  </div>;
}
