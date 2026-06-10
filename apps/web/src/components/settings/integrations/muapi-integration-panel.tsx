"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Input,
  Label,
  Skeleton,
  Switch,
} from "@digitify/ui";
import { ExternalLink, Eye, EyeOff, Loader2, Save, Sparkles, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/components/feedback/toast-provider";
import {
  IntegrationActionBar,
  IntegrationPanel,
} from "@/components/settings/integrations/integration-ui";

export function MuapiIntegrationPanel() {
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

  const configured = Boolean(keyStatus.data?.hasKey);

  return (
    <div className="space-y-4">
      <IntegrationPanel
        icon={Sparkles}
        iconClassName="bg-primary/10 text-primary"
        title="MuAPI (Creative Studio)"
        description={
          <>
            Backend voor AI-afbeeldingen, video en lip sync. Je sleutel is persoonlijk, versleuteld opgeslagen en
            wordt nooit in de browser getoond na opslag. Maak een key op{" "}
            <a
              href="https://muapi.ai/access-keys"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              muapi.ai/access-keys
              <ExternalLink className="h-3 w-3" />
            </a>
            .
          </>
        }
        configured={configured}
        statusLabel={{ active: "Verbonden", inactive: "Niet ingesteld" }}
      >
        <div className="flex flex-wrap items-center gap-2">
          {keyStatus.isLoading ? (
            <Skeleton className="h-6 w-24" />
          ) : null}
          {balance.isLoading && configured ? <Skeleton className="h-6 w-28" /> : null}
          {balance.data?.balance != null ? (
            <Badge variant="outline">Tegoed: {balance.data.balance}</Badge>
          ) : null}
          {balance.isError && configured ? (
            <Badge variant="destructive">
              Tegoed onbekend
              <button type="button" className="ml-2 underline" onClick={() => void balance.refetch()}>
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
              placeholder={configured ? "Nieuwe sleutel om te vervangen" : "Plak je MuAPI access key"}
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
          <p className="text-xs text-muted-foreground">Gebruik de key value, niet de labelnaam.</p>
        </div>

        <IntegrationActionBar>
          <Button
            size="sm"
            onClick={() => setMuapiKey.mutate({ apiKey })}
            disabled={!apiKey.trim() || setMuapiKey.isPending}
          >
            {setMuapiKey.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
            Sleutel opslaan
          </Button>
          {configured ? (
            confirmClear ? (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={clearMuapiKey.isPending}
                  onClick={() => {
                    clearMuapiKey.mutate();
                    setConfirmClear(false);
                  }}
                >
                  Bevestig verwijderen
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>
                  Annuleren
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={clearMuapiKey.isPending}
                onClick={() => setConfirmClear(true)}
              >
                <Trash2 className="mr-2 h-3 w-3" />
                Sleutel verwijderen
              </Button>
            )
          ) : null}
        </IntegrationActionBar>
      </IntegrationPanel>

      <IntegrationPanel
        icon={Sparkles}
        iconClassName="bg-muted text-muted-foreground"
        title="Generatie-voorkeuren"
        description="Workspace-instellingen voor Creative Studio en Social Planner."
        configured
        statusLabel={{ active: "Beschikbaar", inactive: "Beschikbaar" }}
      >
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
            disabled={saveCreativeSettings.isPending || brandKit.isLoading}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Gebruikt in Creative Studio, Social Planner (&quot;Genereer afbeelding&quot;) en Meta Ads video-advertenties.{" "}
          <Link href="/creative-studio?tab=brand" className="text-primary hover:underline">
            Merkkit instellen
          </Link>{" "}
          voor on-brand AI-beelden.
        </p>
      </IntegrationPanel>
    </div>
  );
}
