"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  CreateModal,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Switch,
  Textarea,
} from "@digitify/ui";
import { Building2, Palette, Plus, Sparkles, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/components/feedback/toast-provider";
import { cn } from "@/lib/utils";

export type SocialBrandKit = {
  id: string;
  name: string;
  isDefault: boolean;
  companyName: string;
  slogan: string;
  primaryColor: string;
  logoUrl: string;
  website: string;
  brandVoice: string;
  brandKeywords: string;
  brandAvoid: string;
  brandSummary: string;
  brandSignature: string;
  defaultHashtags: string;
  defaultTone: string;
  defaultCta: string;
  defaultLinkUrl: string;
  includeLogo: boolean;
};

export type SocialBrandKitApplyPayload = {
  brandSignature: string;
  hashtags: string;
  tone: string;
  cta: string;
  linkUrl: string;
  template: string;
};

type Props = {
  selectedKitId: string;
  onSelectedKitIdChange: (kitId: string) => void;
  onApplyKit: (payload: SocialBrandKitApplyPayload) => void;
  autoApplyDefaults?: boolean;
  disabled?: boolean;
};

const EMPTY_FORM = {
  name: "",
  companyName: "",
  slogan: "",
  primaryColor: "#f9ae5a",
  logoUrl: "",
  website: "",
  brandVoice: "",
  brandKeywords: "",
  brandAvoid: "",
  brandSummary: "",
  brandSignature: "",
  defaultHashtags: "",
  defaultTone: "warm en professioneel",
  defaultCta: "",
  defaultLinkUrl: "",
  includeLogo: true,
};

function kitToApplyPayload(kit: SocialBrandKit): SocialBrandKitApplyPayload {
  return {
    brandSignature: kit.brandSignature || (kit.companyName ? `${kit.companyName}${kit.slogan ? ` · ${kit.slogan}` : ""}` : ""),
    hashtags: kit.defaultHashtags,
    tone: kit.defaultTone || kit.brandVoice || "warm en professioneel",
    cta: kit.defaultCta,
    linkUrl: kit.defaultLinkUrl || kit.website,
    template: kit.brandSummary,
  };
}

export function SocialBrandKitPicker({
  selectedKitId,
  onSelectedKitIdChange,
  onApplyKit,
  autoApplyDefaults = true,
  disabled = false,
}: Props) {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const kitsQuery = trpc.social.listBrandKits.useQuery();
  const kits = (kitsQuery.data?.kits ?? []) as SocialBrandKit[];
  const selectedKit = useMemo(
    () => kits.find((kit) => kit.id === selectedKitId) || kits.find((kit) => kit.isDefault) || kits[0] || null,
    [kits, selectedKitId],
  );

  const [managerOpen, setManagerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const upsertKit = trpc.social.upsertBrandKit.useMutation({
    onSuccess: async (kit) => {
      await utils.social.listBrandKits.invalidate();
      onSelectedKitIdChange(kit.id);
      onApplyKit(kitToApplyPayload(kit as SocialBrandKit));
      setManagerOpen(false);
      setEditingId(null);
      showToast({ title: "Merkkit opgeslagen", description: `"${kit.name}" is klaar voor gebruik.` });
    },
    onError: (error) => showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const deleteKit = trpc.social.deleteBrandKit.useMutation({
    onSuccess: async (result) => {
      await utils.social.listBrandKits.invalidate();
      onSelectedKitIdChange(result.defaultBrandKitId);
      setEditingId(null);
      showToast({ title: "Merkkit verwijderd" });
    },
    onError: (error) => showToast({ title: "Verwijderen mislukt", description: error.message, variant: "error" }),
  });

  const setDefaultKit = trpc.social.setDefaultBrandKit.useMutation({
    onSuccess: async () => {
      await utils.social.listBrandKits.invalidate();
      showToast({ title: "Standaard merkkit bijgewerkt" });
    },
  });

  useEffect(() => {
    if (!kitsQuery.data || selectedKitId) return;
    const defaultId = kitsQuery.data.defaultBrandKitId || kitsQuery.data.kits[0]?.id;
    if (!defaultId) return;
    onSelectedKitIdChange(defaultId);
    if (autoApplyDefaults) {
      const kit = kits.find((item) => item.id === defaultId);
      if (kit) onApplyKit(kitToApplyPayload(kit));
    }
  }, [autoApplyDefaults, kits, kitsQuery.data, onApplyKit, onSelectedKitIdChange, selectedKitId]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, name: `Merkkit ${kits.length + 1}` });
    setManagerOpen(true);
  }

  function openEdit(kit: SocialBrandKit) {
    setEditingId(kit.id);
    setForm({
      name: kit.name,
      companyName: kit.companyName,
      slogan: kit.slogan,
      primaryColor: kit.primaryColor || "#f9ae5a",
      logoUrl: kit.logoUrl,
      website: kit.website,
      brandVoice: kit.brandVoice,
      brandKeywords: kit.brandKeywords,
      brandAvoid: kit.brandAvoid,
      brandSummary: kit.brandSummary,
      brandSignature: kit.brandSignature,
      defaultHashtags: kit.defaultHashtags,
      defaultTone: kit.defaultTone || "warm en professioneel",
      defaultCta: kit.defaultCta,
      defaultLinkUrl: kit.defaultLinkUrl,
      includeLogo: kit.includeLogo,
    });
    setManagerOpen(true);
  }

  function handleKitChange(kitId: string) {
    onSelectedKitIdChange(kitId);
    const kit = kits.find((item) => item.id === kitId);
    if (kit) onApplyKit(kitToApplyPayload(kit));
  }

  if (kitsQuery.isLoading) {
    return <Skeleton className="h-24 w-full rounded-xl" />;
  }

  return (
    <>
      <div className="space-y-3">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Merkkit</p>
                <p className="text-xs text-muted-foreground">Optioneel — vult hashtags, tone en CTA automatisch in.</p>
              </div>
              <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={openCreate}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Nieuw
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Select value={selectedKit?.id || undefined} onValueChange={handleKitChange} disabled={disabled || !kits.length}>
                <SelectTrigger className="h-10 bg-background/80">
                  <SelectValue placeholder="Kies een merkkit" />
                </SelectTrigger>
                <SelectContent>
                  {kits.map((kit) => (
                    <SelectItem key={kit.id} value={kit.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full ring-1 ring-border/60"
                          style={{ backgroundColor: kit.primaryColor || "#f9ae5a" }}
                        />
                        <span>{kit.name}</span>
                        {kit.isDefault ? <Badge variant="secondary" className="text-[10px]">Standaard</Badge> : null}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedKit ? (
                <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => openEdit(selectedKit)}>
                  Beheren
                </Button>
              ) : null}
            </div>

            {selectedKit?.companyName ? (
              <p className="text-[11px] text-muted-foreground">{selectedKit.companyName}</p>
            ) : null}
          </div>
      </div>

      <CreateModal
        open={managerOpen}
        onOpenChange={setManagerOpen}
        title={editingId ? "Merkkit bewerken" : "Nieuw merkkit"}
        description="Stel merknaam, tone of voice, standaardvelden en AI-context in voor Social Planner."
        submitLabel={editingId ? "Opslaan" : "Merkkit aanmaken"}
        pending={upsertKit.isPending}
        onSubmit={() => upsertKit.mutate({ id: editingId || undefined, ...form })}
      >
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Naam</Label>
              <Input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} placeholder="Bijv. Digitify hoofdmerk" />
            </div>
            <div className="space-y-2">
              <Label>Bedrijfsnaam</Label>
              <Input value={form.companyName} onChange={(e) => setForm((c) => ({ ...c, companyName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Slogan</Label>
              <Input value={form.slogan} onChange={(e) => setForm((c) => ({ ...c, slogan: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Primaire kleur</Label>
              <div className="flex gap-2">
                <Input type="color" className="h-10 w-14 px-1" value={form.primaryColor} onChange={(e) => setForm((c) => ({ ...c, primaryColor: e.target.value }))} />
                <Input value={form.primaryColor} onChange={(e) => setForm((c) => ({ ...c, primaryColor: e.target.value }))} className="font-mono text-sm" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={form.website} onChange={(e) => setForm((c) => ({ ...c, website: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Logo URL</Label>
              <Input value={form.logoUrl} onChange={(e) => setForm((c) => ({ ...c, logoUrl: e.target.value }))} placeholder="https://... of /uploads/..." />
              <p className="text-xs text-muted-foreground">
                Logo en algemene branding beheer je ook via{" "}
                <Link href="/settings/branding" className="text-primary hover:underline">
                  Instellingen → Branding
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Merkomschrijving (AI-context)</Label>
            <Textarea value={form.brandSummary} onChange={(e) => setForm((c) => ({ ...c, brandSummary: e.target.value }))} rows={3} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tone of voice</Label>
              <Input value={form.brandVoice} onChange={(e) => setForm((c) => ({ ...c, brandVoice: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Standaard AI-tone</Label>
              <Input value={form.defaultTone} onChange={(e) => setForm((c) => ({ ...c, defaultTone: e.target.value }))} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Keywords</Label>
              <Input value={form.brandKeywords} onChange={(e) => setForm((c) => ({ ...c, brandKeywords: e.target.value }))} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Vermijd</Label>
              <Input value={form.brandAvoid} onChange={(e) => setForm((c) => ({ ...c, brandAvoid: e.target.value }))} />
            </div>
          </div>

          <div className="rounded-xl border bg-muted/15 p-3">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Palette className="h-3.5 w-3.5" />
              Standaard postvelden
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Brand signature</Label>
                <Input value={form.brandSignature} onChange={(e) => setForm((c) => ({ ...c, brandSignature: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Standaard CTA</Label>
                <Input value={form.defaultCta} onChange={(e) => setForm((c) => ({ ...c, defaultCta: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Standaard link</Label>
                <Input value={form.defaultLinkUrl} onChange={(e) => setForm((c) => ({ ...c, defaultLinkUrl: e.target.value }))} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Standaard hashtags</Label>
                <Input value={form.defaultHashtags} onChange={(e) => setForm((c) => ({ ...c, defaultHashtags: e.target.value }))} placeholder="marketing belgie kmo" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Logo meenemen in AI-beelden</p>
              <p className="text-xs text-muted-foreground">Gebruikt het logo als referentie bij beeldgeneratie.</p>
            </div>
            <Switch checked={form.includeLogo} onCheckedChange={(checked) => setForm((c) => ({ ...c, includeLogo: checked }))} />
          </div>

          {editingId ? (
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={setDefaultKit.isPending}
                onClick={() => setDefaultKit.mutate({ id: editingId })}
              >
                <Building2 className="mr-1.5 h-3.5 w-3.5" />
                Maak standaard
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={deleteKit.isPending || kits.length <= 1}
                onClick={() => deleteKit.mutate({ id: editingId })}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Verwijderen
              </Button>
            </div>
          ) : null}
        </div>
      </CreateModal>
    </>
  );
}
