"use client";

import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
  Skeleton,
  Textarea,
  Badge,
} from "@digitify/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@digitify/ui";
import { ArrowLeft, Save, Loader2, KeyRound, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { SETTINGS_PAGE_QUERY_OPTS } from "@/lib/settings-query-options";
import { readSettingString } from "@/lib/settings";
import { useToast } from "@/components/feedback/toast-provider";

type AiProviderId = "anthropic" | "openai" | "deepseek";

const AI_PROVIDER_OPTIONS: Array<{ id: AiProviderId; label: string; keySetting: string }> = [
  { id: "anthropic", label: "Anthropic (Claude)", keySetting: "api.anthropic_key" },
  { id: "openai", label: "OpenAI (GPT)", keySetting: "api.openai_key" },
  { id: "deepseek", label: "DeepSeek", keySetting: "api.deepseek_key" },
];

function normalizeAiProvider(value: string): AiProviderId {
  const raw = value.trim().toLowerCase();
  if (raw === "openai") return "openai";
  if (raw === "deepseek") return "deepseek";
  return "anthropic";
}

function isApiKeyConfigured(settings: Record<string, unknown> | undefined, key: string) {
  const value = readSettingString(settings, key);
  // Opgeslagen sleutels worden gemaskeerd als •••••••• in API-responses.
  return Boolean(value);
}

export default function AISettingsPage() {
  const { data: settings, isLoading } = trpc.settings.getAiSettings.useQuery(undefined, SETTINGS_PAGE_QUERY_OPTS);
  const { data: integrations } = trpc.settings.getIntegrationsSettings.useQuery(undefined, SETTINGS_PAGE_QUERY_OPTS);
  const utils = trpc.useUtils();
  const { showToast } = useToast();

  const saveSettings = trpc.settings.batchUpdate.useMutation({
    onSuccess: () => {
      utils.settings.getAiSettings.invalidate();
      utils.settings.getIntegrationsSettings.invalidate();
      showToast({
        title: "AI-instellingen opgeslagen",
        description: "Provider, model en gedrag zijn bijgewerkt.",
      });
    },
    onError: (error) => {
      showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" });
    },
  });

  const [aiProvider, setAiProvider] = useState<AiProviderId>("anthropic");
  const [savedAiProvider, setSavedAiProvider] = useState<AiProviderId>("anthropic");
  const [model, setModel] = useState("claude-sonnet-4-20250514");
  const [language, setLanguage] = useState("nl");
  const [tone, setTone] = useState("professioneel");
  const [aggressiveness, setAggressiveness] = useState("balanced");
  const [maxTokens, setMaxTokens] = useState("2048");
  const [autoSuggest, setAutoSuggest] = useState(true);
  const [businessContext, setBusinessContext] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (settings && !loaded) {
      const get = (key: string, fallback = "") => {
        const val = settings[key];
        if (val === null || val === undefined) return fallback;
        try {
          const parsed = typeof val === "string" ? JSON.parse(val) : val;
          return String(parsed);
        } catch {
          return String(val);
        }
      };
      const provider = normalizeAiProvider(get("api.ai_provider", "anthropic"));
      setAiProvider(provider);
      setSavedAiProvider(provider);
      setModel(get("openclaw.model", "claude-sonnet-4-20250514"));
      setLanguage(get("openclaw_language", "nl"));
      setTone(get("openclaw_tone", "professioneel"));
      setAggressiveness(get("openclaw_aggressiveness", "balanced"));
      setMaxTokens(get("openclaw.max_tokens", "2048"));
      setAutoSuggest(get("openclaw.auto_suggest", "true") === "true");
      setBusinessContext(get("openclaw.business_context", ""));
      setLoaded(true);
    }
  }, [settings, loaded]);

  useEffect(() => {
    if (!loaded) return;
    if (aiProvider === "openai" && !model.startsWith("gpt-") && !model.startsWith("o")) {
      setModel("gpt-4o-mini");
    } else if (aiProvider === "deepseek" && !model.startsWith("deepseek")) {
      setModel("deepseek-chat");
    } else if (aiProvider === "anthropic" && (model.startsWith("gpt-") || model.startsWith("deepseek"))) {
      setModel("claude-sonnet-4-20250514");
    }
  }, [aiProvider, loaded, model]);

  const keySettings = integrations ?? settings;
  const activeProviderOption = AI_PROVIDER_OPTIONS.find((item) => item.id === aiProvider) ?? AI_PROVIDER_OPTIONS[0];
  const activeKeyConfigured = isApiKeyConfigured(keySettings, activeProviderOption.keySetting);
  const providerDirty = aiProvider !== savedAiProvider;

  const providerKeyStatus = useMemo(
    () =>
      AI_PROVIDER_OPTIONS.map((option) => ({
        ...option,
        configured: isApiKeyConfigured(keySettings, option.keySetting),
      })),
    [keySettings],
  );

  function handleSave() {
    saveSettings.mutate([
      { key: "api.ai_provider", value: aiProvider },
      { key: "openclaw.model", value: model },
      { key: "openclaw_language", value: language },
      { key: "openclaw_tone", value: tone },
      { key: "openclaw_aggressiveness", value: aggressiveness },
      { key: "openclaw.max_tokens", value: maxTokens },
      { key: "openclaw.auto_suggest", value: String(autoSuggest) },
      { key: "openclaw.business_context", value: businessContext.trim() },
    ]);
    setSavedAiProvider(aiProvider);
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">AI Assistent</h1>
          <p className="text-sm text-muted-foreground">Configureer het gedrag van de AI assistent (OpenClaw)</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Model Configuratie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>AI Provider</Label>
              <Select value={aiProvider} onValueChange={(value) => setAiProvider(normalizeAiProvider(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_PROVIDER_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{activeProviderOption.label}</span>
                  {activeKeyConfigured ? (
                    <Badge variant="success" className="text-[11px]">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      API-sleutel actief
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[11px]">
                      <XCircle className="mr-1 h-3 w-3" />
                      Geen sleutel
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activeKeyConfigured
                    ? "Deze provider wordt gebruikt voor AI-herschrijven, drafts en OpenClaw."
                    : "Stel eerst een API-sleutel in voor deze provider."}{" "}
                  <Link
                    href={`/settings/integrations?tab=${aiProvider}`}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Naar Integraties & API-sleutels
                  </Link>
                  .
                </p>
              </div>
              {providerDirty ? (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  Provider gewijzigd — klik Opslaan om de actieve provider te bevestigen.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {aiProvider === "anthropic" ? (
                    <>
                      <SelectItem value="claude-sonnet-4-20250514">Claude Sonnet 4</SelectItem>
                      <SelectItem value="claude-haiku-4-5-20251001">Claude Haiku 4.5</SelectItem>
                      <SelectItem value="claude-opus-4-6">Claude Opus 4.6</SelectItem>
                    </>
                  ) : aiProvider === "deepseek" ? (
                    <>
                      <SelectItem value="deepseek-chat">DeepSeek Chat</SelectItem>
                      <SelectItem value="deepseek-reasoner">DeepSeek Reasoner</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                      <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Max tokens per verzoek</Label>
              <Input
                type="number"
                min="256"
                max="16384"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Hogere waarden = langere maar duurdere antwoorden</p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-xs">
              <p className="font-medium text-foreground">API-sleutels per provider</p>
              <ul className="mt-2 space-y-1.5 text-muted-foreground">
                {providerKeyStatus.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2">
                    <Link href={`/settings/integrations?tab=${item.id}`} className="hover:text-primary hover:underline">
                      {item.label}
                    </Link>
                    <span className={item.configured ? "text-emerald-600" : "text-muted-foreground"}>
                      {item.configured ? "Ingesteld" : "Ontbreekt"}
                    </span>
                  </li>
                ))}
              </ul>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <Link href={`/settings/integrations?tab=${aiProvider}`}>
                  <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                  Sleutel beheren
                </Link>
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Auto-suggest</Label>
                <p className="text-xs text-muted-foreground">Automatisch suggesties tonen bij leads</p>
              </div>
              <Switch checked={autoSuggest} onCheckedChange={setAutoSuggest} />
            </div>
            <div className="space-y-2">
              <Label>Bedrijfscontext voor OpenClaw</Label>
              <Textarea
                value={businessContext}
                onChange={(event) => setBusinessContext(event.target.value)}
                rows={4}
                placeholder="Beschrijf kernservices, doelgroep, sterke cases en randvoorwaarden."
              />
              <p className="text-xs text-muted-foreground">
                Wordt gebruikt in AI-analyse, drafts en assistentantwoorden voor betere personalisatie.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Communicatiestijl</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Taal</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nl">Nederlands</SelectItem>
                  <SelectItem value="fr">Frans</SelectItem>
                  <SelectItem value="en">Engels</SelectItem>
                  <SelectItem value="de">Duits</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tone of voice</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professioneel">Professioneel</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="direct">Direct</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">De schrijfstijl voor gegenereerde e-mails en berichten</p>
            </div>
            <div className="space-y-2">
              <Label>Aggressiviteit</Label>
              <Select value={aggressiveness} onValueChange={setAggressiveness}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="voorzichtig">Voorzichtig</SelectItem>
                  <SelectItem value="balanced">Gebalanceerd</SelectItem>
                  <SelectItem value="direct">Direct</SelectItem>
                  <SelectItem value="agressief">Agressief</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Hoe sterk de AI probeert te overtuigen in outreach berichten</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Button onClick={handleSave} disabled={saveSettings.isPending}>
        {saveSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Opslaan
      </Button>
    </div>
  );
}
