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
} from "@digitify/ui";
import { ArrowLeft, ExternalLink, Eye, EyeOff, Key, Loader2, Save, Sparkles, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/components/feedback/toast-provider";

export default function CreativeStudioSettingsPage() {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const keyStatus = trpc.media.getMuapiKeyStatus.useQuery();
  const balance = trpc.media.getBalance.useQuery(undefined, {
    enabled: Boolean(keyStatus.data?.hasKey),
    retry: false,
  });

  const brandKit = trpc.media.getBrandKit.useQuery();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [autoImport, setAutoImport] = useState(false);

  const saveCreativeSettings = trpc.media.saveCreativeSettings.useMutation({
    onSuccess: async () => {
      await utils.media.getBrandKit.invalidate();
      showToast({ title: "Voorkeuren opgeslagen" });
    },
    onError: (error) =>
      showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  useEffect(() => {
    if (brandKit.data) {
      setAutoImport(Boolean(brandKit.data.autoImport));
    }
  }, [brandKit.data]);

  const setMuapiKey = trpc.media.setMuapiKey.useMutation({
    onSuccess: async () => {
      setApiKey("");
      await utils.media.getMuapiKeyStatus.invalidate();
      await utils.media.getBalance.invalidate();
      showToast({
        title: "MuAPI-key opgeslagen",
        description: "Je kunt nu afbeeldingen en video's genereren in Creative Studio.",
      });
    },
    onError: (error) =>
      showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const clearMuapiKey = trpc.media.clearMuapiKey.useMutation({
    onSuccess: async () => {
      await utils.media.getMuapiKeyStatus.invalidate();
      await utils.media.getBalance.reset();
      showToast({ title: "MuAPI-key verwijderd", description: "Je persoonlijke sleutel is gewist." });
    },
    onError: (error) =>
      showToast({ title: "Verwijderen mislukt", description: error.message, variant: "error" }),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-amber-500/10 via-background to-background p-5">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="shrink-0 bg-background/60" asChild>
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Creative Studio</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              MuAPI-sleutel, tegoed en opslagvoorkeuren voor AI-generatie.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            MuAPI API-key
          </CardTitle>
          <CardDescription>
            Open Generative AI gebruikt MuAPI als backend. Je sleutel blijft versleuteld opgeslagen en wordt nooit
            in de browser getoond na opslag.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {keyStatus.isLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <Badge variant={keyStatus.data?.hasKey ? "default" : "secondary"}>
                {keyStatus.data?.hasKey ? "Verbonden" : "Niet ingesteld"}
              </Badge>
            )}
            {balance.isLoading && keyStatus.data?.hasKey ? (
              <Skeleton className="h-6 w-28" />
            ) : null}
            {balance.data?.balance != null ? (
              <Badge variant="outline">Tegoed: {balance.data.balance}</Badge>
            ) : null}
            {balance.isError && keyStatus.data?.hasKey ? (
              <Badge variant="destructive">
                Tegoed onbekend
                <button
                  type="button"
                  className="ml-2 underline"
                  onClick={() => void balance.refetch()}
                >
                  Opnieuw
                </button>
              </Badge>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="muapi-key">API-key</Label>
            <div className="relative">
              <Input
                id="muapi-key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={keyStatus.data?.hasKey ? "Nieuwe sleutel om te vervangen" : "Plak je MuAPI access key"}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey((value) => !value)}
                aria-label={showKey ? "Verberg API-key" : "Toon API-key"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Maak een sleutel op{" "}
              <a
                href="https://muapi.ai/access-keys"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                muapi.ai/access-keys
                <ExternalLink className="h-3 w-3" />
              </a>
              . Gebruik de key value, niet de labelnaam.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setMuapiKey.mutate({ apiKey })}
              disabled={!apiKey.trim() || setMuapiKey.isPending}
            >
              {setMuapiKey.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Sleutel opslaan
            </Button>
            {keyStatus.data?.hasKey ? (
              confirmClear ? (
                <>
                  <Button
                    variant="destructive"
                    disabled={clearMuapiKey.isPending}
                    onClick={() => {
                      clearMuapiKey.mutate();
                      setConfirmClear(false);
                    }}
                  >
                    Bevestig verwijderen
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmClear(false)}>
                    Annuleren
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={clearMuapiKey.isPending}
                  onClick={() => setConfirmClear(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Sleutel verwijderen
                </Button>
              )
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generatie-voorkeuren</CardTitle>
          <CardDescription>
            Workspace-instellingen voor Creative Studio en Social Planner.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Automatisch opslaan in bibliotheek</p>
              <p className="text-xs text-muted-foreground">
                Sla gegenereerde media direct permanent op na voltooiing.
              </p>
            </div>
            <Switch
              checked={autoImport}
              onCheckedChange={(checked) => {
                setAutoImport(checked);
                saveCreativeSettings.mutate({ autoImport: checked });
              }}
              disabled={saveCreativeSettings.isPending}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Waar wordt dit gebruikt?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Creative Studio voor geavanceerde generatie.</p>
          <p>Social Planner: knop &quot;Genereer afbeelding&quot; in de post-composer.</p>
          <p>Meta Ads: video-advertenties vanuit product + script.</p>
          <p>
            <Link href="/creative-studio?tab=brand" className="text-primary hover:underline">
              Merkkit instellen
            </Link>{" "}
            voor on-brand AI-beelden (logo, slogan, bedrijfscontext).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
