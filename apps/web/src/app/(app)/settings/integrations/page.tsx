"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Label,
  Skeleton,
  Badge,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@digitify/ui";
import {
  ArrowLeft,
  Save,
  Loader2,
  Key,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Bot,
  Globe,
  Mail,
  Inbox,
  Zap,
  AlertCircle,
  Settings2,
  CalendarDays,
  Copy,
  Check,
  Shield,
  ShieldCheck,
  KeyRound,
  Lightbulb,
  ExternalLink,
  Trash2,
  Megaphone,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/feedback/toast-provider";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { readSettingBoolean, readSettingString } from "@/lib/settings";

const SECRET_MASK = "••••••••";

type AiProviderId = "anthropic" | "openai" | "deepseek";

const AI_PROVIDER_SETTING_KEYS: Record<AiProviderId, string> = {
  anthropic: "api.anthropic_key",
  openai: "api.openai_key",
  deepseek: "api.deepseek_key",
};

const AI_PROVIDER_OPTIONS: Array<{
  id: AiProviderId;
  label: string;
  description: string;
  placeholder: string;
}> = [
  {
    id: "anthropic",
    label: "Anthropic",
    description: "Claude-modellen (Sonnet, Haiku, Opus)",
    placeholder: "sk-ant-...",
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "GPT-modellen (4o, 4o mini, 4.1)",
    placeholder: "sk-...",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    description: "DeepSeek Chat & Reasoner (OpenAI-compatibel)",
    placeholder: "sk-...",
  },
];

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

type SmtpDnsGuideData = {
  activeDomain?: string;
  senderEmail?: string;
  mailSubdomain?: string;
  providerLabel?: string | null;
  providerDocsUrl?: string | null;
  records?: Array<{ type: string; host: string; value: string; note: string }>;
  tips?: string[];
};

const DNS_RECORD_STYLES: Record<
  string,
  { icon: typeof Shield; badge: string; ring: string }
> = {
  SPF: {
    icon: Shield,
    badge: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    ring: "ring-sky-500/20",
  },
  DKIM: {
    icon: KeyRound,
    badge: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    ring: "ring-violet-500/20",
  },
  DMARC: {
    icon: ShieldCheck,
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-500/20",
  },
};

function DnsCopyField({ label, value }: { label: string; value: string }) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      showToast({ title: "Gekopieerd", description: `${label} staat op je klembord.` });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast({ title: "Kopiëren mislukt", variant: "error" });
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCopy}>
          {copied ? <Check className="mr-1 h-3 w-3 text-emerald-600" /> : <Copy className="mr-1 h-3 w-3" />}
          {copied ? "Gekopieerd" : "Kopiëren"}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-lg border bg-muted/40 px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground">
        {value}
      </pre>
    </div>
  );
}

