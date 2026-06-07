"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
  Switch,
  Textarea,
} from "@digitify/ui";
import { applyBrandToGeneration } from "@digitify/media-studio";
import { Building2, Loader2, Palette, Save, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/components/feedback/toast-provider";
import { GeneratorShell, studioSectionClass } from "./creative-studio-ui";
import { cn } from "@/lib/utils";

const PROMPT_TEMPLATES = [
  {
    id: "product",
    label: "Product",
    prompt: "Premium productfoto op neutrale achtergrond, zacht studiolicht, commerciële look",
  },
  {
    id: "testimonial",
    label: "Testimonial",
    prompt: "Authentiek lifestylebeeld met tevreden klant, warme Belgische setting, vertrouwen",
  },
  {
    id: "behind-scenes",
    label: "Behind the scenes",
    prompt: "Behind-the-scenes moment op kantoor, candid energie, team aan het werk",
  },
] as const;

export function BrandKitPanel() {
  const { showToast } = useToast();
  const brandKit = trpc.media.getBrandKit.useQuery();
  const utils = trpc.useUtils();

  const [brandEnabled, setBrandEnabled] = useState(true);
  const [includeLogo, setIncludeLogo] = useState(true);
  const [brandVoice, setBrandVoice] = useState("");
  const [brandKeywords, setBrandKeywords] = useState("");
  const [brandAvoid, setBrandAvoid] = useState("");
  const [brandSummary, setBrandSummary] = useState("");
  const [previewPrompt, setPreviewPrompt] = useState<string>(PROMPT_TEMPLATES[0].prompt);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!brandKit.data || loaded) return;
    setBrandEnabled(brandKit.data.enabled);
    setIncludeLogo(brandKit.data.includeLogo);
    setBrandVoice(brandKit.data.brandVoice ?? "");
    setBrandKeywords(brandKit.data.brandKeywords ?? "");
    setBrandAvoid(brandKit.data.brandAvoid ?? "");
    setBrandSummary(
      brandKit.data.brandSummary ??
        [brandKit.data.trainingNotes, brandKit.data.businessContext].filter(Boolean).join("\n\n"),
    );
    setLoaded(true);
  }, [brandKit.data, loaded]);

  const saveBrandKit = trpc.media.saveBrandKit.useMutation({
    onSuccess: async () => {
      await utils.media.getBrandKit.invalidate();
      showToast({ title: "Merkkit opgeslagen", description: "AI-generaties gebruiken nu je merkcontext." });
    },
    onError: (error) =>
      showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const data = brandKit.data;

  if (brandKit.isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <GeneratorShell
      icon={Building2}
      title="Merkkit voor AI"
      description="Leer de AI over je bedrijf: naam, slogan, logo en tone of voice worden automatisch aan elke generatie toegevoegd."
      brandActive={brandEnabled}
    >
        <div className={cn(studioSectionClass, "flex flex-wrap items-center gap-3 !border-solid bg-card")}>
          {data?.logoUrl ? (
            <img
              src={data.logoUrl}
              alt={data.companyName || "Logo"}
              className="h-14 w-14 rounded-lg border bg-background object-contain p-1"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
              Geen logo
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate font-medium">{data?.companyName || "Bedrijfsnaam niet ingesteld"}</p>
            <p className="truncate text-sm text-muted-foreground">{data?.slogan || "Geen slogan"}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {data?.primaryColor ? (
                <span className="inline-flex items-center gap-1">
                  <Palette className="h-3 w-3" />
                  <span
                    className="inline-block h-3 w-3 rounded-full border"
                    style={{ backgroundColor: data.primaryColor }}
                  />
                  {data.primaryColor}
                </span>
              ) : null}
              {data?.niche ? <Badge variant="outline">{data.niche}</Badge> : null}
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/branding">Logo &amp; branding</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/10 p-4">
            <div>
              <p className="text-sm font-medium">Merkcontext gebruiken</p>
              <p className="text-xs text-muted-foreground">Voeg bedrijfsinfo toe aan elke prompt</p>
            </div>
            <Switch checked={brandEnabled} onCheckedChange={setBrandEnabled} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/10 p-4">
            <div>
              <p className="text-sm font-medium">Logo meesturen</p>
              <p className="text-xs text-muted-foreground">Gebruik logo als referentiebeeld waar mogelijk</p>
            </div>
            <Switch checked={includeLogo} onCheckedChange={setIncludeLogo} disabled={!data?.logoUrl} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="brand-summary">Over je bedrijf (voor de AI)</Label>
          <Textarea
            id="brand-summary"
            rows={4}
            value={brandSummary}
            onChange={(event) => setBrandSummary(event.target.value)}
            placeholder="Bijv. Digitify helpt Belgische KMO's met leadgeneratie, social media en automatisering. Doelgroep: ondernemers 25-55 jaar."
          />
          <p className="text-xs text-muted-foreground">
            Tip: chatbot-training en OpenClaw business context worden ook automatisch meegenomen als ze ingevuld zijn.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="brand-voice">Tone of voice</Label>
            <Input
              id="brand-voice"
              value={brandVoice}
              onChange={(event) => setBrandVoice(event.target.value)}
              placeholder="professioneel, warm, Belgisch"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-keywords">Merkwoorden</Label>
            <Input
              id="brand-keywords"
              value={brandKeywords}
              onChange={(event) => setBrandKeywords(event.target.value)}
              placeholder="premium, minimalistisch, vertrouwen"
            />
          </div>
        </div>

        <div className={studioSectionClass}>
          <Label>Prompt templates</Label>
          <p className="mb-2 text-xs text-muted-foreground">
            Snelle startpunten voor social posts. Klik om de preview te vullen.
          </p>
          <div className="flex flex-wrap gap-2">
            {PROMPT_TEMPLATES.map((template) => (
              <Button
                key={template.id}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPreviewPrompt(template.prompt)}
              >
                {template.label}
              </Button>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            <Label htmlFor="brand-preview-prompt">Live merk-preview</Label>
            <Textarea
              id="brand-preview-prompt"
              rows={3}
              value={previewPrompt}
              onChange={(event) => setPreviewPrompt(event.target.value)}
            />
            <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Verrijkte prompt</p>
              <p className="whitespace-pre-wrap leading-relaxed">
                {
                  applyBrandToGeneration(
                    {
                      enabled: brandEnabled,
                      includeLogo,
                      companyName: data?.companyName,
                      slogan: data?.slogan,
                      brandVoice,
                      brandKeywords,
                      brandAvoid,
                      brandSummary,
                      logoUrl: data?.logoUrl,
                    },
                    { prompt: previewPrompt, modelType: "IMAGE" },
                  ).prompt
                }
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="brand-avoid">Vermijd in beelden</Label>
          <Input
            id="brand-avoid"
            value={brandAvoid}
            onChange={(event) => setBrandAvoid(event.target.value)}
            placeholder="geen clipart, geen felle neon, geen stockfoto-gezichten"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() =>
              saveBrandKit.mutate({
                brandEnabled,
                includeLogo,
                brandVoice,
                brandKeywords,
                brandAvoid,
                brandSummary,
              })
            }
            disabled={saveBrandKit.isPending}
          >
            {saveBrandKit.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Merkkit opslaan
          </Button>
          {brandEnabled ? (
            <Badge className="gap-1">
              <Sparkles className="h-3 w-3" />
              Merkcontext actief
            </Badge>
          ) : (
            <Badge variant="secondary">Merkcontext uit</Badge>
          )}
        </div>
    </GeneratorShell>
  );
}
