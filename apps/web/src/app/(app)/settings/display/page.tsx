"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { readSettingString } from "@/lib/settings";
import { useToast } from "@/components/feedback/toast-provider";
import {
  ArrowLeft,
  Loader2,
  Save,
  SlidersHorizontal,
  Type,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@digitify/ui";

type Density = "comfortable" | "compact";
type TypographyMode = "compact" | "normal";

function applyDensityToDocument(value: Density) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-density", value);
  try {
    localStorage.setItem("ui-density", value);
  } catch {
    // ignore storage errors
  }
}

export default function DisplaySettingsPage() {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const { data: settings, isLoading, error, refetch } = trpc.settings.getAll.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const [density, setDensity] = useState<Density>("comfortable");
  const [typographyMode, setTypographyMode] = useState<TypographyMode>("compact");

  const batchUpdate = trpc.settings.batchUpdate.useMutation({
    onSuccess: () => {
      utils.settings.getAll.invalidate();
      showToast({
        title: "Weergave opgeslagen",
        description: "De dichtheid van de interface is bijgewerkt.",
      });
    },
    onError: (mutationError) => {
      showToast({
        title: "Opslaan mislukt",
        description: mutationError.message,
        variant: "error",
      });
    },
  });

  useEffect(() => {
    const settingDensity = readSettingString(settings, "ui.density", "comfortable");
    const normalized = settingDensity === "compact" ? "compact" : "comfortable";
    const settingTypography = readSettingString(settings, "display.typography_mode", "compact");
    const normalizedTypography: TypographyMode = settingTypography === "normal" ? "normal" : "compact";
    setDensity(normalized);
    setTypographyMode(normalizedTypography);
    applyDensityToDocument(normalized);
  }, [settings]);

  function handleSave() {
    batchUpdate.mutate([
      { key: "ui.density", value: density },
      { key: "display.typography_mode", value: typographyMode },
    ]);
    applyDensityToDocument(density);
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Weergave-instellingen konden niet geladen worden</p>
          <p className="mt-1 text-muted-foreground">{error.message}</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => refetch()}>
            Opnieuw proberen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Weergave</h1>
          <p className="text-sm text-muted-foreground">Kies een compactere of ruimere interface</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Interface dichtheid</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Compact maakt tekst en spacing kleiner. Standaard gebruikt meer witruimte.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Weergavemodus</Label>
            <Select
              value={density}
              onValueChange={(value) => {
                const nextDensity: Density = value === "compact" ? "compact" : "comfortable";
                setDensity(nextDensity);
                applyDensityToDocument(nextDensity);
              }}
            >
              <SelectTrigger className="w-full sm:w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comfortable">Standaard</SelectItem>
                <SelectItem value="compact">Compact</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>E-mail & PDF typografie</Label>
            <Select
              value={typographyMode}
              onValueChange={(value) => {
                const nextMode: TypographyMode = value === "normal" ? "normal" : "compact";
                setTypographyMode(nextMode);
              }}
            >
              <SelectTrigger className="w-full sm:w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compact</SelectItem>
                <SelectItem value="normal">Normaal</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Geldt voor HTML e-mails en offerte-PDF layout.
            </p>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <Type className="h-3.5 w-3.5" />
              Tip
            </p>
            <p className="mt-1">
              Compact is handig voor power-users of kleinere schermen. Standaard is beter voor maximale leesbaarheid.
            </p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={batchUpdate.isPending}>
        {batchUpdate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Opslaan
      </Button>
    </div>
  );
}
