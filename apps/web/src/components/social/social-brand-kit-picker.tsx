"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  Building2,
  Check,
  Download,
  Hash,
  Link2,
  Loader2,
  Megaphone,
  Palette,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useBranding } from "@/lib/branding";
import { useToast } from "@/components/feedback/toast-provider";
import { uploadSocialAssetFile } from "@/lib/persist-social-assets";
import { SOCIAL_TONE_OPTIONS } from "@/lib/social-tone-options";
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
  kits?: SocialBrandKit[];
  kitsLoading?: boolean;
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

export function kitToApplyPayload(kit: SocialBrandKit): SocialBrandKitApplyPayload {
  return {
    brandSignature:
      kit.brandSignature || (kit.companyName ? `${kit.companyName}${kit.slogan ? ` · ${kit.slogan}` : ""}` : ""),
    hashtags: kit.defaultHashtags || "",
    tone: kit.defaultTone || kit.brandVoice || "warm en professioneel",
    cta: kit.defaultCta || "",
    linkUrl: kit.defaultLinkUrl || kit.website || "",
    template: kit.brandSummary || "",
  };
}

function KitPreviewRow({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value?: string }) {
  if (!value?.trim()) return null;
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="font-medium text-foreground">{label}</p>
        <p className="truncate text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}

function BrandKitCard({
  kit,
  selected,
  disabled,
  onSelect,
}: {
  kit: SocialBrandKit;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const accent = kit.primaryColor || "#f9ae5a";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "group relative w-full rounded-xl border p-3 text-left transition-all",
        selected
          ? "border-amber-500 bg-amber-50/80 shadow-sm ring-2 ring-amber-500/20 dark:bg-amber-950/25"
          : "border-border bg-background/80 hover:border-amber-300 hover:bg-muted/30",
      )}
    >
      {selected ? (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white">
          <Check className="h-3 w-3" />
        </span>
      ) : null}

      <div className="flex items-start gap-3 pr-6">
        {kit.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={kit.logoUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg border bg-white object-contain p-1"
          />
        ) : (
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold text-white"
            style={{ backgroundColor: accent }}
          >
            {(kit.companyName || kit.name).slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold">{kit.name}</p>
            {kit.isDefault ? (
              <Badge variant="secondary" className="text-[10px]">
                Standaard
              </Badge>
            ) : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {kit.companyName || "Geen bedrijfsnaam"}
            {kit.slogan ? ` · ${kit.slogan}` : ""}
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full ring-1 ring-border/60" style={{ backgroundColor: accent }} />
            <span className="text-[10px] text-muted-foreground">{accent}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

export function SocialBrandKitPicker({
  selectedKitId,
  onSelectedKitIdChange,
  onApplyKit,
  kits: kitsProp,
  kitsLoading = false,
  autoApplyDefaults = true,
  disabled = false,
}: Props) {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const { branding: workspaceBranding } = useBranding();
  const [managerOpen, setManagerOpen] = useState(false);
  const kitsQuery = trpc.social.listBrandKits.useQuery(undefined, { enabled: kitsProp === undefined });
  const creativeBrand = trpc.media.getBrandKit.useQuery(undefined, { enabled: managerOpen });

  const kits = (kitsProp ?? kitsQuery.data?.kits ?? []) as SocialBrandKit[];
  const kitsData = kitsQuery.data ?? (kitsProp ? { kits: kitsProp, defaultBrandKitId: kitsProp.find((kit) => kit.isDefault)?.id || kitsProp[0]?.id || "" } : undefined);
  const selectedKit = useMemo(
    () => kits.find((kit) => kit.id === selectedKitId) || kits.find((kit) => kit.isDefault) || kits[0] || null,
    [kits, selectedKitId],
  );
  const applyPreview = useMemo(
    () => (selectedKit ? kitToApplyPayload(selectedKit) : null),
    [selectedKit],
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const autoAppliedRef = useRef(false);

  const upsertKit = trpc.social.upsertBrandKit.useMutation({
    onSuccess: async (kit, variables) => {
      await utils.social.listBrandKits.invalidate();
      const refreshed = await utils.social.listBrandKits.fetch();
      const kitCount = refreshed?.kits.length ?? 0;
      onSelectedKitIdChange(kit.id);
      onApplyKit(kitToApplyPayload(kit as SocialBrandKit));
      setManagerOpen(false);
      setEditingId(null);
      showToast({
        title: variables.id ? "Merkkit opgeslagen" : "Merkkit aangemaakt",
        description: `"${kit.name}" · ${kitCount} merkkit${kitCount === 1 ? "" : "s"} beschikbaar.`,
      });
    },
    onError: (error) => showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const deleteKit = trpc.social.deleteBrandKit.useMutation({
    onSuccess: async (result) => {
      const refreshed = await utils.social.listBrandKits.fetch();
      const nextKit = refreshed?.kits.find((kit) => kit.id === result.defaultBrandKitId);
      onSelectedKitIdChange(result.defaultBrandKitId);
      if (nextKit) onApplyKit(kitToApplyPayload(nextKit as SocialBrandKit));
      setManagerOpen(false);
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
    if (!kitsData || selectedKitId || autoAppliedRef.current) return;
    const defaultId = kitsData.defaultBrandKitId || kitsData.kits[0]?.id;
    if (!defaultId) return;
    autoAppliedRef.current = true;
    onSelectedKitIdChange(defaultId);
    if (autoApplyDefaults) {
      const kit = kits.find((item) => item.id === defaultId);
      if (kit) onApplyKit(kitToApplyPayload(kit));
    }
  }, [autoApplyDefaults, kits, kitsData, onApplyKit, onSelectedKitIdChange, selectedKitId]);

  function buildCreateFormDefaults() {
    const creative = creativeBrand.data;
    const brandSignature = workspaceBranding.companyName
      ? `${workspaceBranding.companyName}${workspaceBranding.companySlogan ? ` · ${workspaceBranding.companySlogan}` : ""}`
      : "";
    return {
      ...EMPTY_FORM,
      name: `Merkkit ${kits.length + 1}`,
      companyName: workspaceBranding.companyName || "",
      slogan: workspaceBranding.companySlogan || "",
      primaryColor: workspaceBranding.primaryColor || EMPTY_FORM.primaryColor,
      logoUrl: workspaceBranding.logoUrl || "",
      website: workspaceBranding.website || "",
      brandVoice: creative?.brandVoice || "",
      brandKeywords: creative?.brandKeywords || "",
      brandAvoid: creative?.brandAvoid || "",
      brandSummary:
        creative?.brandSummary ||
        [creative?.trainingNotes, creative?.businessContext].filter(Boolean).join("\n\n") ||
        "",
      brandSignature,
      defaultLinkUrl: workspaceBranding.website || "",
      includeLogo: creative?.includeLogo ?? true,
    };
  }

  function openCreate() {
    setEditingId(null);
    setForm(buildCreateFormDefaults());
    setManagerOpen(true);
  }

  async function saveBrandKit() {
    await upsertKit.mutateAsync({ id: editingId || undefined, ...form });
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

  function importFromWorkspace() {
    const creative = creativeBrand.data;
    const brandSignature = workspaceBranding.companyName
      ? `${workspaceBranding.companyName}${workspaceBranding.companySlogan ? ` · ${workspaceBranding.companySlogan}` : ""}`
      : "";
    if (!workspaceBranding.companyName && !workspaceBranding.logoUrl && !creative) {
      showToast({ title: "Geen branding gevonden", description: "Stel eerst branding in via Instellingen.", variant: "error" });
      return;
    }

    setForm((current) => ({
      ...current,
      companyName: workspaceBranding.companyName || current.companyName,
      slogan: workspaceBranding.companySlogan || current.slogan,
      primaryColor: workspaceBranding.primaryColor || current.primaryColor,
      logoUrl: workspaceBranding.logoUrl || current.logoUrl,
      website: workspaceBranding.website || current.website,
      brandVoice: creative?.brandVoice || current.brandVoice,
      brandKeywords: creative?.brandKeywords || current.brandKeywords,
      brandAvoid: creative?.brandAvoid || current.brandAvoid,
      brandSummary:
        creative?.brandSummary ||
        [creative?.trainingNotes, creative?.businessContext].filter(Boolean).join("\n\n") ||
        current.brandSummary,
      brandSignature: current.brandSignature || brandSignature || current.brandSignature,
      defaultLinkUrl: workspaceBranding.website || current.defaultLinkUrl,
      includeLogo: creative?.includeLogo ?? current.includeLogo,
    }));

    showToast({ title: "Workspace-branding geïmporteerd" });
  }

  async function uploadLogo(file: File) {
    setLogoUploading(true);
    try {
      const url = await uploadSocialAssetFile(file);
      setForm((current) => ({ ...current, logoUrl: url }));
      showToast({ title: "Logo geüpload" });
    } catch (error) {
      showToast({
        title: "Logo upload mislukt",
        description: error instanceof Error ? error.message : "Onbekende fout",
        variant: "error",
      });
    } finally {
      setLogoUploading(false);
    }
  }

  if (kitsLoading || kitsQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-2 sm:grid-cols-2">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Merkkit</p>
            <p className="text-xs text-muted-foreground">
              Kies een merkprofiel — hashtags, tone, CTA en AI-context worden automatisch ingevuld.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                openCreate();
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nieuw merkkit
            </Button>
            {selectedKit ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(selectedKit)}>
                Beheren
              </Button>
            ) : null}
          </div>
        </div>

        {kits.length ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {kits.length} merkkit{kits.length === 1 ? "" : "s"} — klik om te selecteren
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
            {kits.map((kit) => (
              <BrandKitCard
                key={kit.id}
                kit={kit}
                selected={selectedKit?.id === kit.id}
                disabled={disabled}
                onSelect={() => handleKitChange(kit.id)}
              />
            ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nog geen merkkit. Maak er een aan of importeer vanuit je workspace-branding.
            </p>
            <Button type="button" size="sm" className="mt-4" onClick={openCreate}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nieuw merkkit
            </Button>
          </div>
        )}

        {selectedKit && applyPreview ? (
          <div className="rounded-xl border bg-gradient-to-br from-muted/20 to-amber-50/40 p-4 dark:from-muted/10 dark:to-amber-950/20">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Wordt toegepast op je post
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                disabled={disabled}
                onClick={() => onApplyKit(applyPreview)}
              >
                <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                Opnieuw toepassen
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <KitPreviewRow icon={Building2} label="Brand signature" value={applyPreview.brandSignature} />
              <KitPreviewRow icon={Megaphone} label="Tone of voice" value={applyPreview.tone} />
              <KitPreviewRow icon={Hash} label="Hashtags" value={applyPreview.hashtags} />
              <KitPreviewRow icon={Sparkles} label="CTA" value={applyPreview.cta} />
              <KitPreviewRow icon={Link2} label="Link" value={applyPreview.linkUrl} />
              <KitPreviewRow icon={Wand2} label="AI-template" value={applyPreview.template} />
            </div>
            {!applyPreview.hashtags && !applyPreview.cta && !applyPreview.template ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Dit merkkit heeft nog weinig standaardvelden. Open <strong>Beheren</strong> om hashtags, CTA en AI-context in te stellen.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <CreateModal
        open={managerOpen}
        onOpenChange={setManagerOpen}
        title={editingId ? "Merkkit bewerken" : "Nieuw merkkit"}
        description="Stel merknaam, tone of voice en standaard postvelden in. Deze worden gebruikt in de Social Planner en AI-generatie."
        submitLabel={editingId ? "Opslaan" : "Merkkit aanmaken"}
        submitDisabled={!form.name.trim()}
        pending={upsertKit.isPending}
        asForm
        onSubmit={saveBrandKit}
        contentClassName="z-[200] max-w-2xl"
      >
        <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={importFromWorkspace}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Importeer workspace-branding
            </Button>
            <Button type="button" size="sm" variant="ghost" asChild>
              <Link href="/settings/branding">Instellingen → Branding</Link>
            </Button>
          </div>

          <div className="rounded-xl border bg-muted/10 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identiteit</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Naam merkkit *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                  placeholder="Bijv. Digitify hoofdmerk"
                />
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
                  <Input
                    type="color"
                    className="h-10 w-14 px-1"
                    value={form.primaryColor}
                    onChange={(e) => setForm((c) => ({ ...c, primaryColor: e.target.value }))}
                  />
                  <Input
                    value={form.primaryColor}
                    onChange={(e) => setForm((c) => ({ ...c, primaryColor: e.target.value }))}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input value={form.website} onChange={(e) => setForm((c) => ({ ...c, website: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Logo</Label>
                <div className="flex flex-wrap items-center gap-3">
                  {form.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.logoUrl} alt="" className="h-14 w-14 rounded-lg border bg-white object-contain p-1" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed text-[10px] text-muted-foreground">
                      Geen logo
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-2">
                    <Input
                      value={form.logoUrl}
                      onChange={(e) => setForm((c) => ({ ...c, logoUrl: e.target.value }))}
                      placeholder="https://... of upload"
                    />
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadLogo(file);
                        event.currentTarget.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={logoUploading}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {logoUploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                      Logo uploaden
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/10 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI &amp; tone of voice</p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Merkomschrijving (AI-context)</Label>
                <Textarea
                  value={form.brandSummary}
                  onChange={(e) => setForm((c) => ({ ...c, brandSummary: e.target.value }))}
                  rows={3}
                  placeholder="Wat doet je bedrijf, voor wie, en welke boodschap wil je uitdragen?"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tone of voice (vrij)</Label>
                  <Input value={form.brandVoice} onChange={(e) => setForm((c) => ({ ...c, brandVoice: e.target.value }))} placeholder="Bijv. warm, deskundig, Belgisch" />
                </div>
                <div className="space-y-2">
                  <Label>Standaard AI-tone</Label>
                  <Select value={form.defaultTone} onValueChange={(value) => setForm((c) => ({ ...c, defaultTone: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-[210]">
                      {SOCIAL_TONE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Keywords</Label>
                  <Input value={form.brandKeywords} onChange={(e) => setForm((c) => ({ ...c, brandKeywords: e.target.value }))} placeholder="kmo, marketing, belgië" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Vermijd in content</Label>
                  <Input value={form.brandAvoid} onChange={(e) => setForm((c) => ({ ...c, brandAvoid: e.target.value }))} placeholder="Bijv. goedkoop, agressieve sales" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/10 p-4">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Palette className="h-3.5 w-3.5" />
              Standaard postvelden
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Brand signature</Label>
                <Input value={form.brandSignature} onChange={(e) => setForm((c) => ({ ...c, brandSignature: e.target.value }))} placeholder="Digitify · digitale groei voor KMO's" />
              </div>
              <div className="space-y-2">
                <Label>Standaard CTA</Label>
                <Input value={form.defaultCta} onChange={(e) => setForm((c) => ({ ...c, defaultCta: e.target.value }))} placeholder="Plan een gratis intake" />
              </div>
              <div className="space-y-2">
                <Label>Standaard link</Label>
                <Input value={form.defaultLinkUrl} onChange={(e) => setForm((c) => ({ ...c, defaultLinkUrl: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Standaard hashtags</Label>
                <Input
                  value={form.defaultHashtags}
                  onChange={(e) => setForm((c) => ({ ...c, defaultHashtags: e.target.value }))}
                  placeholder="marketing belgie kmo digitalegroei"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
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