function SmtpDnsGuide({ guide }: { guide: SmtpDnsGuideData | undefined }) {
  if (!guide) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/20 shadow-sm">
      <div className="border-b border-border/50 bg-muted/20 px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">DNS checklist voor verzenden</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Voeg deze records toe bij je DNS-beheerder (Cloudflare, Combell, …) na een geslaagde SMTP-test.
              </p>
            </div>
          </div>
          {guide.providerLabel ? (
            <Badge variant="secondary" className="shrink-0 text-[11px]">
              {guide.providerLabel}
            </Badge>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {guide.activeDomain ? (
            <span className="inline-flex items-center rounded-full border bg-background/80 px-2.5 py-1 text-[11px]">
              <span className="text-muted-foreground">Domein</span>
              <span className="ml-1.5 font-medium text-foreground">{guide.activeDomain}</span>
            </span>
          ) : null}
          {guide.senderEmail ? (
            <span className="inline-flex items-center rounded-full border bg-background/80 px-2.5 py-1 text-[11px]">
              <span className="text-muted-foreground">Afzender</span>
              <span className="ml-1.5 font-medium text-foreground">{guide.senderEmail}</span>
            </span>
          ) : null}
          {guide.mailSubdomain ? (
            <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-[11px]">
              <span className="text-muted-foreground">Subdomein</span>
              <span className="ml-1.5 font-medium text-foreground">{guide.mailSubdomain}</span>
            </span>
          ) : null}
        </div>
        {guide.providerDocsUrl ? (
          <a
            href={guide.providerDocsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Open provider-documentatie
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        {(guide.records || []).map((record, index) => {
          const style = DNS_RECORD_STYLES[record.type] ?? DNS_RECORD_STYLES.SPF;
          const Icon = style.icon;
          return (
            <div
              key={`${record.type}-${record.host}`}
              className={`rounded-xl border bg-background/60 p-4 ring-1 ${style.ring}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${style.badge}`}
                >
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${style.badge}`}>
                      {record.type}
                    </span>
                    <span className="truncate font-mono text-xs text-muted-foreground">{record.host}</span>
                  </div>
                  <DnsCopyField label="Recordwaarde (TXT)" value={record.value} />
                  <p className="text-xs leading-relaxed text-muted-foreground">{record.note}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(guide.tips || []).length > 0 ? (
        <div className="border-t border-border/50 bg-muted/15 px-4 py-3.5 sm:px-5">
          <div className="flex gap-2">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-foreground">Tips voor betere deliverability</p>
              <ul className="space-y-1 text-xs leading-relaxed text-muted-foreground">
                {(guide.tips || []).map((tip) => (
                  <li key={tip} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type DnsCheckData = {
  domain: string;
  overall: "healthy" | "partial" | "risk";
  summary?: string;
  checks: {
    spf: { status: string; host: string; record: string | null };
    dkim: {
      status: string;
      selector: string | null;
      host: string | null;
      record: string | null;
      scanned?: Array<{ selector: string; host: string; hasRecord: boolean }>;
    };
    dmarc: { status: string; host: string; record: string | null; policy: string | null };
  };
  guidance: string[];
};

const DNS_CHECK_META: Record<
  "SPF" | "DKIM" | "DMARC",
  { icon: typeof Shield; badge: string; ring: string; explain: string; missingHint: string }
> = {
  SPF: {
    icon: Shield,
    badge: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    ring: "ring-sky-500/20",
    explain: "Welke mailservers namens jouw domein mogen verzenden.",
    missingHint: "Voeg een TXT-record toe op je root-domein (zie checklist hierboven).",
  },
  DKIM: {
    icon: KeyRound,
    badge: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    ring: "ring-violet-500/20",
    explain: "Digitale handtekening zodat ontvangers zien dat mail echt van jou komt.",
    missingHint: "Haal host + waarde op bij Stackmail/Google en publiceer als TXT of CNAME.",
  },
  DMARC: {
    icon: ShieldCheck,
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-500/20",
    explain: "Instructie aan ontvangers wat te doen bij mislukte SPF/DKIM (none → quarantine → reject).",
    missingHint: "TXT op _dmarc.jouwdomein, start met p=none en een rua-mailadres.",
  },
};

function DnsStatusPill({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
      <CheckCircle className="h-3 w-3" />
      OK
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
      <XCircle className="h-3 w-3" />
      Ontbreekt
    </span>
  );
}

function DnsCheckRecordCard({
  type,
  ok,
  host,
  record,
  extra,
  children,
}: {
  type: "SPF" | "DKIM" | "DMARC";
  ok: boolean;
  host: string;
  record: string | null;
  extra?: ReactNode;
  children?: ReactNode;
}) {
  const meta = DNS_CHECK_META[type];
  const Icon = meta.icon;

  return (
    <div className={`rounded-xl border bg-background/70 p-4 ring-1 ${ok ? meta.ring : "ring-destructive/25"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.badge}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{type}</p>
            <p className="text-[11px] leading-snug text-muted-foreground">{meta.explain}</p>
          </div>
        </div>
        <DnsStatusPill ok={ok} />
      </div>

      <div className="mt-3 space-y-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">DNS-host</p>
          <p className="mt-0.5 font-mono text-xs text-foreground">{host || "—"}</p>
        </div>
        {record ? (
          <DnsCopyField label="Gevonden record" value={record} />
        ) : (
          <p className="rounded-lg border border-dashed border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
            {meta.missingHint}
          </p>
        )}
        {extra}
        {children}
      </div>
    </div>
  );
}

function DnsCheckResult({ result }: { result: DnsCheckData | null | undefined }) {
  if (!result) return null;

  const overallLabel =
    result.overall === "healthy" ? "Alles OK" : result.overall === "partial" ? "Gedeeltelijk" : "Actie nodig";
  const overallClass =
    result.overall === "healthy"
      ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
      : result.overall === "partial"
        ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
        : "bg-destructive/15 text-destructive";
  const okCount = ["spf", "dkim", "dmarc"].filter(
    (key) => result.checks[key as keyof typeof result.checks].status === "ok",
  ).length;

  const dmarcPolicyLabel =
    result.checks.dmarc.policy === "none"
      ? "Monitoring (geen blokkering)"
      : result.checks.dmarc.policy === "quarantine"
        ? "Twijfelachtige mail → spam/quarantaine"
        : result.checks.dmarc.policy === "reject"
          ? "Strikte afwijzing bij mislukking"
          : null;

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/15 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 bg-muted/20 px-4 py-3.5">
        <div>
          <p className="text-sm font-semibold text-foreground">Live DNS-status · {result.domain}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {result.summary || `${okCount} van 3 records gevonden via publieke DNS.`}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${overallClass}`}>
          {overallLabel}
        </span>
      </div>

      <div className="grid gap-3 p-4 lg:grid-cols-1">
        <DnsCheckRecordCard
          type="SPF"
          ok={result.checks.spf.status === "ok"}
          host={result.checks.spf.host}
          record={result.checks.spf.record}
        />
        <DnsCheckRecordCard
          type="DKIM"
          ok={result.checks.dkim.status === "ok"}
          host={result.checks.dkim.host || `*._domainkey.${result.domain}`}
          record={result.checks.dkim.record}
          extra={
            result.checks.dkim.selector ? (
              <p className="text-xs text-muted-foreground">
                Actieve selector: <span className="font-medium text-foreground">{result.checks.dkim.selector}</span>
              </p>
            ) : null
          }
        >
          {result.checks.dkim.status !== "ok" && result.checks.dkim.scanned?.length ? (
            <div className="rounded-lg border bg-muted/30 p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Geteste selectors
              </p>
              <ul className="mt-1.5 space-y-1">
                {result.checks.dkim.scanned.map((row) => (
                  <li key={row.selector} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-mono text-muted-foreground">{row.selector}</span>
                    {row.hasRecord ? (
                      <span className="text-emerald-600">gevonden</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </DnsCheckRecordCard>
        <DnsCheckRecordCard
          type="DMARC"
          ok={result.checks.dmarc.status === "ok"}
          host={result.checks.dmarc.host}
          record={result.checks.dmarc.record}
          extra={
            dmarcPolicyLabel ? (
              <p className="text-xs text-muted-foreground">
                Huidige policy: <span className="font-medium text-foreground">{dmarcPolicyLabel}</span>
              </p>
            ) : null
          }
        />
      </div>

      {result.guidance.length > 0 ? (
        <div className="border-t border-border/50 bg-muted/10 px-4 py-3">
          <p className="mb-2 text-xs font-semibold text-foreground">Samenvatting</p>
          <ul className="space-y-1.5">
            {result.guidance.map((item) => (
              <li key={item} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function TabStatusDot({ configured }: { configured: boolean }) {
  if (configured) return null;
  return (
    <span
      className="settings-integrations-tab-dot"
      title="Nog niet volledig geconfigureerd"
      aria-label="Nog niet volledig geconfigureerd"
    />
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

  const removeSettings = trpc.settings.removeSettings.useMutation({
    onSuccess: (_data, variables) => {
      utils.settings.getAll.invalidate();
      showToast({
        title: "Verwijderd",
        description: `${variables.keys.length} opgeslagen waarde(n) gewist.`,
        variant: "success",
      });
    },
    onError: (error) =>
      showToast({ title: "Verwijderen mislukt", description: error.message, variant: "error" }),
  });

  const [removeConfirm, setRemoveConfirm] = useState<null | {
    title: string;
    description: string;
    keys: string[];
    onCleared?: () => void;
  }>(null);

  // Test mutations
  const testGoogle = trpc.settings.testGooglePlaces.useMutation();
  const testAnthropic = trpc.settings.testAnthropicKey.useMutation();
  const testOpenai = trpc.settings.testOpenaiKey.useMutation();
  const testDeepseek = trpc.settings.testDeepseekKey.useMutation();
  const testSmtp = trpc.settings.testSmtp.useMutation();
  const checkEmailDns = trpc.settings.checkEmailDns.useMutation();
  const testImap = trpc.settings.testImap.useMutation();
  const metaConnection = trpc.social.connectionStatus.useQuery(undefined, { refetchInterval: 30_000 });
  const metaAdsConnection = trpc.metaAds.connectionStatus.useQuery(undefined, { refetchInterval: 30_000 });

  // Google
  const [googlePlacesKey, setGooglePlacesKey] = useState("");
  const [googlePlacesConfigured, setGooglePlacesConfigured] = useState(false);
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [googleOAuthClientId, setGoogleOAuthClientId] = useState("");
  const [googleOAuthClientSecret, setGoogleOAuthClientSecret] = useState("");
  const [googleOAuthSecretConfigured, setGoogleOAuthSecretConfigured] = useState(false);
  const [showGoogleOAuthSecret, setShowGoogleOAuthSecret] = useState(false);
  const [metaAppId, setMetaAppId] = useState("");
  const [metaAppSecret, setMetaAppSecret] = useState("");
  const [metaAppSecretConfigured, setMetaAppSecretConfigured] = useState(false);
  const [showMetaAppSecret, setShowMetaAppSecret] = useState(false);
  const [socialAutopostEnabled, setSocialAutopostEnabled] = useState(false);
  const [adsAutoadsEnabled, setAdsAutoadsEnabled] = useState(false);
  const [adsDefaultCurrency, setAdsDefaultCurrency] = useState("EUR");
  const [adsMaxDailyBudgetCents, setAdsMaxDailyBudgetCents] = useState("5000");

  // AI
  const [selectedAiProvider, setSelectedAiProvider] = useState<AiProviderId>("anthropic");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [deepseekKey, setDeepseekKey] = useState("");
  const [anthropicConfigured, setAnthropicConfigured] = useState(false);
  const [openaiConfigured, setOpenaiConfigured] = useState(false);
  const [deepseekConfigured, setDeepseekConfigured] = useState(false);
  const [showAiKey, setShowAiKey] = useState(false);

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
    googleOAuthClientId: readSettingString(settings, "integrations.google_oauth_client_id"),
    metaAppId: readSettingString(settings, "integrations.meta_app_id"),
    socialAutopostEnabled: readSettingBoolean(settings, "social.autopost_enabled", false),
    adsAutoadsEnabled: readSettingBoolean(settings, "ads.autoads_enabled", false),
    adsDefaultCurrency: readSettingString(settings, "ads.default_currency", "EUR"),
    adsMaxDailyBudgetCents: readSettingString(settings, "ads.max_daily_budget_cents", "5000"),
    anthropicKey: readSettingString(settings, "api.anthropic_key"),
    openaiKey: readSettingString(settings, "api.openai_key"),
    deepseekKey: readSettingString(settings, "api.deepseek_key"),
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
  const googleProviderDirty =
    googlePlacesKey.trim() !== initialState.googlePlacesKey
    || googleOAuthClientId.trim() !== initialState.googleOAuthClientId
    || Boolean(googleOAuthClientSecret.trim());
  const metaProviderDirty =
    metaAppId.trim() !== initialState.metaAppId
    || socialAutopostEnabled !== initialState.socialAutopostEnabled
    || adsAutoadsEnabled !== initialState.adsAutoadsEnabled
    || adsDefaultCurrency.trim() !== initialState.adsDefaultCurrency
    || adsMaxDailyBudgetCents.trim() !== initialState.adsMaxDailyBudgetCents
    || Boolean(metaAppSecret.trim());
  const googleDirty = googleProviderDirty || metaProviderDirty;
  const metaDirty = metaProviderDirty;
  const aiDirty =
    anthropicKey.trim() !== initialState.anthropicKey
    || openaiKey.trim() !== initialState.openaiKey
    || deepseekKey.trim() !== initialState.deepseekKey;
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
  const aiConfigured =
    anthropicConfigured
    || openaiConfigured
    || deepseekConfigured
    || Boolean(anthropicKey.trim() || openaiKey.trim() || deepseekKey.trim());
  const activeAiProvider = AI_PROVIDER_OPTIONS.find((item) => item.id === selectedAiProvider) ?? AI_PROVIDER_OPTIONS[0];
  const activeAiKey =
    selectedAiProvider === "openai"
      ? openaiKey
      : selectedAiProvider === "deepseek"
        ? deepseekKey
        : anthropicKey;
  const activeAiConfigured =
    selectedAiProvider === "openai"
      ? openaiConfigured
      : selectedAiProvider === "deepseek"
        ? deepseekConfigured
        : anthropicConfigured;
  const setActiveAiKey = (value: string) => {
    if (selectedAiProvider === "openai") setOpenaiKey(value);
    else if (selectedAiProvider === "deepseek") setDeepseekKey(value);
    else setAnthropicKey(value);
  };
  const activeAiTest =
    selectedAiProvider === "openai"
      ? testOpenai
      : selectedAiProvider === "deepseek"
        ? testDeepseek
        : testAnthropic;
  const googleOAuthConfigured = Boolean(
    googleOAuthClientId.trim() && (googleOAuthClientSecret.trim() || googleOAuthSecretConfigured),
  );
  const metaConfigured = Boolean(metaAppId.trim() && (metaAppSecret.trim() || metaAppSecretConfigured));
  const metaRedirectUrl = "https://leads.digitify.be/api/integrations/meta/callback";

  function extractDomainFromEmail(value: string) {
    const candidate = value.trim().toLowerCase();
    const at = candidate.lastIndexOf("@");
    if (at < 0) return "";
    return candidate.slice(at + 1);
  }

  useEffect(() => {
    if (settings) {
      const googleKeyRaw = readSettingString(settings, "api.google_places_key");
      const googleOAuthSecretRaw = readSettingString(settings, "integrations.google_oauth_client_secret");
      const metaAppSecretRaw = readSettingString(settings, "integrations.meta_app_secret");
      const anthropicKeyRaw = readSettingString(settings, "api.anthropic_key");
      const openaiKeyRaw = readSettingString(settings, "api.openai_key");
      const deepseekKeyRaw = readSettingString(settings, "api.deepseek_key");
      const providerRaw = readSettingString(settings, "api.ai_provider", "anthropic").toLowerCase();
      const smtpPassRaw = readSettingString(settings, "email.smtp_pass");
      const imapPassRaw = readSettingString(settings, "email.imap_pass");

      setGooglePlacesConfigured(Boolean(googleKeyRaw));
      setGoogleOAuthSecretConfigured(Boolean(googleOAuthSecretRaw));
      setMetaAppSecretConfigured(Boolean(metaAppSecretRaw));
      setAnthropicConfigured(Boolean(anthropicKeyRaw));
      setOpenaiConfigured(Boolean(openaiKeyRaw));
      setDeepseekConfigured(Boolean(deepseekKeyRaw));
      if (providerRaw === "openai" || providerRaw === "deepseek" || providerRaw === "anthropic") {
        setSelectedAiProvider(providerRaw);
      }

      setGooglePlacesKey(googleKeyRaw === SECRET_MASK ? "" : googleKeyRaw);
      setGoogleOAuthClientId(readSettingString(settings, "integrations.google_oauth_client_id"));
      setGoogleOAuthClientSecret(googleOAuthSecretRaw === SECRET_MASK ? "" : googleOAuthSecretRaw);
      setMetaAppId(readSettingString(settings, "integrations.meta_app_id"));
      setMetaAppSecret(metaAppSecretRaw === SECRET_MASK ? "" : metaAppSecretRaw);
      setSocialAutopostEnabled(readSettingBoolean(settings, "social.autopost_enabled", false));
      setAdsAutoadsEnabled(readSettingBoolean(settings, "ads.autoads_enabled", false));
      setAdsDefaultCurrency(readSettingString(settings, "ads.default_currency", "EUR"));
      setAdsMaxDailyBudgetCents(readSettingString(settings, "ads.max_daily_budget_cents", "5000"));
      setAnthropicKey(anthropicKeyRaw === SECRET_MASK ? "" : anthropicKeyRaw);
      setOpenaiKey(openaiKeyRaw === SECRET_MASK ? "" : openaiKeyRaw);
      setDeepseekKey(deepseekKeyRaw === SECRET_MASK ? "" : deepseekKeyRaw);
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
      { key: "integrations.google_oauth_client_id", value: googleOAuthClientId.trim() },
      { key: "integrations.google_oauth_client_secret", value: googleOAuthClientSecret },
      { key: "integrations.meta_app_id", value: metaAppId.trim() },
      { key: "integrations.meta_app_secret", value: metaAppSecret },
      { key: "social.autopost_enabled", value: String(socialAutopostEnabled) },
      { key: "ads.autoads_enabled", value: String(adsAutoadsEnabled) },
      { key: "ads.default_currency", value: adsDefaultCurrency.trim().toUpperCase() || "EUR" },
      { key: "ads.max_daily_budget_cents", value: adsMaxDailyBudgetCents.trim() || "5000" },
      { key: "api.anthropic_key", value: anthropicKey.trim() },
      { key: "api.openai_key", value: openaiKey.trim() },
      { key: "api.deepseek_key", value: deepseekKey.trim() },
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
    batchUpdate.mutate([
      { key: "api.google_places_key", value: googlePlacesKey.trim() },
      { key: "integrations.google_oauth_client_id", value: googleOAuthClientId.trim() },
      { key: "integrations.google_oauth_client_secret", value: googleOAuthClientSecret },
      { key: "integrations.meta_app_id", value: metaAppId.trim() },
      { key: "integrations.meta_app_secret", value: metaAppSecret },
      { key: "social.autopost_enabled", value: String(socialAutopostEnabled) },
      { key: "ads.autoads_enabled", value: String(adsAutoadsEnabled) },
      { key: "ads.default_currency", value: adsDefaultCurrency.trim().toUpperCase() || "EUR" },
      { key: "ads.max_daily_budget_cents", value: adsMaxDailyBudgetCents.trim() || "5000" },
    ]);
  }

  function handleSaveAi() {
    batchUpdate.mutate([
      { key: "api.anthropic_key", value: anthropicKey.trim() },
      { key: "api.openai_key", value: openaiKey.trim() },
      { key: "api.deepseek_key", value: deepseekKey.trim() },
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

  function requestRemoveSetting(config: {
    title: string;
    description: string;
    keys: string[];
    onCleared?: () => void;
  }) {
    setRemoveConfirm(config);
  }

  function confirmRemoveSettings() {
    if (!removeConfirm) return;
    const { keys, onCleared } = removeConfirm;
    removeSettings.mutate(
      { keys },
      {
        onSuccess: () => {
          onCleared?.();
          setRemoveConfirm(null);
        },
      },
    );
  }

  function clearActiveAiKeyState() {
    if (selectedAiProvider === "openai") {
      setOpenaiKey("");
      setOpenaiConfigured(false);
    } else if (selectedAiProvider === "deepseek") {
      setDeepseekKey("");
      setDeepseekConfigured(false);
    } else {
      setAnthropicKey("");
      setAnthropicConfigured(false);
    }
    activeAiTest.reset();
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
    <div className="app-page">
      <ConfirmDialog
        open={Boolean(removeConfirm)}
        title={removeConfirm?.title ?? "Verwijderen?"}
        description={removeConfirm?.description ?? ""}
        confirmLabel="Verwijderen"
        loading={removeSettings.isPending}
        onOpenChange={(open) => {
          if (!open) setRemoveConfirm(null);
        }}
        onConfirm={confirmRemoveSettings}
      />
      <div className="app-page-header">
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="rounded-xl"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="app-page-heading">
          <h1 className="app-page-title">Integraties & API Keys</h1>
          <p className="app-page-subtitle">Configureer externe diensten en API-sleutels</p>
        </div>
      </div>

      <Tabs defaultValue="providers" className="space-y-4">
        <TabsList className="settings-integrations-tabs">
          <TabsTrigger value="providers" className="settings-integrations-tab">
            <Bot className="settings-integrations-tab-icon" aria-hidden />
            <span className="settings-integrations-tab-label">API &amp; AI</span>
            <TabStatusDot configured={aiConfigured} />
          </TabsTrigger>
          <TabsTrigger value="calendar" className="settings-integrations-tab">
            <CalendarDays className="settings-integrations-tab-icon" aria-hidden />
            <span className="settings-integrations-tab-label">Google OAuth</span>
            <TabStatusDot configured={googleOAuthConfigured} />
          </TabsTrigger>
          <TabsTrigger value="mail" className="settings-integrations-tab">
            <Mail className="settings-integrations-tab-icon" aria-hidden />
            <span className="settings-integrations-tab-label">SMTP &amp; DNS</span>
            <TabStatusDot configured={smtpConfigured} />
          </TabsTrigger>
          <TabsTrigger value="inbox" className="settings-integrations-tab">
            <Inbox className="settings-integrations-tab-icon" aria-hidden />
            <span className="settings-integrations-tab-label">Inbox (IMAP)</span>
            <TabStatusDot configured={imapConfigured} />
          </TabsTrigger>
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
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={handleSaveGoogle}
                  disabled={batchUpdate.isPending || !googleProviderDirty}
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
                {googlePlacesConfigured ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={removeSettings.isPending}
                    onClick={() =>
                      requestRemoveSetting({
                        title: "Google Places API key verwijderen?",
                        description: "De opgeslagen key wordt permanent gewist. Zoeken via Google Places werkt daarna niet meer tot je een nieuwe key invult.",
                        keys: ["api.google_places_key"],
                        onCleared: () => {
                          setGooglePlacesKey("");
                          setGooglePlacesConfigured(false);
                          testGoogle.reset();
                        },
                      })
                    }
                  >
                    <Trash2 className="mr-2 h-3 w-3" />
                    Key verwijderen
                  </Button>
                ) : null}
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
          <CardHeader className="space-y-3">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/ai">
                  <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                  AI Instellingen
                </Link>
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <Bot className="h-5 w-5 text-purple-500" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base">AI API Keys</CardTitle>
                <CardDescription className="text-xs">
                  Sleutels voor AI-connectie. Provider en model stel je in via AI Instellingen.
                </CardDescription>
              </div>
              {aiConfigured ? (
                <Badge variant="success" className="shrink-0"><CheckCircle className="mr-1 h-3 w-3" /> Actief</Badge>
              ) : (
                <Badge variant="secondary" className="shrink-0"><XCircle className="mr-1 h-3 w-3" /> Niet geconfigureerd</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-gradient-to-br from-purple-500/5 via-transparent to-violet-500/5 p-4">
              <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {AI_PROVIDER_OPTIONS.map((option) => {
                      const configured =
                        option.id === "openai"
                          ? openaiConfigured || Boolean(openaiKey.trim())
                          : option.id === "deepseek"
                            ? deepseekConfigured || Boolean(deepseekKey.trim())
                            : anthropicConfigured || Boolean(anthropicKey.trim());
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            setSelectedAiProvider(option.id);
                            setShowAiKey(false);
                            activeAiTest.reset();
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                            selectedAiProvider === option.id
                              ? "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300"
                              : "border-border/60 bg-background/60 text-muted-foreground hover:border-border"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${configured ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                          />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    <Label>{activeAiProvider.label} API Key</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type={showAiKey ? "text" : "password"}
                        value={activeAiKey}
                        onChange={(e) => setActiveAiKey(e.target.value)}
                        placeholder={
                          activeAiConfigured
                            ? "Nieuwe key invullen om te vervangen"
                            : activeAiProvider.placeholder
                        }
                        className="bg-background/80 pl-9 pr-10 font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAiKey(!showAiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showAiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={activeAiTest.isPending || (!activeAiConfigured && !activeAiKey.trim())}
                      onClick={() => {
                        activeAiTest.reset();
                        activeAiTest.mutate();
                      }}
                    >
                      {activeAiTest.isPending ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : (
                        <Zap className="mr-2 h-3 w-3" />
                      )}
                      Test {activeAiProvider.label}
                    </Button>
                    {activeAiConfigured ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={removeSettings.isPending}
                        onClick={() =>
                          requestRemoveSetting({
                            title: `${activeAiProvider.label} API key verwijderen?`,
                            description: `De opgeslagen ${activeAiProvider.label}-key wordt permanent gewist.`,
                            keys: [AI_PROVIDER_SETTING_KEYS[selectedAiProvider]],
                            onCleared: clearActiveAiKeyState,
                          })
                        }
                      >
                        <Trash2 className="mr-2 h-3 w-3" />
                        Key verwijderen
                      </Button>
                    ) : null}
                    <p className="text-[11px] text-muted-foreground">
                      Welke provider actief is, stel je in via{" "}
                      <Link href="/settings/ai" className="font-medium text-primary hover:underline">
                        AI Instellingen
                      </Link>
                      . Alle keys bewaar je hier.
                    </p>
                  </div>
                  <TestResult
                    result={activeAiTest.data?.message ?? (activeAiTest.error?.message || null)}
                    isError={activeAiTest.isError}
                  />
              </div>
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

        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10">
                  <CalendarDays className="h-5 w-5 text-sky-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Google Calendar & Meet OAuth</CardTitle>
                  <CardDescription className="text-xs">
                    Globale Google app-credentials voor login. Elke gebruiker koppelt daarna zijn eigen agenda via Booking instellingen.
                  </CardDescription>
                </div>
                {googleOAuthClientId.trim() && (googleOAuthSecretConfigured || googleOAuthClientSecret.trim()) ? (
                  <Badge variant="success" className="ml-auto"><CheckCircle className="mr-1 h-3 w-3" /> Klaar</Badge>
                ) : (
                  <Badge variant="secondary" className="ml-auto"><XCircle className="mr-1 h-3 w-3" /> Niet compleet</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>OAuth Client ID</Label>
                <Input
                  value={googleOAuthClientId}
                  onChange={(event) => setGoogleOAuthClientId(event.target.value)}
                  placeholder="...apps.googleusercontent.com"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>OAuth Client Secret</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type={showGoogleOAuthSecret ? "text" : "password"}
                    value={googleOAuthClientSecret}
                    onChange={(event) => setGoogleOAuthClientSecret(event.target.value)}
                    placeholder={googleOAuthSecretConfigured ? "Nieuwe secret invullen om te vervangen" : "GOCSPX-..."}
                    className="pl-9 pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGoogleOAuthSecret(!showGoogleOAuthSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showGoogleOAuthSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                Redirect URL: <span className="font-mono text-foreground">https://leads.digitify.be/api/integrations/google-calendar/callback</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/settings/bookings#google-agenda">
                    <CalendarDays className="mr-2 h-3.5 w-3.5" />
                    Mijn agenda koppelen
                  </Link>
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                  {googleOAuthConfigured ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={removeSettings.isPending}
                      onClick={() =>
                        requestRemoveSetting({
                          title: "Google OAuth-gegevens verwijderen?",
                          description: "Client ID en secret worden gewist. Agenda-koppelingen werken pas weer na nieuwe credentials.",
                          keys: [
                            "integrations.google_oauth_client_id",
                            "integrations.google_oauth_client_secret",
                          ],
                          onCleared: () => {
                            setGoogleOAuthClientId("");
                            setGoogleOAuthClientSecret("");
                            setGoogleOAuthSecretConfigured(false);
                          },
                        })
                      }
                    >
                      <Trash2 className="mr-2 h-3 w-3" />
                      OAuth wissen
                    </Button>
                  ) : null}
                  <Button size="sm" onClick={handleSaveGoogle} disabled={batchUpdate.isPending || !googleProviderDirty}>
                    {batchUpdate.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
                    Google OAuth opslaan
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-indigo-500/20">
            <CardHeader className="border-b bg-gradient-to-br from-indigo-500/10 via-sky-500/5 to-background">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-sm">
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Meta publicatiehub</CardTitle>
                    <CardDescription className="mt-1 max-w-2xl text-xs leading-relaxed">
                      Verbind exact één Facebook Page en gekoppeld Instagram Business-account. Drafts blijven veilig:
                      alleen goedgekeurde en ingeplande posts worden door de cron gepubliceerd.
                    </CardDescription>
                  </div>
                </div>
                {metaConnection.data?.connected ? (
                  <Badge variant="success"><CheckCircle className="mr-1 h-3 w-3" /> Klaar om te posten</Badge>
                ) : metaConfigured ? (
                  <Badge variant="secondary"><AlertCircle className="mr-1 h-3 w-3" /> App klaar, nog koppelen</Badge>
                ) : (
                  <Badge variant="secondary"><XCircle className="mr-1 h-3 w-3" /> Setup nodig</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Meta App ID</Label>
                      <Input
                        value={metaAppId}
                        onChange={(event) => setMetaAppId(event.target.value)}
                        placeholder="123456789012345"
                        className="font-mono text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Meta App Secret</Label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type={showMetaAppSecret ? "text" : "password"}
                          value={metaAppSecret}
                          onChange={(event) => setMetaAppSecret(event.target.value)}
                          placeholder={metaAppSecretConfigured ? "Nieuwe secret invullen om te vervangen" : "••••••••"}
                          className="pl-9 pr-10 font-mono text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowMetaAppSecret(!showMetaAppSecret)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showMetaAppSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-muted/20 p-3">
                    <DnsCopyField label="Redirect URL voor Meta" value={metaRedirectUrl} />
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verbindingsstatus</p>
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Facebook Page</span>
                      <span className="truncate font-mono text-xs">{metaConnection.data?.pageId || "Niet gekoppeld"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Instagram Business</span>
                      <span className="truncate font-mono text-xs">{metaConnection.data?.instagramBusinessId || "Niet gekoppeld"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Autopost</span>
                      <span className={socialAutopostEnabled ? "text-emerald-600" : "text-muted-foreground"}>
                        {socialAutopostEnabled ? "Actief" : "Uit"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Meta Ads account</span>
                      <span className="truncate font-mono text-xs">
                        {metaAdsConnection.data?.selectedAdAccountName || metaAdsConnection.data?.selectedAdAccountId || "Niet gekozen"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Max dagbudget</span>
                      <span className="font-mono text-xs">{adsDefaultCurrency} {Number(adsMaxDailyBudgetCents || 0) / 100}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">Autopost inschakelen</p>
                      <p className="text-xs text-muted-foreground">Publiceert alleen posts met status Scheduled.</p>
                    </div>
                    <Switch checked={socialAutopostEnabled} onCheckedChange={setSocialAutopostEnabled} />
                  </div>
                  <div className="space-y-3 rounded-lg bg-muted/30 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Meta Ads module</p>
                        <p className="text-xs text-muted-foreground">Laat drafts en paused pushes toe na approval.</p>
                      </div>
                      <Switch checked={adsAutoadsEnabled} onCheckedChange={setAdsAutoadsEnabled} />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Valuta</Label>
                        <Input value={adsDefaultCurrency} onChange={(event) => setAdsDefaultCurrency(event.target.value.toUpperCase())} maxLength={3} className="h-8" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Max dagbudget (cent)</Label>
                        <Input value={adsMaxDailyBudgetCents} onChange={(event) => setAdsMaxDailyBudgetCents(event.target.value)} inputMode="numeric" className="h-8" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground sm:grid-cols-3">
                <div><span className="font-semibold text-foreground">1.</span> Vul App ID en Secret in.</div>
                <div><span className="font-semibold text-foreground">2.</span> Voeg de redirect URL toe in Meta.</div>
                <div><span className="font-semibold text-foreground">3.</span> Klik op koppelen en kies Page + IG account.</div>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-900 dark:text-amber-100">
                <p className="font-semibold">Krijg je “Invalid Scopes” bij Meta?</p>
                <p className="mt-1">
                  Controleer dat je app Facebook Login/Pages én Instagram Graph publishing ondersteunt. Nieuwe Meta-apps gebruiken vaak
                  <span className="font-mono"> instagram_business_basic</span> en
                  <span className="font-mono"> instagram_business_content_publish</span>. Oudere apps kunnen nog
                  <span className="font-mono"> instagram_basic</span> en
                  <span className="font-mono"> instagram_content_publish</span> vereisen. Dit kan via
                  <span className="font-mono"> META_OAUTH_SCOPES</span> worden overschreven.
                </p>
                <p className="mt-2">
                  Voor Meta Ads heeft de app extra Marketing API-scopes nodig:
                  <span className="font-mono"> ads_read</span>,
                  <span className="font-mono"> ads_management</span> en meestal
                  <span className="font-mono"> business_management</span>. Campagnes worden altijd met
                  <span className="font-mono"> status=PAUSED</span> aangemaakt.
                </p>
                {metaAdsConnection.data?.missingConfiguredScopes?.length ? (
                  <p className="mt-2 font-semibold">
                    Huidige OAuth-config mist: <span className="font-mono">{metaAdsConnection.data.missingConfiguredScopes.join(", ")}</span>.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant={metaConnection.data?.connected ? "outline" : "default"} size="sm" asChild disabled={!metaConfigured}>
                  <a href="/api/integrations/meta/connect">
                    {metaConnection.data?.connected ? "Opnieuw koppelen" : "Meta koppelen"}
                  </a>
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                  {metaAppSecretConfigured || metaConnection.data?.connected ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={removeSettings.isPending}
                      onClick={() =>
                        requestRemoveSetting({
                          title: "Meta OAuth-gegevens verwijderen?",
                          description: "Meta app-secret en alle gekoppelde social tokens/IDs worden gewist.",
                          keys: [
                            "integrations.meta_app_secret",
                            "social.meta_access_token",
                            "social.meta_refresh_meta",
                            "social.meta_page_access_token",
                            "social.meta_page_id",
                            "social.meta_instagram_business_id",
                            "social.meta_token_expires_at",
                            "ads.meta_ad_account_id",
                            "ads.meta_business_id",
                          ],
                          onCleared: () => {
                            setMetaAppSecret("");
                            setMetaAppSecretConfigured(false);
                            metaConnection.refetch();
                            metaAdsConnection.refetch();
                          },
                        })
                      }
                    >
                      <Trash2 className="mr-2 h-3 w-3" />
                      Meta loskoppelen
                    </Button>
                  ) : null}
                  <Button size="sm" onClick={handleSaveGoogle} disabled={batchUpdate.isPending || !metaDirty}>
                    {batchUpdate.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
                    Meta instellingen opslaan
                  </Button>
                </div>
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
            <div className="flex flex-wrap items-center gap-2">
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
              {smtpPassConfigured ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={removeSettings.isPending}
                  onClick={() =>
                    requestRemoveSetting({
                      title: "SMTP-wachtwoord verwijderen?",
                      description: "Alleen het opgeslagen wachtwoord wordt gewist. Host en gebruiker blijven staan.",
                      keys: ["email.smtp_pass"],
                      onCleared: () => {
                        setSmtpPass("");
                        setSmtpPassConfigured(false);
                        testSmtp.reset();
                      },
                    })
                  }
                >
                  <Trash2 className="mr-2 h-3 w-3" />
                  Wachtwoord wissen
                </Button>
              ) : null}
              {smtpConfigured || smtpHost.trim() || smtpUser.trim() ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={removeSettings.isPending}
                  onClick={() =>
                    requestRemoveSetting({
                      title: "Volledige SMTP-configuratie wissen?",
                      description: "Host, poort, gebruiker, wachtwoord en TLS-instellingen worden verwijderd. Verzenden valt terug op console-modus.",
                      keys: [
                        "email.smtp_host",
                        "email.smtp_port",
                        "email.smtp_user",
                        "email.smtp_pass",
                        "email.smtp_servername",
                        "email.smtp_tls_reject_unauthorized",
                        "email.provider",
                      ],
                      onCleared: () => {
                        setSmtpHost("");
                        setSmtpPort("587");
                        setSmtpUser("");
                        setSmtpPass("");
                        setSmtpPassConfigured(false);
                        setSmtpServername("");
                        setSmtpRejectUnauthorized(true);
                        testSmtp.reset();
                      },
                    })
                  }
                >
                  <Trash2 className="mr-2 h-3 w-3" />
                  SMTP wissen
                </Button>
              ) : null}
            </div>
            <TestResult
              result={testSmtp.data?.message ?? (testSmtp.error?.message || null)}
              isError={testSmtp.isError}
            />
            <SmtpDnsGuide guide={testSmtp.data?.dnsGuide as any} />
            <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/10">
              <div className="space-y-3 border-b border-border/50 p-4 sm:p-5">
                <div>
                  <Label className="text-sm">Live DNS-controle</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Leest publieke SPF-, DKIM- en DMARC-records. Handig na wijzigingen bij je DNS-provider.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input
                    value={dnsDomain}
                    onChange={(e) => setDnsDomain(e.target.value)}
                    placeholder="digitify.be"
                    className="bg-background"
                  />
                  <Button
                    variant="default"
                    size="sm"
                    className="shrink-0"
                    disabled={checkEmailDns.isPending}
                    onClick={() => {
                      checkEmailDns.reset();
                      checkEmailDns.mutate({ domain: dnsDomain.trim() || undefined });
                    }}
                  >
                    {checkEmailDns.isPending ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : (
                      <Globe className="mr-2 h-3 w-3" />
                    )}
                    Controleer DNS
                  </Button>
                </div>
                <TestResult
                  result={checkEmailDns.error?.message || null}
                  isError={checkEmailDns.isError}
                />
              </div>
              {checkEmailDns.data ? (
                <div className="p-4 pt-0 sm:p-5 sm:pt-0">
                  <DnsCheckResult result={checkEmailDns.data as DnsCheckData} />
                </div>
              ) : null}
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
            <div className="flex flex-wrap items-center gap-2">
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
              {imapPassConfigured ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={removeSettings.isPending}
                  onClick={() =>
                    requestRemoveSetting({
                      title: "IMAP-wachtwoord verwijderen?",
                      description: "Alleen het opgeslagen wachtwoord wordt gewist.",
                      keys: ["email.imap_pass"],
                      onCleared: () => {
                        setImapPass("");
                        setImapPassConfigured(false);
                        testImap.reset();
                      },
                    })
                  }
                >
                  <Trash2 className="mr-2 h-3 w-3" />
                  Wachtwoord wissen
                </Button>
              ) : null}
              {imapConfigured || imapHost.trim() || imapUser.trim() ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={removeSettings.isPending}
                  onClick={() =>
                    requestRemoveSetting({
                      title: "Volledige IMAP-configuratie wissen?",
                      description: "Host, poort, gebruiker en wachtwoord worden verwijderd.",
                      keys: [
                        "email.imap_host",
                        "email.imap_port",
                        "email.imap_user",
                        "email.imap_pass",
                        "email.imap_tls",
                      ],
                      onCleared: () => {
                        setImapHost("");
                        setImapPort("993");
                        setImapUser("");
                        setImapPass("");
                        setImapPassConfigured(false);
                        setImapTls(true);
                        testImap.reset();
                      },
                    })
                  }
                >
                  <Trash2 className="mr-2 h-3 w-3" />
                  IMAP wissen
                </Button>
              ) : null}
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
