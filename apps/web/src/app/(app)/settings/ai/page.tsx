"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Switch, Skeleton, Textarea } from "@digitify/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@digitify/ui";
import { ArrowLeft, Save, Loader2, KeyRound } from "lucide-react";
import Link from "next/link";

export default function AISettingsPage() {
  const { data: settings, isLoading } = trpc.settings.getAll.useQuery();
  const utils = trpc.useUtils();

  const saveSettings = trpc.settings.batchUpdate.useMutation({
    onSuccess: () => utils.settings.getAll.invalidate(),
  });

  const [aiProvider, setAiProvider] = useState("anthropic");
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
      setAiProvider(get("api.ai_provider", "anthropic"));
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
              <Select value={aiProvider} onValueChange={setAiProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                </SelectContent>
              </Select>
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
              <p className="font-medium text-foreground">API keys</p>
              <p className="mt-1 text-muted-foreground">
                Anthropic, OpenAI en DeepSeek keys beheer je centraal via Integraties.
              </p>
              <Button variant="outline" size="sm" className="mt-2" asChild>
                <Link href="/settings/integrations">
                  <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                  Naar Integraties
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
