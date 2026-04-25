"use client";

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc/client";
import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Label,
  Separator,
  Switch,
  Skeleton,
  Textarea,
} from "@digitify/ui";
import {
  MessageSquare,
  Copy,
  Check,
  Palette,
  Globe,
  Settings2,
  Code2,
  Eye,
  Sparkles,
  Save,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { useToast } from "@/components/feedback/toast-provider";
import { getAppUrl } from "@/lib/config";
import { readSettingBoolean, readSettingString } from "@/lib/settings";

function normalizeHexColor(value: string, fallback = "#f9ae5a") {
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
}

function normalizePosition(value: string): "bottom-right" | "bottom-left" {
  return value === "bottom-left" ? "bottom-left" : "bottom-right";
}

function normalizeAutoOpenDelay(value: string, fallback = "0") {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return String(Math.max(0, Math.min(120, Math.round(parsed))));
}

export default function ChatbotSettingsPage() {
  const { data: settings, isLoading, error, refetch } = trpc.settings.getAll.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const utils = trpc.useUtils();
  const { showToast } = useToast();

  const batchUpdate = trpc.settings.batchUpdate.useMutation({
    onSuccess: () => {
      utils.settings.getAll.invalidate();
      showToast({ title: "Chatbot opgeslagen", description: "De widget-instellingen zijn bijgewerkt." });
    },
    onError: (error) =>
      showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const [enabled, setEnabled] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState(
    "Hallo! Hoe kan ik u helpen?"
  );
  const [offlineMessage, setOfflineMessage] = useState(
    "We zijn momenteel offline. Laat een bericht achter en we nemen zo snel mogelijk contact met u op."
  );
  const [autoMessagesEnabled, setAutoMessagesEnabled] = useState(true);
  const [aiResponsesEnabled, setAiResponsesEnabled] = useState(true);
  const [askNameBeforeChat, setAskNameBeforeChat] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#f9ae5a");
  const [position, setPosition] = useState<"bottom-right" | "bottom-left">(
    "bottom-right"
  );
  const [autoOpenDelay, setAutoOpenDelay] = useState("0");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [trainingNotes, setTrainingNotes] = useState("");
  const [knowledgePages, setKnowledgePages] = useState("");
  const [responseStyle, setResponseStyle] = useState("Professioneel, kort en duidelijk");
  const [botLanguage, setBotLanguage] = useState("Nederlands");
  const [copiedMode, setCopiedMode] = useState<"script" | "iframe" | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!settings || hydratedRef.current) return;

    setEnabled(readSettingBoolean(settings, "chatbot.enabled", true));
    setCompanyName(readSettingString(settings, "chatbot.company_name", ""));
    setWelcomeMessage(readSettingString(settings, "chatbot.welcome_message", "Hallo! Hoe kan ik u helpen?"));
    setOfflineMessage(
      readSettingString(
        settings,
        "chatbot.offline_message",
        "We zijn momenteel offline. Laat een bericht achter en we nemen zo snel mogelijk contact met u op."
      )
    );
    setAutoMessagesEnabled(readSettingBoolean(settings, "chatbot.auto_messages_enabled", true));
    setAiResponsesEnabled(readSettingBoolean(settings, "chatbot.ai_responses_enabled", true));
    setAskNameBeforeChat(readSettingBoolean(settings, "chatbot.ask_name_before_chat", false));
    setPrimaryColor(normalizeHexColor(readSettingString(settings, "chatbot.primary_color", "#f9ae5a")));
    setPosition(normalizePosition(readSettingString(settings, "chatbot.position", "bottom-right")));
    setAutoOpenDelay(normalizeAutoOpenDelay(readSettingString(settings, "chatbot.auto_open_delay", "0")));
    setAvatarUrl(readSettingString(settings, "chatbot.avatar_url", ""));
    setTrainingNotes(readSettingString(settings, "chatbot.training_notes", ""));
    setKnowledgePages(readSettingString(settings, "chatbot.knowledge_pages", ""));
    setResponseStyle(readSettingString(settings, "chatbot.response_style", "Professioneel, kort en duidelijk"));
    setBotLanguage(readSettingString(settings, "chatbot.language", "Nederlands"));
    hydratedRef.current = true;
  }, [settings]);

  function handleSave() {
    const normalizedColor = normalizeHexColor(primaryColor);
    const normalizedDelay = normalizeAutoOpenDelay(autoOpenDelay);

    batchUpdate.mutate([
      { key: "chatbot.enabled", value: String(enabled) },
      { key: "chatbot.company_name", value: companyName.trim() },
      { key: "chatbot.welcome_message", value: welcomeMessage.trim() },
      { key: "chatbot.offline_message", value: offlineMessage.trim() },
      { key: "chatbot.auto_messages_enabled", value: String(autoMessagesEnabled) },
      { key: "chatbot.ai_responses_enabled", value: String(aiResponsesEnabled) },
      { key: "chatbot.ask_name_before_chat", value: String(askNameBeforeChat) },
      { key: "chatbot.primary_color", value: normalizedColor },
      { key: "chatbot.position", value: position },
      { key: "chatbot.auto_open_delay", value: normalizedDelay },
      { key: "chatbot.avatar_url", value: avatarUrl.trim() },
      { key: "chatbot.training_notes", value: trainingNotes.trim() },
      { key: "chatbot.knowledge_pages", value: knowledgePages.trim() },
      { key: "chatbot.response_style", value: responseStyle.trim() || "Professioneel, kort en duidelijk" },
      { key: "chatbot.language", value: botLanguage.trim() || "Nederlands" },
    ]);
  }

  async function handleCopy(code: string, mode: "script" | "iframe") {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      showToast({
        title: "Kopiëren mislukt",
        description: "Kon de embed-code niet naar het klembord schrijven.",
        variant: "error",
      });
      return;
    }
    setCopiedMode(mode);
    showToast({
      title: "Embed-code gekopieerd",
      description:
        mode === "iframe"
          ? "Je kunt de iframe-code nu op de klantwebsite plakken."
          : "Je kunt de widgetcode nu op de klantwebsite plakken.",
    });
    setTimeout(() => setCopiedMode(null), 2000);
  }

  const appUrl = getAppUrl();
  const safePrimaryColor = normalizeHexColor(primaryColor);
  const safeAutoOpenDelay = normalizeAutoOpenDelay(autoOpenDelay);
  const embedCode = `<script src="${appUrl}/chatbot/widget.js"
  data-company="${companyName || "MijnBedrijf"}"
  data-color="${safePrimaryColor}"
  data-position="${position}"
  data-welcome="${welcomeMessage}"
  data-ask-name="${askNameBeforeChat ? "1" : "0"}"
  data-auto-open="${safeAutoOpenDelay}">
</script>`;
  const iframeCode = `<iframe
  src="${appUrl}/embed/chatbot?company=${encodeURIComponent(companyName || "MijnBedrijf")}&color=${encodeURIComponent(safePrimaryColor)}&welcome=${encodeURIComponent(welcomeMessage)}&askName=${askNameBeforeChat ? "1" : "0"}"
  width="100%"
  height="720"
  style="border:0;border-radius:24px;overflow:hidden"
  loading="lazy"
></iframe>`;

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Chatbot instellingen konden niet geladen worden</p>
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
      {/* Back link + Header */}
      <div>
        <Link
          href="/chatbot"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Terug naar Gesprekken
        </Link>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Settings2 className="h-6 w-6" />
          Chatbot Instellingen
        </h1>
        <p className="text-sm text-muted-foreground">
          Configureer en beheer chatbot widgets voor klantwebsites
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Widget Instellingen */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Widget Instellingen
            </CardTitle>
            <CardDescription>
              Pas het uiterlijk en gedrag van de chatbot widget aan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Chatbot Actief</Label>
                <p className="text-xs text-muted-foreground">
                  Schakel de chatbot widget in of uit
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Automatische berichten</Label>
                <p className="text-xs text-muted-foreground">
                  Laat de bot zelfstandig antwoorden tijdens bezoekersgesprekken.
                </p>
              </div>
              <Switch checked={autoMessagesEnabled} onCheckedChange={setAutoMessagesEnabled} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>AI antwoorden</Label>
                <p className="text-xs text-muted-foreground">
                  Gebruik training/context om slimmere antwoorden terug te sturen.
                </p>
              </div>
              <Switch checked={aiResponsesEnabled} onCheckedChange={setAiResponsesEnabled} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Naam opvragen vóór start chat</Label>
                <p className="text-xs text-muted-foreground">
                  Vraag eerst de naam van de bezoeker vóór het eerste bericht.
                </p>
              </div>
              <Switch checked={askNameBeforeChat} onCheckedChange={setAskNameBeforeChat} />
            </div>

            {/* Company name */}
            <div className="space-y-2">
              <Label htmlFor="companyName">Bedrijfsnaam</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="bv. Mijn Bedrijf"
              />
              <p className="text-xs text-muted-foreground">
                Wordt getoond in de widget header
              </p>
            </div>

            {/* Welcome message */}
            <div className="space-y-2">
              <Label htmlFor="welcomeMessage">Welkomstbericht</Label>
              <Textarea
                id="welcomeMessage"
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                rows={2}
                placeholder="Hallo! Hoe kan ik u helpen?"
              />
            </div>

            {/* Offline message */}
            <div className="space-y-2">
              <Label htmlFor="offlineMessage">Offline bericht</Label>
              <Textarea
                id="offlineMessage"
                value={offlineMessage}
                onChange={(e) => setOfflineMessage(e.target.value)}
                rows={2}
                placeholder="We zijn momenteel offline..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trainingNotes">Bot training / context</Label>
              <Textarea
                id="trainingNotes"
                value={trainingNotes}
                onChange={(e) => setTrainingNotes(e.target.value)}
                rows={4}
                placeholder="Welke diensten bied je aan, welke antwoorden moeten altijd terugkomen, welke tone of voice verwacht je?"
              />
              <p className="text-xs text-muted-foreground">
                Beschrijf kort wat jullie doen, welke klanten jullie helpen en welke antwoorden de bot moet prioriteren.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="knowledgePages">Belangrijke pagina's / bronnen</Label>
              <Textarea
                id="knowledgePages"
                value={knowledgePages}
                onChange={(e) => setKnowledgePages(e.target.value)}
                rows={3}
                placeholder="Bijv. /diensten, /prijzen, /faq of volledige URLs (1 per lijn)"
              />
              <p className="text-xs text-muted-foreground">
                Deze pagina's worden als kenniscontext gebruikt bij AI-antwoorden.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="responseStyle">Antwoordstijl</Label>
                <Input
                  id="responseStyle"
                  value={responseStyle}
                  onChange={(e) => setResponseStyle(e.target.value)}
                  placeholder="Professioneel, kort en duidelijk"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="botLanguage">Standaardtaal</Label>
                <Input
                  id="botLanguage"
                  value={botLanguage}
                  onChange={(e) => setBotLanguage(e.target.value)}
                  placeholder="Nederlands"
                />
              </div>
            </div>

            <Separator />

            {/* Primary color */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Hoofdkleur
              </Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={safePrimaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded border border-input"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-32 font-mono text-sm"
                  placeholder="#f9ae5a"
                />
              </div>
            </div>

            {/* Position */}
            <div className="space-y-2">
              <Label>Positie</Label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="position"
                    value="bottom-right"
                    checked={position === "bottom-right"}
                    onChange={() => setPosition("bottom-right")}
                    className="accent-primary"
                  />
                  <span className="text-sm">Rechts onder</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="position"
                    value="bottom-left"
                    checked={position === "bottom-left"}
                    onChange={() => setPosition("bottom-left")}
                    className="accent-primary"
                  />
                  <span className="text-sm">Links onder</span>
                </label>
              </div>
            </div>

            {/* Auto-open delay */}
            <div className="space-y-2">
              <Label htmlFor="autoOpenDelay">Auto-open vertraging (seconden)</Label>
              <Input
                id="autoOpenDelay"
                type="number"
                min="0"
                max="120"
                value={autoOpenDelay}
                onChange={(e) => setAutoOpenDelay(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                0 = niet automatisch openen
              </p>
            </div>

            {/* Avatar URL */}
            <div className="space-y-2">
              <Label htmlFor="avatarUrl">Bot avatar URL</Label>
              <Input
                id="avatarUrl"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://voorbeeld.be/avatar.png"
              />
            </div>

            <Button onClick={handleSave} disabled={batchUpdate.isPending} className="w-full">
              {batchUpdate.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Instellingen Opslaan
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-5">
          {/* Voorbeeld */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Voorbeeld
              </CardTitle>
              <CardDescription>
                Live voorbeeld van de chatbot widget
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative rounded-lg border bg-muted/30 p-6 min-h-[320px]">
                {/* Preview container */}
                <div
                  className={`absolute bottom-4 ${
                    position === "bottom-right" ? "right-4" : "left-4"
                  }`}
                >
                  {/* Chat window (when open) */}
                  {previewOpen && (
                    <div
                      className="mb-3 w-72 rounded-xl shadow-xl overflow-hidden border"
                      style={{ backgroundColor: "white" }}
                    >
                      {/* Header */}
                      <div
                        className="flex items-center gap-2 px-4 py-3"
                        style={{ backgroundColor: safePrimaryColor }}
                      >
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt="Bot"
                            className="h-8 w-8 rounded-full object-cover border-2 border-white/30"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                            <Sparkles className="h-4 w-4 text-white" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white">
                            {companyName || "Chatbot"}
                          </p>
                          <p className="text-xs text-white/70">
                            {enabled ? "Online" : "Offline"}
                          </p>
                        </div>
                        <button
                          onClick={() => setPreviewOpen(false)}
                          className="text-white/80 hover:text-white text-lg leading-none"
                        >
                          &times;
                        </button>
                      </div>

                      {/* Messages */}
                      <div className="p-4 space-y-3 bg-gray-50 min-h-[160px]">
                        <div className="flex gap-2">
                          <div
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                            style={{ backgroundColor: safePrimaryColor }}
                          >
                            <Sparkles className="h-3 w-3 text-white" />
                          </div>
                          <div
                            className="rounded-lg rounded-tl-none px-3 py-2 text-sm max-w-[200px]"
                            style={{
                              backgroundColor: `${safePrimaryColor}15`,
                              color: "#1f2937",
                            }}
                          >
                            {enabled ? welcomeMessage : offlineMessage}
                          </div>
                        </div>
                      </div>

                      {/* Input */}
                      <div className="flex items-center gap-2 border-t px-3 py-2.5 bg-white">
                        <input
                          type="text"
                          placeholder="Typ een bericht..."
                          className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder:text-gray-400"
                          disabled
                        />
                        <button
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white"
                          style={{ backgroundColor: safePrimaryColor }}
                          disabled
                        >
                          Verstuur
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Bubble button */}
                  <button
                    onClick={() => setPreviewOpen(!previewOpen)}
                    className="flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
                    style={{ backgroundColor: safePrimaryColor }}
                  >
                    <MessageSquare className="h-6 w-6 text-white" />
                  </button>
                </div>

                {/* Hint text */}
                {!previewOpen && (
                  <div className="flex flex-col items-center justify-center h-full text-center pt-8">
                    <Globe className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground/60">
                      Klik op de chatbot bubble om het voorbeeld te openen
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Embed Code */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Code2 className="h-4 w-4" />
                Embed Code
              </CardTitle>
              <CardDescription>
                Gebruik het script voor een zwevende widget. Als de site scripts blokkeert of de widget niet toont,
                gebruik dan de iframe-versie hieronder.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <pre className="rounded-lg bg-muted p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                  {embedCode}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => handleCopy(embedCode, "script")}
                >
                  {copiedMode === "script" ? (
                    <>
                      <Check className="mr-1 h-3 w-3" />
                      Gekopieerd
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-3 w-3" />
                      Kopieer
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                De widget wordt automatisch geladen wanneer de pagina wordt
                geopend. Pas de instellingen hierboven aan om het gedrag te
                wijzigen.
              </p>

              <div className="relative">
                <pre className="rounded-lg bg-muted p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                  {iframeCode}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => handleCopy(iframeCode, "iframe")}
                >
                  {copiedMode === "iframe" ? (
                    <>
                      <Check className="mr-1 h-3 w-3" />
                      Gekopieerd
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-3 w-3" />
                      Kopieer iframe
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                De iframe-variant is het veiligst als een externe website strikte script- of CSP-regels gebruikt.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
