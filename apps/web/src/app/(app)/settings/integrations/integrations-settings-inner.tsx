"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { getAppUrl } from "@/lib/config";
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
  Sparkles,
  Globe2,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffectiveAppRole } from "@/lib/use-effective-app-role";
import { useToast } from "@/components/feedback/toast-provider";
import { hasRole } from "@/lib/permissions";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { readSettingBoolean, readSettingString } from "@/lib/settings";
import { SETTINGS_PAGE_QUERY_OPTS } from "@/lib/settings-query-options";
import { formatTrpcErrorMessage } from "@/lib/trpc/format-error";
import {
  DnsCopyField,
  IntegrationActionBar,
  IntegrationNav,
  IntegrationOverviewCard,
  IntegrationPanel,
  IntegrationTestResult,
  SecretKeyField,
  SetupSteps,
  type IntegrationNavItem,
} from "@/components/settings/integrations/integration-ui";
import { MuapiIntegrationPanel } from "@/components/settings/integrations/muapi-integration-panel";

const SECRET_MASK = "••••••••";

type IntegrationTabId =
  | "overview"
  | "google-places"
  | "muapi"
  | "anthropic"
  | "openai"
  | "deepseek"
  | "google-oauth"
  | "meta"
  | "smtp"
  | "imap";

const INTEGRATION_TAB_IDS: IntegrationTabId[] = [
  "overview",
  "google-places",
  "muapi",
  "anthropic",
  "openai",
  "deepseek",
  "google-oauth",
  "meta",
  "smtp",
  "imap",
];

function isIntegrationTabId(value: string): value is IntegrationTabId {
  return INTEGRATION_TAB_IDS.includes(value as IntegrationTabId);
}

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

const TestResult = IntegrationTestResult;

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

