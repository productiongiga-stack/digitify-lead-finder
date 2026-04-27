"use client";

import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Input, Label, Skeleton, Badge, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "@digitify/ui";
import { ArrowLeft, Save, Loader2, Key, Eye, EyeOff, CheckCircle, XCircle, Bot, Globe, Mail, Inbox, Zap, AlertCircle, Settings2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/feedback/toast-provider";
import { readSettingBoolean, readSettingString } from "@/lib/settings";

const SECRET_MASK = "••••••••";

function resolveRecommendedTlsServername(host: string, username: string) {
  const userDomain = username.split("@")[1]?.trim();
  if (userDomain) return userDomain;

  const hostParts = host.trim().split(".").filter(Boolean);
  if (hostParts.length > 2) {
    return hostParts.slice(-2).join(".");
  }

  return host.trim();
}

function TestResult({ result, isError }: { result: string | null; isError: boolean }) {
  if (!result) return null;
  return (
    <div className={`mt-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm ${isError ? "bg-destructive/10 text-destructive" : "bg-green-500/10 text-green-700 dark:text-green-400"}`}>
      {isError ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle className="h-4 w-4 shrink-0" />}
      <span>{result}</span>
    </div>
  );
}

function SmtpDnsGuide({
  guide,
}: {
  guide:
    | {
        activeDomain?: string;
        senderEmail?: string;
        mailSubdomain?: string;
        records?: Array<{ type: string; host: string; value: string; note: string }>;
        tips?: string[];
      }
    | undefined;
}) {
  if (!guide) return null;
  return (
    <div className="rounded-md border bg-muted/30 p-3 text-xs">
      <p className="font-semibold text-foreground">DNS checklist voor verzenden</p>
      <p className="mt-1 text-muted-foreground">
        Domein: <span className="font-medium text-foreground">{guide.activeDomain || "-"}</span> · Afzender:{" "}
        <span className="font-medium text-foreground">{guide.senderEmail || "-"}</span>
      </p>
      {guide.mailSubdomain ? (
        <p className="mt-1 text-muted-foreground">
          Aanbevolen verzend-subdomein: <span className="font-medium text-foreground">{guide.mailSubdomain}</span>
        </p>
      ) : null}
      <div className="mt-2 space-y-2">
        {(guide.records || []).map((record) => (
          <div key={`${record.type}-${record.host}`} className="rounded border bg-background p-2">
            <p className="font-medium text-foreground">
              {record.type} · {record.host}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{record.value}</p>
            <p className="mt-1 text-muted-foreground">{record.note}</p>
          </div>
        ))}
      </div>
      {(guide.tips || []).length > 0 ? (
        <div className="mt-2 space-y-1">
          {(guide.tips || []).map((tip) => (
            <p key={tip} className="text-muted-foreground">
              • {tip}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function getStatusTone(status?: string) {
  if (status === "ok") return "text-green-700 dark:text-green-400";
  return "text-destructive";
}

function DnsCheckResult({
  result,
}: {
  result:
    | {
        domain: string;
        overall: "healthy" | "partial" | "risk";
        checks: {
          spf: { status: string; host: string; record: string | null };
          dkim: { status: string; selector: string | null; host: string | null; record: string | null };
          dmarc: { status: string; host: string; record: string | null; policy: string | null };
        };
        guidance: string[];
      }
    | null
    | undefined;
}) {
  if (!result) return null;

  const overallLabel =
    result.overall === "healthy"
      ? "Gezond"
      : result.overall === "partial"
        ? "Gedeeltelijk"
        : "Risico";
  const overallClass =
    result.overall === "healthy"
      ? "bg-green-500/10 text-green-700 dark:text-green-400"
      : result.overall === "partial"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "bg-destructive/10 text-destructive";

  return (
    <div className="rounded-md border bg-muted/30 p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-foreground">DNS status voor {result.domain}</p>
        <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${overallClass}`}>
          {overallLabel}
        </span>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <div className="rounded border bg-background p-2">
          <p className={`font-medium ${getStatusTone(result.checks.spf.status)}`}>SPF</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{result.checks.spf.host}</p>
          {result.checks.spf.record ? <p className="mt-1 text-muted-foreground">{result.checks.spf.record}</p> : null}
        </div>
        <div className="rounded border bg-background p-2">
          <p className={`font-medium ${getStatusTone(result.checks.dkim.status)}`}>DKIM</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{result.checks.dkim.host || "-"}</p>
          {result.checks.dkim.selector ? <p className="mt-1 text-muted-foreground">selector: {result.checks.dkim.selector}</p> : null}
        </div>
        <div className="rounded border bg-background p-2">
          <p className={`font-medium ${getStatusTone(result.checks.dmarc.status)}`}>DMARC</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{result.checks.dmarc.host}</p>
          {result.checks.dmarc.policy ? <p className="mt-1 text-muted-foreground">policy: {result.checks.dmarc.policy}</p> : null}
        </div>
      </div>
      {result.guidance.length > 0 ? (
        <div className="mt-2 space-y-1">
          {result.guidance.map((item) => (
            <p key={item} className="text-muted-foreground">
              • {item}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function IntegrationsSettingsPage() {
  const { data: settings, isLoading, error, refetch } = trpc.settings.getAll.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const utils = trpc.useUtils();
  const { showToast } = useToast();

  const batchUpdate = trpc.settings.batchUpdate.useMutation({
    onSuccess: () => {
      utils.settings.getAll.invalidate();
      showToast({
        title: "Integraties opgeslagen",
        description: "De API- en mailinstellingen zijn bijgewerkt.",
      });
    },
    onError: (error) =>
      showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  // Test mutations
  const testGoogle = trpc.settings.testGooglePlaces.useMutation();
  const testAnthropic = trpc.settings.testAnthropicKey.useMutation();
  const testOpenai = trpc.settings.testOpenaiKey.useMutation();
  const testSmtp = trpc.settings.testSmtp.useMutation();
  const checkEmailDns = trpc.settings.checkEmailDns.useMutation();
  const testImap = trpc.settings.testImap.useMutation();

  // Google
  const [googlePlacesKey, setGooglePlacesKey] = useState("");
  const [googlePlacesConfigured, setGooglePlacesConfigured] = useState(false);
  const [showGoogleKey, setShowGoogleKey] = useState(false);

  // AI
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicConfigured, setAnthropicConfigured] = useState(false);
  const [openaiConfigured, setOpenaiConfigured] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);

  // SMTP
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpPassConfigured, setSmtpPassConfigured] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [smtpServername, setSmtpServername] = useState("");
  const [smtpRejectUnauthorized, setSmtpRejectUnauthorized] = useState(true);
  const [smtpTestTo, setSmtpTestTo] = useState("");
  const [dnsDomain, setDnsDomain] = useState("");

  // IMAP
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [imapUser, setImapUser] = useState("");
  const [imapPass, setImapPass] = useState("");
  const [imapPassConfigured, setImapPassConfigured] = useState(false);
  const [showImapPass, setShowImapPass] = useState(false);
  const [imapTls, setImapTls] = useState(true);
  const smtpPasswordAvailable = Boolean(smtpPass.trim() || smtpPassConfigured);
  const imapPasswordAvailable = Boolean(imapPass.trim() || imapPassConfigured);
  const smtpConfigured = Boolean(smtpHost.trim() && smtpUser.trim() && smtpPasswordAvailable);
  const imapConfigured = Boolean(imapHost.trim() && imapUser.trim() && imapPasswordAvailable);
  const recommendedTlsServername = resolveRecommendedTlsServername(smtpHost, smtpUser);
  const effectiveTlsServername = smtpServername.trim() || recommendedTlsServername;
  const initialState = useMemo(() => ({
    googlePlacesKey: readSettingString(settings, "api.google_places_key"),
    anthropicKey: readSettingString(settings, "api.anthropic_key"),
    openaiKey: readSettingString(settings, "api.openai_key"),
    smtpHost: readSettingString(settings, "email.smtp_host"),
    smtpPort: readSettingString(settings, "email.smtp_port", "587"),
    smtpUser: readSettingString(settings, "email.smtp_user"),
    smtpServername: readSettingString(settings, "email.smtp_servername"),
    smtpRejectUnauthorized: readSettingBoolean(settings, "email.smtp_tls_reject_unauthorized", true),
    imapHost: readSettingString(settings, "email.imap_host"),
    imapPort: readSettingString(settings, "email.imap_port", "993"),
    imapUser: readSettingString(settings, "email.imap_user"),
    imapTls: readSettingBoolean(settings, "email.imap_tls", true),
  }), [settings]);
  const googleDirty = googlePlacesKey.trim() !== initialState.googlePlacesKey;
  const aiDirty = anthropicKey.trim() !== initialState.anthropicKey || openaiKey.trim() !== initialState.openaiKey;
  const smtpDirty =
    smtpHost.trim() !== initialState.smtpHost
    || smtpPort.trim() !== initialState.smtpPort
    || smtpUser.trim() !== initialState.smtpUser
    || smtpServername.trim() !== initialState.smtpServername
    || smtpRejectUnauthorized !== initialState.smtpRejectUnauthorized
    || Boolean(smtpPass.trim());
  const imapDirty =
    imapHost.trim() !== initialState.imapHost
    || imapPort.trim() !== initialState.imapPort
    || imapUser.trim() !== initialState.imapUser
    || imapTls !== initialState.imapTls
    || Boolean(imapPass.trim());
  const anyDirty = googleDirty || aiDirty || smtpDirty || imapDirty;

  function extractDomainFromEmail(value: string) {
    const candidate = value.trim().toLowerCase();
    const at = candidate.lastIndexOf("@");
    if (at < 0) return "";
    return candidate.slice(at + 1);
  }

  useEffect(() => {
    if (settings) {
      const googleKeyRaw = readSettingString(settings, "api.google_places_key");
      const anthropicKeyRaw = readSettingString(settings, "api.anthropic_key");
      const openaiKeyRaw = readSettingString(settings, "api.openai_key");
      const smtpPassRaw = readSettingString(settings, "email.smtp_pass");
      const imapPassRaw = readSettingString(settings, "email.imap_pass");

      setGooglePlacesConfigured(Boolean(googleKeyRaw));
      setAnthropicConfigured(Boolean(anthropicKeyRaw));
      setOpenaiConfigured(Boolean(openaiKeyRaw));

      setGooglePlacesKey(googleKeyRaw === SECRET_MASK ? "" : googleKeyRaw);
      setAnthropicKey(anthropicKeyRaw === SECRET_MASK ? "" : anthropicKeyRaw);
      setOpenaiKey(openaiKeyRaw === SECRET_MASK ? "" : openaiKeyRaw);
      setSmtpHost(readSettingString(settings, "email.smtp_host"));
      setSmtpPort(readSettingString(settings, "email.smtp_port", "587"));
      setSmtpUser(readSettingString(settings, "email.smtp_user"));
      setSmtpPassConfigured(Boolean(smtpPassRaw));
      setSmtpPass(smtpPassRaw === SECRET_MASK ? "" : smtpPassRaw);
      setSmtpServername(readSettingString(settings, "email.smtp_servername"));
      setSmtpRejectUnauthorized(readSettingBoolean(settings, "email.smtp_tls_reject_unauthorized", true));
      setSmtpTestTo(readSettingString(settings, "company.email") || readSettingString(settings, "email.from_email"));
      setDnsDomain(
        extractDomainFromEmail(readSettingString(settings, "email.from_email")) ||
          extractDomainFromEmail(readSettingString(settings, "email.smtp_user")),
      );
      setImapHost(readSettingString(settings, "email.imap_host"));
      setImapPort(readSettingString(settings, "email.imap_port", "993"));
      setImapUser(readSettingString(settings, "email.imap_user"));
      setImapPassConfigured(Boolean(imapPassRaw));
      setImapPass(imapPassRaw === SECRET_MASK ? "" : imapPassRaw);
      setImapTls(readSettingBoolean(settings, "email.imap_tls", true));
    }
  }, [settings]);

  function handleSave() {
    batchUpdate.mutate([
      { key: "api.google_places_key", value: googlePlacesKey.trim() },
      { key: "api.anthropic_key", value: anthropicKey.trim() },
      { key: "api.openai_key", value: openaiKey.trim() },
      { key: "email.smtp_host", value: smtpHost.trim() },
      { key: "email.smtp_port", value: smtpPort.trim() || "587" },
      { key: "email.smtp_user", value: smtpUser.trim() },
      { key: "email.smtp_pass", value: smtpPass },
      { key: "email.provider", value: smtpConfigured ? "smtp" : "console" },
      { key: "email.smtp_servername", value: effectiveTlsServername },
      { key: "email.smtp_tls_reject_unauthorized", value: String(smtpRejectUnauthorized) },
      { key: "email.imap_host", value: imapHost.trim() },
      { key: "email.imap_port", value: imapPort.trim() || "993" },
      { key: "email.imap_user", value: imapUser.trim() },
      { key: "email.imap_pass", value: imapPass },
      { key: "email.imap_tls", value: String(imapTls) },
    ]);
  }

  function handleSaveGoogle() {
    batchUpdate.mutate([{ key: "api.google_places_key", value: googlePlacesKey.trim() }]);
  }

  function handleSaveAi() {
    batchUpdate.mutate([
      { key: "api.anthropic_key", value: anthropicKey.trim() },
      { key: "api.openai_key", value: openaiKey.trim() },
    ]);
  }

  function handleSaveSmtp() {
    batchUpdate.mutate([
      { key: "email.smtp_host", value: smtpHost.trim() },
      { key: "email.smtp_port", value: smtpPort.trim() || "587" },
      { key: "email.smtp_user", value: smtpUser.trim() },
      { key: "email.smtp_pass", value: smtpPass },
      { key: "email.provider", value: smtpConfigured ? "smtp" : "console" },
      { key: "email.smtp_servername", value: effectiveTlsServername },
      { key: "email.smtp_tls_reject_unauthorized", value: String(smtpRejectUnauthorized) },
    ]);
  }

  function handleSaveImap() {
    batchUpdate.mutate([
      { key: "email.imap_host", value: imapHost.trim() },
      { key: "email.imap_port", value: imapPort.trim() || "993" },
      { key: "email.imap_user", value: imapUser.trim() },
      { key: "email.imap_pass", value: imapPass },
      { key: "email.imap_tls", value: String(imapTls) },
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

  if (error && !settings) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Integraties konden niet geladen worden</p>
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
          <h1 className="text-xl font-bold tracking-tight">Integraties & API Keys</h1>
          <p className="text-sm text-muted-foreground">Configureer externe diensten en API-sleutels</p>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-4">
        <Card className="border-emerald-200 bg-emerald-50/80 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mail verzenden</p>
            <p className="mt-2 text-sm font-medium">{smtpConfigured ? "SMTP lijkt ingevuld en klaar voor tests." : "SMTP is nog niet volledig geconfigureerd."}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/80 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inbox</p>
            <p className="mt-2 text-sm font-medium">{imapConfigured ? "IMAP is ingevuld zodat de inbox mails kan ophalen." : "IMAP ontbreekt nog of is onvolledig."}</p>
          </CardContent>
        </Card>
        <Card className="border-violet-200 bg-violet-50/80 shadow-sm dark:border-violet-900/40 dark:bg-violet-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI providers</p>
            <p className="mt-2 text-sm font-medium">{anthropicConfigured || openaiConfigured ? "Minstens één AI-provider is ingesteld." : "Nog geen AI-provider geconfigureerd."}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/80 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Wijzigingen</p>
            <p className="mt-2 text-sm font-medium">{anyDirty ? "Er zijn niet-opgeslagen aanpassingen." : "Alles is opgeslagen."}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="providers" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="providers">API & AI</TabsTrigger>
          <TabsTrigger value="mail">SMTP & DNS</TabsTrigger>
          <TabsTrigger value="inbox">Inbox (IMAP)</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
        {/* Google Places API */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Globe className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-base">Google Places API</CardTitle>
                <CardDescription className="text-xs">
                  Voor bedrijfszoekopdrachten via Google Maps. Key aanmaken via{" "}
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Google Cloud Console
                  </a>.
                </CardDescription>
              </div>
              {googlePlacesConfigured || Boolean(googlePlacesKey.trim()) ? (
                <Badge variant="success" className="ml-auto"><CheckCircle className="mr-1 h-3 w-3" /> Actief</Badge>
              ) : (
                <Badge variant="secondary" className="ml-auto"><XCircle className="mr-1 h-3 w-3" /> Niet geconfigureerd</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type={showGoogleKey ? "text" : "password"}
                    value={googlePlacesKey}
                    onChange={(e) => setGooglePlacesKey(e.target.value)}
                    placeholder={googlePlacesConfigured ? "Nieuwe key invullen om te vervangen" : "AIza..."}
                    className="pl-9 pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGoogleKey(!showGoogleKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showGoogleKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={handleSaveGoogle}
                  disabled={batchUpdate.isPending || !googleDirty}
                >
                  {batchUpdate.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
                  Opslaan
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={testGoogle.isPending || (!googlePlacesConfigured && !googlePlacesKey.trim())}
                    onClick={() => { testGoogle.reset(); testGoogle.mutate(); }}
                >
                  {testGoogle.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Zap className="mr-2 h-3 w-3" />}
                  Test Verbinding
                </Button>
              </div>
              <TestResult
                result={testGoogle.data?.message ?? (testGoogle.error?.message || null)}
                isError={testGoogle.isError}
              />
            </div>
          </CardContent>
        </Card>

        {/* AI API keys */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <Bot className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <CardTitle className="text-base">AI API Keys</CardTitle>
                <CardDescription className="text-xs">
                  Sleutels voor AI-connectie. Provider/model stel je in bij AI Assistent.
                </CardDescription>
              </div>
              {anthropicConfigured || openaiConfigured || Boolean(anthropicKey.trim()) || Boolean(openaiKey.trim()) ? (
                <Badge variant="success" className="ml-auto"><CheckCircle className="mr-1 h-3 w-3" /> Actief</Badge>
              ) : (
                <Badge variant="secondary" className="ml-auto"><XCircle className="mr-1 h-3 w-3" /> Niet geconfigureerd</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <Label>Anthropic API Key</Label>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/settings/ai">
                    <Settings2 className="mr-1 h-3.5 w-3.5" />
                    AI Instellingen
                  </Link>
                </Button>
              </div>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showAnthropicKey ? "text" : "password"}
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder={anthropicConfigured ? "Nieuwe key invullen om te vervangen" : "sk-ant-..."}
                  className="pl-9 pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showAnthropicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={testAnthropic.isPending || (!anthropicConfigured && !anthropicKey.trim())}
                  onClick={() => { testAnthropic.reset(); testAnthropic.mutate(); }}
                >
                  {testAnthropic.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Zap className="mr-2 h-3 w-3" />}
                  Test Anthropic
                </Button>
              </div>
              <TestResult
                result={testAnthropic.data?.message ?? (testAnthropic.error?.message || null)}
                isError={testAnthropic.isError}
              />
            </div>

            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
              <Label>OpenAI API Key</Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showOpenaiKey ? "text" : "password"}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder={openaiConfigured ? "Nieuwe key invullen om te vervangen" : "sk-..."}
                  className="pl-9 pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={testOpenai.isPending || (!openaiConfigured && !openaiKey.trim())}
                  onClick={() => { testOpenai.reset(); testOpenai.mutate(); }}
                >
                  {testOpenai.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Zap className="mr-2 h-3 w-3" />}
                  Test OpenAI
                </Button>
              </div>
              <TestResult
                result={testOpenai.data?.message ?? (testOpenai.error?.message || null)}
                isError={testOpenai.isError}
              />
            </div>

              <div className="flex items-center justify-end">
              <Button size="sm" onClick={handleSaveAi} disabled={batchUpdate.isPending || !aiDirty}>
                {batchUpdate.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
                AI Keys opslaan
              </Button>
            </div>
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="mail" className="space-y-4">

        {/* SMTP Email */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <Mail className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-base">E-mail (SMTP)</CardTitle>
                <CardDescription className="text-xs">
                  Configureer SMTP voor het versturen van e-mails. Werkt met Gmail, Outlook, SendGrid, Mailgun, etc.
                </CardDescription>
              </div>
              {smtpConfigured ? (
                <Badge variant="success" className="ml-auto"><CheckCircle className="mr-1 h-3 w-3" /> Actief</Badge>
              ) : (
                <Badge variant="secondary" className="ml-auto"><XCircle className="mr-1 h-3 w-3" /> Console modus</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>SMTP Host</Label>
                <Input
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div className="space-y-2">
                <Label>SMTP Poort</Label>
                <Input
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="587"
                />
              </div>
              <div className="space-y-2">
                <Label>Gebruikersnaam</Label>
                <Input
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="hello@mijnbedrijf.be"
                />
              </div>
              <div className="space-y-2">
                <Label>Wachtwoord / App Password</Label>
                <div className="relative">
                  <Input
                    type={showSmtpPass ? "text" : "password"}
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    placeholder={smtpPassConfigured ? "Leeg laten om bestaand wachtwoord te behouden" : "••••••••"}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmtpPass(!showSmtpPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSmtpPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {smtpPassConfigured ? (
                  <p className="text-xs text-muted-foreground">Er is al een wachtwoord opgeslagen. Alleen invullen om te vervangen.</p>
                ) : null}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Server naam (TLS)</Label>
              <Input
                value={smtpServername}
                onChange={(e) => setSmtpServername(e.target.value)}
                placeholder="bijv. mail.mijnbedrijf.be (optioneel)"
              />
              <p className="text-xs text-muted-foreground">
                Gebruik hier de hostnaam die in het SSL-certificaat staat. Laat je dit leeg, dan gebruikt de app automatisch:{" "}
                <span className="font-medium text-foreground">{effectiveTlsServername || "-"}</span>.
              </p>
              {smtpHost.trim() === "smtp.digitify.be" ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Voor `smtp.digitify.be` lijkt het certificaat op `digitify.be` te staan. Zet hier best `digitify.be` of gebruik de knop hieronder.
                </div>
              ) : null}
              {smtpServername.trim() !== effectiveTlsServername && effectiveTlsServername ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSmtpServername(effectiveTlsServername)}
                >
                  Gebruik aanbevolen TLS servernaam
                </Button>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={!smtpRejectUnauthorized}
                onCheckedChange={(checked) => setSmtpRejectUnauthorized(!checked)}
              />
              <Label>Sta zelf-ondertekende certificaten toe</Label>
            </div>
            <div className="space-y-2">
              <Label>Testadres</Label>
              <Input
                type="email"
                value={smtpTestTo}
                onChange={(e) => setSmtpTestTo(e.target.value)}
                placeholder="test@mijnbedrijf.be"
              />
              <p className="text-xs text-muted-foreground">
                Gebruik een echt adres om levering te verifiëren.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSaveSmtp}
                disabled={batchUpdate.isPending || !smtpDirty}
              >
                {batchUpdate.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
                SMTP opslaan
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={testSmtp.isPending || !smtpConfigured}
                onClick={() => {
                  testSmtp.reset();
                  testSmtp.mutate({ toEmail: smtpTestTo.trim() || undefined });
                }}
              >
                {testSmtp.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Mail className="mr-2 h-3 w-3" />}
                Test E-mail Verzenden
              </Button>
            </div>
            <TestResult
              result={testSmtp.data?.message ?? (testSmtp.error?.message || null)}
              isError={testSmtp.isError}
            />
            <SmtpDnsGuide guide={testSmtp.data?.dnsGuide as any} />
            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
              <Label>DNS domein check (SPF / DKIM / DMARC)</Label>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input
                  value={dnsDomain}
                  onChange={(e) => setDnsDomain(e.target.value)}
                  placeholder="digitify.be"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={checkEmailDns.isPending}
                  onClick={() => {
                    checkEmailDns.reset();
                    checkEmailDns.mutate({ domain: dnsDomain.trim() || undefined });
                  }}
                >
                  {checkEmailDns.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Globe className="mr-2 h-3 w-3" />}
                  Controleer DNS
                </Button>
              </div>
              <TestResult
                result={checkEmailDns.error?.message || null}
                isError={checkEmailDns.isError}
              />
              <DnsCheckResult result={checkEmailDns.data as any} />
            </div>
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="inbox" className="space-y-4">

        {/* IMAP Inbox */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
                <Inbox className="h-5 w-5 text-cyan-500" />
              </div>
              <div>
                <CardTitle className="text-base">E-mail Inbox (IMAP)</CardTitle>
                <CardDescription className="text-xs">
                  Configureer IMAP voor inkomende e-mails in de inbox.
                </CardDescription>
              </div>
              {imapConfigured ? (
                <Badge variant="success" className="ml-auto"><CheckCircle className="mr-1 h-3 w-3" /> Actief</Badge>
              ) : (
                <Badge variant="secondary" className="ml-auto"><XCircle className="mr-1 h-3 w-3" /> Niet geconfigureerd</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>IMAP Host</Label>
                <Input
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                  placeholder="imap.gmail.com"
                />
              </div>
              <div className="space-y-2">
                <Label>IMAP Poort</Label>
                <Input
                  value={imapPort}
                  onChange={(e) => setImapPort(e.target.value)}
                  placeholder="993"
                />
              </div>
              <div className="space-y-2">
                <Label>Gebruikersnaam</Label>
                <Input
                  value={imapUser}
                  onChange={(e) => setImapUser(e.target.value)}
                  placeholder="hello@mijnbedrijf.be"
                />
              </div>
              <div className="space-y-2">
                <Label>Wachtwoord / App Password</Label>
                <div className="relative">
                  <Input
                    type={showImapPass ? "text" : "password"}
                    value={imapPass}
                    onChange={(e) => setImapPass(e.target.value)}
                    placeholder={imapPassConfigured ? "Leeg laten om bestaand wachtwoord te behouden" : "••••••••"}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowImapPass(!showImapPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showImapPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {imapPassConfigured ? (
                  <p className="text-xs text-muted-foreground">Er is al een wachtwoord opgeslagen. Alleen invullen om te vervangen.</p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={imapTls}
                onCheckedChange={setImapTls}
              />
              <Label>TLS / SSL verbinding</Label>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSaveImap}
                disabled={batchUpdate.isPending || !imapDirty}
              >
                {batchUpdate.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
                IMAP opslaan
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={testImap.isPending || !imapHost}
                onClick={() => { testImap.reset(); testImap.mutate(); }}
              >
                {testImap.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Zap className="mr-2 h-3 w-3" />}
                Test Verbinding
              </Button>
            </div>
            <TestResult
              result={testImap.data?.message ?? (testImap.error?.message || null)}
              isError={testImap.isError}
            />
          </CardContent>
        </Card>
        </TabsContent>
      </Tabs>

      <Button onClick={handleSave} disabled={batchUpdate.isPending || !anyDirty} size="lg">
        {batchUpdate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        {batchUpdate.isPending ? "Opslaan..." : anyDirty ? "Alle instellingen opslaan" : "Alles opgeslagen"}
      </Button>
    </div>
  );
}