export function IntegrationsSettingsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status: sessionStatus } = useSession();
  const role = useEffectiveAppRole();
  const canManageWorkspaceIntegrations = hasRole(role, ["OWNER"]);
  const { data: settings, isLoading, error, refetch } = trpc.settings.getIntegrationsSettings.useQuery(undefined, {
    enabled: sessionStatus === "authenticated" && canManageWorkspaceIntegrations,
    retry: 1,
    ...SETTINGS_PAGE_QUERY_OPTS,
  });
  const utils = trpc.useUtils();
  const { showToast } = useToast();

  const batchUpdate = trpc.settings.batchUpdate.useMutation({
    onSuccess: () => {
      utils.settings.getIntegrationsSettings.invalidate();
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
      utils.settings.getIntegrationsSettings.invalidate();
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
  const testGoogleSync = trpc.booking.testGoogleSync.useMutation();
  const [integrationsTab, setIntegrationsTab] = useState<IntegrationTabId>("overview");
  const muapiKeyStatus = trpc.media.getMuapiKeyStatus.useQuery(undefined, {
    enabled: integrationsTab === "overview" || integrationsTab === "muapi",
    refetchOnWindowFocus: false,
  });

  function selectIntegrationsTab(tab: IntegrationTabId) {
    setIntegrationsTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const query = params.toString();
    router.replace(query ? `/settings/integrations?${query}` : "/settings/integrations", { scroll: false });
  }

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && isIntegrationTabId(tab)) {
      setIntegrationsTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    if (!canManageWorkspaceIntegrations && integrationsTab !== "overview" && integrationsTab !== "muapi") {
      selectIntegrationsTab("muapi");
    }
  }, [sessionStatus, canManageWorkspaceIntegrations, integrationsTab]);

  useEffect(() => {
    const googleStatus = searchParams.get("google");
    if (!googleStatus) return;
    const messages: Record<string, { title: string; description?: string; variant?: "error" }> = {
      connected: { title: "Google Agenda gekoppeld", description: "Agenda-sync is actief." },
      forbidden: { title: "Geen rechten", description: "Alleen eigenaar of admin kan Google Agenda koppelen.", variant: "error" },
      error: { title: "Koppeling mislukt", description: "Probeer opnieuw of controleer je OAuth-credentials.", variant: "error" },
      "missing-config": { title: "OAuth niet geconfigureerd", description: "Vul eerst Google Client ID en secret in.", variant: "error" },
    };
    const message = messages[googleStatus] ?? {
      title: "Google Agenda",
      description: googleStatus,
      variant: "error" as const,
    };
    showToast(message);
    if (googleStatus) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("google");
      const query = params.toString();
      router.replace(query ? `/settings/integrations?${query}` : "/settings/integrations?tab=google-oauth", {
        scroll: false,
      });
    }
  }, [searchParams]);

  const pollProviderConnections = integrationsTab === "google-oauth" || integrationsTab === "meta";
  const metaConnection = trpc.social.connectionStatus.useQuery(undefined, {
    enabled: pollProviderConnections,
    refetchInterval: pollProviderConnections ? 30_000 : false,
    refetchOnWindowFocus: false,
  });
  const metaAdsConnection = trpc.metaAds.connectionStatus.useQuery(undefined, {
    enabled: pollProviderConnections,
    refetchInterval: pollProviderConnections ? 30_000 : false,
    refetchOnWindowFocus: false,
  });
  const googleAdsConnection = trpc.googleAds.connectionStatus.useQuery(undefined, {
    enabled: pollProviderConnections,
    refetchInterval: pollProviderConnections ? 30_000 : false,
    refetchOnWindowFocus: false,
  });

  // Google
  const [googlePlacesKey, setGooglePlacesKey] = useState("");
  const [googlePlacesConfigured, setGooglePlacesConfigured] = useState(false);
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [googleOAuthClientId, setGoogleOAuthClientId] = useState("");
  const [googleOAuthClientSecret, setGoogleOAuthClientSecret] = useState("");
  const [googleOAuthSecretConfigured, setGoogleOAuthSecretConfigured] = useState(false);
  const [showGoogleOAuthSecret, setShowGoogleOAuthSecret] = useState(false);
  const [googleOauthEmail, setGoogleOauthEmail] = useState("");
  const [googleServiceAccountEmail, setGoogleServiceAccountEmail] = useState("");
  const [googleServicePrivateKey, setGoogleServicePrivateKey] = useState("");
  const [googleServicePrivateKeyConfigured, setGoogleServicePrivateKeyConfigured] = useState(false);
  const [showGoogleServicePrivateKey, setShowGoogleServicePrivateKey] = useState(false);
  const [metaAppId, setMetaAppId] = useState("");
  const [metaAppSecret, setMetaAppSecret] = useState("");
  const [metaAppSecretConfigured, setMetaAppSecretConfigured] = useState(false);
  const [showMetaAppSecret, setShowMetaAppSecret] = useState(false);
  const [socialAutopostEnabled, setSocialAutopostEnabled] = useState(false);
  const [adsAutoadsEnabled, setAdsAutoadsEnabled] = useState(false);
  const [adsDefaultCurrency, setAdsDefaultCurrency] = useState("EUR");
  const [adsMaxDailyBudgetCents, setAdsMaxDailyBudgetCents] = useState("5000");

  // AI
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
    googleOauthEmail: readSettingString(settings, "bookings.google_oauth_account_email"),
    googleServiceAccountEmail: readSettingString(settings, "bookings.google_service_account_email"),
  }), [settings]);
  const googlePlacesDirty = googlePlacesKey.trim() !== initialState.googlePlacesKey;
  const googleOAuthDirty =
    googleOAuthClientId.trim() !== initialState.googleOAuthClientId
    || Boolean(googleOAuthClientSecret.trim());
  const anthropicDirty = anthropicKey.trim() !== initialState.anthropicKey;
  const openaiDirty = openaiKey.trim() !== initialState.openaiKey;
  const deepseekDirty = deepseekKey.trim() !== initialState.deepseekKey;
  const metaProviderDirty =
    metaAppId.trim() !== initialState.metaAppId
    || socialAutopostEnabled !== initialState.socialAutopostEnabled
    || adsAutoadsEnabled !== initialState.adsAutoadsEnabled
    || adsDefaultCurrency.trim() !== initialState.adsDefaultCurrency
    || adsMaxDailyBudgetCents.trim() !== initialState.adsMaxDailyBudgetCents
    || Boolean(metaAppSecret.trim());
  const metaDirty = metaProviderDirty;
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
  const anthropicConfiguredActive = anthropicConfigured || Boolean(anthropicKey.trim());
  const openaiConfiguredActive = openaiConfigured || Boolean(openaiKey.trim());
  const deepseekConfiguredActive = deepseekConfigured || Boolean(deepseekKey.trim());
  const googleOAuthConfigured = Boolean(
    googleOAuthClientId.trim() && (googleOAuthClientSecret.trim() || googleOAuthSecretConfigured),
  );
  const googleCalendarOAuthConnected = Boolean(googleOauthEmail.trim());
  const googleServiceAccountConfigured = Boolean(
    googleServiceAccountEmail.trim() &&
      (googleServicePrivateKey.trim() || googleServicePrivateKeyConfigured),
  );
  const googleCalendarDirty =
    googleServiceAccountEmail.trim() !== initialState.googleServiceAccountEmail
    || Boolean(googleServicePrivateKey.trim());
  const muapiConfigured = Boolean(muapiKeyStatus.data?.hasKey);
  const googlePlacesConfiguredActive = googlePlacesConfigured || Boolean(googlePlacesKey.trim());
  const metaConfigured = Boolean(metaAppId.trim() && (metaAppSecret.trim() || metaAppSecretConfigured));
  const metaRedirectUrl = "https://leads.digitify.be/api/integrations/meta/callback";

  const integrationNavItemsAll: IntegrationNavItem[] = [
    { id: "overview", label: "Overzicht", description: "Status van alle koppelingen", icon: Settings2, configured: true, group: "Start" },
    { id: "google-places", label: "Google Places", description: "Lead-zoekopdrachten", icon: Globe, configured: googlePlacesConfiguredActive, dirty: googlePlacesDirty, group: "Zoeken" },
    { id: "muapi", label: "MuAPI", description: "Creative Studio & AI-media", icon: Sparkles, configured: muapiConfigured, group: "AI & media" },
    { id: "anthropic", label: "Anthropic", description: "Claude API", icon: Bot, configured: anthropicConfiguredActive, dirty: anthropicDirty, group: "AI" },
    { id: "openai", label: "OpenAI", description: "GPT API", icon: Bot, configured: openaiConfiguredActive, dirty: openaiDirty, group: "AI" },
    { id: "deepseek", label: "DeepSeek", description: "DeepSeek API", icon: Bot, configured: deepseekConfiguredActive, dirty: deepseekDirty, group: "AI" },
    { id: "google-oauth", label: "Google OAuth", description: "Agenda, Meet & Ads", icon: CalendarDays, configured: googleOAuthConfigured || googleCalendarOAuthConnected, dirty: googleOAuthDirty || googleCalendarDirty, group: "OAuth" },
    { id: "meta", label: "Meta", description: "Facebook & Instagram", icon: Megaphone, configured: metaConfigured || Boolean(metaConnection.data?.connected), dirty: metaDirty, group: "OAuth" },
    { id: "smtp", label: "SMTP", description: "Uitgaande e-mail", icon: Mail, configured: smtpConfigured, dirty: smtpDirty, group: "E-mail" },
    { id: "imap", label: "IMAP", description: "Inkomende inbox", icon: Inbox, configured: imapConfigured, dirty: imapDirty, group: "E-mail" },
  ];
  const integrationNavItems =
    sessionStatus === "loading" || canManageWorkspaceIntegrations
      ? integrationNavItemsAll
      : integrationNavItemsAll.filter((item) => item.id === "overview" || item.id === "muapi");

  function renderAiProviderPanel(provider: AiProviderId) {
    const option = AI_PROVIDER_OPTIONS.find((item) => item.id === provider)!;
    const configured =
      provider === "openai"
        ? openaiConfiguredActive
        : provider === "deepseek"
          ? deepseekConfiguredActive
          : anthropicConfiguredActive;
    const keyValue =
      provider === "openai" ? openaiKey : provider === "deepseek" ? deepseekKey : anthropicKey;
    const setKeyValue =
      provider === "openai" ? setOpenaiKey : provider === "deepseek" ? setDeepseekKey : setAnthropicKey;
    const dirty =
      provider === "openai" ? openaiDirty : provider === "deepseek" ? deepseekDirty : anthropicDirty;
    const testMutation =
      provider === "openai" ? testOpenai : provider === "deepseek" ? testDeepseek : testAnthropic;

    return (
      <IntegrationPanel
        icon={Bot}
        iconClassName="bg-purple-500/10 text-purple-600 dark:text-purple-300"
        title={`${option.label} API`}
        description={option.description}
        configured={configured}
        footer={
          <IntegrationActionBar>
            <Button size="sm" onClick={() => handleSaveAiProvider(provider)} disabled={batchUpdate.isPending || !dirty}>
              {batchUpdate.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
              Opslaan
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/ai">
                <Settings2 className="mr-2 h-3 w-3" />
                AI-instellingen
              </Link>
            </Button>
          </IntegrationActionBar>
        }
      >
        <SecretKeyField
          label="API-sleutel"
          value={keyValue}
          onChange={setKeyValue}
          placeholder={configured ? "Nieuwe sleutel om te vervangen" : option.placeholder}
          show={showAiKey}
          onToggleShow={() => setShowAiKey(!showAiKey)}
          hint="Welke provider actief is, stel je in via AI-instellingen. Bewaar hier de sleutels per aanbieder."
        />
        <IntegrationActionBar>
          <Button
            variant="outline"
            size="sm"
            disabled={testMutation.isPending || (!configured && !keyValue.trim())}
            onClick={() => {
              testMutation.reset();
              testMutation.mutate();
            }}
          >
            {testMutation.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Zap className="mr-2 h-3 w-3" />}
            Test verbinding
          </Button>
          {configured ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={removeSettings.isPending}
              onClick={() =>
                requestRemoveSetting({
                  title: `${option.label} API-sleutel verwijderen?`,
                  description: `De opgeslagen ${option.label}-sleutel wordt permanent gewist.`,
                  keys: [AI_PROVIDER_SETTING_KEYS[provider]],
                  onCleared: () => {
                    setKeyValue("");
                    if (provider === "openai") setOpenaiConfigured(false);
                    else if (provider === "deepseek") setDeepseekConfigured(false);
                    else setAnthropicConfigured(false);
                    testMutation.reset();
                  },
                })
              }
            >
              <Trash2 className="mr-2 h-3 w-3" />
              Sleutel verwijderen
            </Button>
          ) : null}
        </IntegrationActionBar>
        <TestResult
          result={testMutation.data?.message ?? (testMutation.error ? formatTrpcErrorMessage(testMutation.error.message) : null)}
          isError={testMutation.isError}
        />
      </IntegrationPanel>
    );
  }

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
      const smtpPassRaw = readSettingString(settings, "email.smtp_pass");
      const imapPassRaw = readSettingString(settings, "email.imap_pass");

      setGooglePlacesConfigured(Boolean(googleKeyRaw));
      setGoogleOAuthSecretConfigured(Boolean(googleOAuthSecretRaw));
      setMetaAppSecretConfigured(Boolean(metaAppSecretRaw));
      setAnthropicConfigured(Boolean(anthropicKeyRaw));
      setOpenaiConfigured(Boolean(openaiKeyRaw));
      setDeepseekConfigured(Boolean(deepseekKeyRaw));

      setGooglePlacesKey(googleKeyRaw === SECRET_MASK ? "" : googleKeyRaw);
      const googleServicePrivateKeyRaw = readSettingString(settings, "bookings.google_service_account_private_key");

      setGoogleOAuthClientId(readSettingString(settings, "integrations.google_oauth_client_id"));
      setGoogleOAuthClientSecret(googleOAuthSecretRaw === SECRET_MASK ? "" : googleOAuthSecretRaw);
      setGoogleOauthEmail(readSettingString(settings, "bookings.google_oauth_account_email"));
      setGoogleServiceAccountEmail(readSettingString(settings, "bookings.google_service_account_email"));
      setGoogleServicePrivateKeyConfigured(Boolean(googleServicePrivateKeyRaw));
      setGoogleServicePrivateKey(googleServicePrivateKeyRaw === SECRET_MASK ? "" : googleServicePrivateKeyRaw);
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

  function handleSaveGooglePlaces() {
    batchUpdate.mutate([{ key: "api.google_places_key", value: googlePlacesKey.trim() }]);
  }

  function handleSaveGoogleOAuth() {
    batchUpdate.mutate([
      { key: "integrations.google_oauth_client_id", value: googleOAuthClientId.trim() },
      { key: "integrations.google_oauth_client_secret", value: googleOAuthClientSecret },
    ]);
  }

  function handleSaveGoogleCalendarServiceAccount() {
    batchUpdate.mutate([
      { key: "bookings.google_service_account_email", value: googleServiceAccountEmail.trim() },
      { key: "bookings.google_service_account_private_key", value: googleServicePrivateKey },
    ]);
  }

  function handleSaveMeta() {
    batchUpdate.mutate([
      { key: "integrations.meta_app_id", value: metaAppId.trim() },
      { key: "integrations.meta_app_secret", value: metaAppSecret },
      { key: "social.autopost_enabled", value: String(socialAutopostEnabled) },
      { key: "ads.autoads_enabled", value: String(adsAutoadsEnabled) },
      { key: "ads.default_currency", value: adsDefaultCurrency.trim().toUpperCase() || "EUR" },
      { key: "ads.max_daily_budget_cents", value: adsMaxDailyBudgetCents.trim() || "5000" },
    ]);
  }

  function handleSaveAiProvider(provider: AiProviderId) {
    const key = AI_PROVIDER_SETTING_KEYS[provider];
    const value =
      provider === "openai" ? openaiKey.trim() : provider === "deepseek" ? deepseekKey.trim() : anthropicKey.trim();
    batchUpdate.mutate([{ key, value }]);
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

  if (sessionStatus === "loading" || (canManageWorkspaceIntegrations && isLoading)) {
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
          <h1 className="app-page-title">Integraties &amp; API-sleutels</h1>
          <p className="app-page-subtitle">
            {canManageWorkspaceIntegrations
              ? "Koppel externe diensten per integratie — elke API heeft een eigen tab."
              : "Beheer je persoonlijke MuAPI-sleutel voor Creative Studio en Social Planner."}
          </p>
        </div>
      </div>

      <div className="integrations-mobile-nav" role="tablist" aria-label="Integraties (mobiel)">
        {integrationNavItems.map((item) => {
          const Icon = item.icon;
          const active = integrationsTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectIntegrationsTab(item.id as IntegrationTabId)}
              className={`integrations-mobile-nav-btn ${active ? "integrations-mobile-nav-btn-active" : ""}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="integrations-shell">
        <IntegrationNav
          items={integrationNavItems}
          activeId={integrationsTab}
          onSelect={(id) => selectIntegrationsTab(id as IntegrationTabId)}
        />

        <div className="min-w-0 space-y-4">
        {integrationsTab === "overview" ? (
          <div className="space-y-4">
            <Card className="border-border/60 bg-gradient-to-br from-card via-card to-muted/20">
              <CardHeader>
                <CardTitle className="text-base">Overzicht werkruimte-integraties</CardTitle>
                <CardDescription>
                  Controleer in één oogopslag welke koppelingen actief zijn. Klik een kaart om direct naar de juiste tab te gaan.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="integrations-overview-grid">
                  {integrationNavItems
                    .filter((item) => item.id !== "overview")
                    .map((item) => (
                      <IntegrationOverviewCard
                        key={item.id}
                        icon={item.icon}
                        title={item.label}
                        description={item.description ?? ""}
                        configured={item.configured}
                        dirty={item.dirty}
                        onOpen={() => selectIntegrationsTab(item.id as IntegrationTabId)}
                      />
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {integrationsTab === "google-places" ? (
          <IntegrationPanel
            icon={Globe}
            iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-300"
            title="Google Places API"
            description={
              <>
                Voor bedrijfszoekopdrachten via Google Maps. Schakel eerst{" "}
                <a
                  href="https://console.cloud.google.com/apis/library/places.googleapis.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Places API (New)
                </a>{" "}
                in, maak daarna een API-sleutel (AIza…) via{" "}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Credentials
                </a>
                . Gebruik geen OAuth Client ID.
              </>
            }
            configured={googlePlacesConfiguredActive}
            footer={
              <IntegrationActionBar>
                <Button size="sm" onClick={handleSaveGooglePlaces} disabled={batchUpdate.isPending || !googlePlacesDirty}>
                  {batchUpdate.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
                  Opslaan
                </Button>
              </IntegrationActionBar>
            }
          >
            <SecretKeyField
              label="API-sleutel"
              value={googlePlacesKey}
              onChange={setGooglePlacesKey}
              placeholder={googlePlacesConfigured ? "Nieuwe sleutel om te vervangen" : "AIza…"}
              show={showGoogleKey}
              onToggleShow={() => setShowGoogleKey(!showGoogleKey)}
            />
            <IntegrationActionBar>
              <Button
                variant="outline"
                size="sm"
                disabled={testGoogle.isPending || (!googlePlacesConfigured && !googlePlacesKey.trim())}
                onClick={() => {
                  testGoogle.reset();
                  testGoogle.mutate({ apiKey: googlePlacesKey.trim() || undefined });
                }}
              >
                {testGoogle.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Zap className="mr-2 h-3 w-3" />}
                Test verbinding
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
                      title: "Google Places API-sleutel verwijderen?",
                      description:
                        "De opgeslagen sleutel wordt permanent gewist. Zoeken via Google Places werkt daarna niet meer tot je een nieuwe sleutel invult.",
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
                  Sleutel verwijderen
                </Button>
              ) : null}
            </IntegrationActionBar>
            <TestResult
              result={
                testGoogle.data?.message ?? (testGoogle.error ? formatTrpcErrorMessage(testGoogle.error.message) : null)
              }
              isError={testGoogle.isError}
            />
          </IntegrationPanel>
        ) : null}

        {integrationsTab === "muapi" ? <MuapiIntegrationPanel /> : null}

        {integrationsTab === "anthropic" ? renderAiProviderPanel("anthropic") : null}
        {integrationsTab === "openai" ? renderAiProviderPanel("openai") : null}
        {integrationsTab === "deepseek" ? renderAiProviderPanel("deepseek") : null}

        {integrationsTab === "google-oauth" ? (
          <>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10">
                  <CalendarDays className="h-5 w-5 text-sky-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Google OAuth-credentials</CardTitle>
                  <CardDescription className="text-xs">
                    Workspace Google-app voor Agenda, Meet en Google Ads. Sla client ID en secret op voordat je koppelingen activeert.
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
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-2">
                <p>
                  Calendar redirect:{" "}
                  <span className="font-mono text-foreground">
                    {getAppUrl().replace(/\/$/, "")}/api/integrations/google-calendar/callback
                  </span>
                </p>
                <p>
                  Google Ads redirect:{" "}
                  <span className="font-mono text-foreground">
                    {getAppUrl().replace(/\/$/, "")}/api/integrations/google-ads/callback
                  </span>
                </p>
                <span className="block text-muted-foreground">
                  Voeg scope <span className="font-mono">https://www.googleapis.com/auth/adwords</span> toe aan de consent screen.
                  Zet <span className="font-mono">GOOGLE_ADS_DEVELOPER_TOKEN</span> in Vercel.
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
                <span className="text-muted-foreground">Google Ads:</span>
                {googleAdsConnection.data?.connected ? (
                  <Badge variant="success">{googleAdsConnection.data.accountEmail || "Gekoppeld"}</Badge>
                ) : (
                  <Badge variant="secondary">Niet gekoppeld</Badge>
                )}
                <Button variant={googleAdsConnection.data?.connected ? "outline" : "default"} size="sm" asChild disabled={!googleOAuthConfigured}>
                  <a href="/api/integrations/google-ads/connect">
                    {googleAdsConnection.data?.connected ? "Opnieuw koppelen" : "Google Ads koppelen"}
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/google-ads">Open Google Ads module</Link>
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
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
                        description: "Client ID en secret worden gewist. Agenda- en Ads-koppelingen werken pas weer na nieuwe credentials.",
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
                <Button size="sm" onClick={handleSaveGoogleOAuth} disabled={batchUpdate.isPending || !googleOAuthDirty}>
                  {batchUpdate.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
                  Google OAuth opslaan
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <CalendarDays className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Google Agenda-koppeling</CardTitle>
                  <CardDescription className="text-xs">
                    OAuth voor persoonlijke agenda-sync of service account voor server-side synchronisatie in de boekingswidget.
                  </CardDescription>
                </div>
                {googleCalendarOAuthConnected ? (
                  <Badge variant="success" className="ml-auto"><CheckCircle className="mr-1 h-3 w-3" /> Verbonden</Badge>
                ) : googleServiceAccountConfigured ? (
                  <Badge variant="success" className="ml-auto"><CheckCircle className="mr-1 h-3 w-3" /> Service account</Badge>
                ) : (
                  <Badge variant="secondary" className="ml-auto"><XCircle className="mr-1 h-3 w-3" /> Niet gekoppeld</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="settings-connect-card">
                  <div className="h-1 bg-gradient-to-r from-blue-500/85 via-blue-500/30 to-transparent" />
                  <div className="settings-connect-card-body space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <div className="settings-connect-card-icon bg-blue-500/10 text-blue-600 ring-blue-500/20 dark:text-blue-400">
                          <Globe2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold tracking-tight">OAuth koppeling</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Inloggen met Google en automatische agenda-sync voor afspraken.
                          </p>
                        </div>
                      </div>
                    </div>
                    {googleOauthEmail ? (
                      <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-xs text-muted-foreground">
                        Actief als <span className="font-medium text-foreground">{googleOauthEmail}</span>
                      </p>
                    ) : null}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Button type="button" className="shadow-sm sm:flex-1" asChild disabled={!googleOAuthConfigured}>
                        <a href="/api/integrations/google-calendar/connect">
                          <Globe2 className="mr-2 h-4 w-4" />
                          {googleOauthEmail ? "Opnieuw verbinden" : "Verbind met Google"}
                        </a>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => testGoogleSync.mutate()}
                        disabled={testGoogleSync.isPending || (!googleCalendarOAuthConnected && !googleServiceAccountConfigured)}
                        className="sm:shrink-0"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {testGoogleSync.isPending ? "Testen..." : "Test sync"}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="settings-connect-card">
                  <div className="h-1 bg-gradient-to-r from-violet-500/85 via-violet-500/30 to-transparent" />
                  <div className="settings-connect-card-body">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <div className="settings-connect-card-icon bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-400">
                          <Settings2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold tracking-tight">Service account</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Alternatief voor teams: koppel via service account credentials.
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={googleServiceAccountConfigured ? "success" : "secondary"}
                        className="shrink-0 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
                      >
                        {googleServiceAccountConfigured ? "Ingevuld" : "Optioneel"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Service account e-mail</Label>
                <Input
                  value={googleServiceAccountEmail}
                  onChange={(event) => setGoogleServiceAccountEmail(event.target.value)}
                  placeholder="digitify-bookings@project.iam.gserviceaccount.com"
                />
              </div>
              <SecretKeyField
                label="Service account private key"
                value={googleServicePrivateKey}
                onChange={setGoogleServicePrivateKey}
                placeholder={googleServicePrivateKeyConfigured ? "Nieuwe key om te vervangen" : "-----BEGIN PRIVATE KEY-----"}
                show={showGoogleServicePrivateKey}
                onToggleShow={() => setShowGoogleServicePrivateKey(!showGoogleServicePrivateKey)}
                hint="JSON key of PEM private key uit Google Cloud Console."
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/settings/bookings#google-agenda">
                    <CalendarDays className="mr-2 h-3.5 w-3.5" />
                    Boekingswidget & tijdzone
                  </Link>
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveGoogleCalendarServiceAccount}
                  disabled={batchUpdate.isPending || !googleCalendarDirty}
                >
                  {batchUpdate.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
                  Service account opslaan
                </Button>
              </div>
              <TestResult
                result={
                  testGoogleSync.data
                    ? testGoogleSync.data.enabled
                      ? `Google sync OK. ${testGoogleSync.data.upcomingGoogleEvents} afspraak(en) komende 7 dagen. Huidig slot: ${testGoogleSync.data.available ? "vrij" : "bezet"}.`
                      : "Google sync staat nog uit. Koppel Google Agenda en activeer synchronisatie."
                    : testGoogleSync.error
                      ? formatTrpcErrorMessage(testGoogleSync.error.message)
                      : null
                }
                isError={testGoogleSync.isError}
              />
            </CardContent>
          </Card>
          </>
        ) : null}

        {integrationsTab === "meta" ? (
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
                  metaConnection.data.missingPublishScopes?.length ? (
                    <Badge variant="warning"><AlertCircle className="mr-1 h-3 w-3" /> Rechten ontbreken</Badge>
                  ) : (
                    <Badge variant="success"><CheckCircle className="mr-1 h-3 w-3" /> Klaar om te posten</Badge>
                  )
                ) : metaConfigured ? (
                  <Badge variant="secondary"><AlertCircle className="mr-1 h-3 w-3" /> App klaar, nog koppelen</Badge>
                ) : (
                  <Badge variant="secondary"><XCircle className="mr-1 h-3 w-3" /> Setup nodig</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              {metaConnection.data?.connected && metaConnection.data.missingPublishScopes?.length ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-100">
                  <p className="font-semibold">Meta publishing-rechten ontbreken op dit token</p>
                  <p className="mt-2 text-xs leading-relaxed">
                    Ontbrekend:{" "}
                    <span className="font-mono">{metaConnection.data.missingPublishScopes.join(", ")}</span>.
                    {metaConnection.data.grantedTokenScopes?.length ? (
                      <>
                        {" "}
                        Huidig token heeft:{" "}
                        <span className="font-mono">{metaConnection.data.grantedTokenScopes.join(", ")}</span>.
                      </>
                    ) : null}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed">
                    Zet je Meta-app op <strong>Live</strong>, voeg de permissions toe onder{" "}
                    <strong>Facebook Login for Business</strong>, en klik hieronder op{" "}
                    <strong>Opnieuw koppelen (rechten)</strong>.
                  </p>
                  <Button size="sm" className="mt-3" asChild>
                    <a href="/api/integrations/meta/connect?reconnect=1">Opnieuw koppelen (rechten)</a>
                  </Button>
                </div>
              ) : null}
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

              <div className="rounded-xl border bg-muted/20 p-4 text-sm leading-relaxed">
                <p className="font-semibold text-foreground">Stap-voor-stap: Meta-app instellen</p>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
                  <li>
                    Ga naar{" "}
                    <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      developers.facebook.com/apps
                    </a>{" "}
                    → jouw app → <strong className="text-foreground">Use cases</strong>.
                  </li>
                  <li>
                    Voeg <strong className="text-foreground">Facebook Login for Business</strong> toe (niet alleen “Instagram API with Instagram Login”).
                  </li>
                  <li>
                    Bij die use case → <strong className="text-foreground">Customize</strong> → permissions:
                    <span className="font-mono"> pages_show_list</span>,
                    <span className="font-mono"> instagram_basic</span>,
                    <span className="font-mono"> instagram_content_publish</span>.
                    Optioneel (Facebook-posts): <span className="font-mono">pages_read_engagement</span>,{" "}
                    <span className="font-mono">pages_manage_posts</span>.
                  </li>
                  <li>
                    <strong className="text-foreground">Verwijder</strong> uit je app-configuratie:
                    <span className="font-mono"> instagram_business_basic</span> en{" "}
                    <span className="font-mono"> instagram_business_content_publish</span> — die horen bij een ander product.
                  </li>
                  <li>
                    <strong className="text-foreground">App mode → Live</strong>: App settings → Basic → zet de app op{" "}
                    <strong className="text-foreground">Live</strong> (niet Development). Zonder Live mode faalt Meta Ads creative/push met subcode{" "}
                    <span className="font-mono">1885183</span>.
                  </li>
                  <li>
                    <strong className="text-foreground">App roles</strong>: zet <span className="font-mono">productiongiga@gmail.com</span> als Admin/Developer/Tester.
                  </li>
                  <li>
                    Koppel in Meta Business Suite een <strong className="text-foreground">Facebook-pagina</strong> aan je{" "}
                    <strong className="text-foreground">Instagram Business/Creator</strong>-account.
                  </li>
                  <li>
                    Plak hierboven App ID + Secret, sla op, en klik <strong className="text-foreground">Meta koppelen</strong> (niet alleen de tester in het Meta-dashboard).
                  </li>
                </ol>
              </div>

              <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-xs leading-relaxed text-sky-950 dark:text-sky-100">
                <p className="font-semibold">Scopes die deze server nu gebruikt</p>
                <p className="mt-1 font-mono break-all">
                  {metaConnection.data?.oauthScopes?.join(", ") ||
                    "pages_show_list, pages_read_engagement, pages_manage_posts, instagram_basic, instagram_content_publish"}
                </p>
                <p className="mt-2 text-muted-foreground">
                  Login-modus: <span className="font-mono">{metaConnection.data?.oauthLoginMode || "facebook"}</span>
                  {" · "}
                  Niveau: <span className="font-mono">{metaConnection.data?.oauthScopeLevel || "standard"}</span>
                </p>
                {metaConnection.data?.oauthUsesLegacyEnvOverride ? (
                  <p className="mt-2 font-semibold text-amber-800 dark:text-amber-200">
                    Vercel heeft nog META_OAUTH_SCOPES met oude instagram_business_* waarden. Verwijder die variabele of deploy opnieuw.
                  </p>
                ) : null}
                {metaConnection.data?.oauthHasDeprecatedScopes ? (
                  <p className="mt-2 font-semibold text-amber-800 dark:text-amber-200">
                    Er staan nog instagram_business_* scopes actief. Die veroorzaken “Invalid Scopes”.
                  </p>
                ) : null}
                <p className="mt-2">
                  Technische check (ingelogd als admin):{" "}
                  <a href="/api/integrations/meta/scopes" target="_blank" rel="noopener noreferrer" className="font-mono text-primary hover:underline">
                    /api/integrations/meta/scopes
                  </a>
                </p>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-900 dark:text-amber-100">
                <p className="font-semibold">Fout bevat nog instagram_business_* of pages_manage_posts?</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>
                    Zie je <span className="font-mono">instagram_business_basic</span> in de fout? Dan draait productie nog oude code of{" "}
                    <span className="font-mono">META_OAUTH_SCOPES</span> in Vercel is verkeerd — verwijder die env var en redeploy.
                  </li>
                  <li>
                    Alleen <span className="font-mono">pages_manage_posts</span> invalid? Zet in Vercel tijdelijk{" "}
                    <span className="font-mono">META_OAUTH_SCOPE_LEVEL=minimal</span> en voeg later Pages-permissions toe in Meta Use cases.
                  </li>
                  <li>
                    Test in Meta “Publication hub”? Die gebruikt permissions uit je Meta-app, niet automatisch Digitify. Pas Use cases aan (stap 2–4 hierboven).
                  </li>
                  <li>
                    Fout <span className="font-mono">development mode</span> / subcode <span className="font-mono">1885183</span>? Zet de Meta-app op{" "}
                    <strong>Live</strong> (zie stap “App mode → Live” hierboven), wacht 1–2 min, koppel Meta opnieuw in Integraties, en probeer Push opnieuw.
                  </li>
                </ul>
                {metaAdsConnection.data?.missingConfiguredScopes?.length ? (
                  <p className="mt-2 font-semibold">
                    Meta Ads mist scopes: <span className="font-mono">{metaAdsConnection.data.missingConfiguredScopes.join(", ")}</span>.
                    Zet <span className="font-mono">META_OAUTH_INCLUDE_ADS=true</span> en koppel opnieuw.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant={metaConnection.data?.connected ? "outline" : "default"} size="sm" asChild disabled={!metaConfigured}>
                  <a href={metaConnection.data?.connected ? "/api/integrations/meta/connect?reconnect=1" : "/api/integrations/meta/connect"}>
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
                  <Button size="sm" onClick={handleSaveMeta} disabled={batchUpdate.isPending || !metaDirty}>
                    {batchUpdate.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
                    Meta instellingen opslaan
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {integrationsTab === "smtp" ? (
        <>
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
        </>
        ) : null}

        {integrationsTab === "imap" ? (
        <>
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
        </>
        ) : null}

        </div>
      </div>
    </div>
  );
}
