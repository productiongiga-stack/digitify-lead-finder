"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { getAppUrl } from "@/lib/config";
import {
  Button, Badge, Card, CardContent, CardHeader, CardTitle,
  Textarea, Skeleton, Progress, Separator, ScrollArea,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@digitify/ui";
import {
  ArrowLeft, Globe, Phone, Mail, MapPin, Star, ExternalLink,
  Clock, Plus, Pin, Loader2, Zap, Bot, Search, RefreshCw,
  CheckCircle, XCircle, AlertTriangle, Edit, Send, Shield,
  Smartphone, FileText, BarChart3, Lightbulb, Target, TrendingUp,
  Calendar, User, Tag, Megaphone, X, Hash, Activity,
  Facebook, Instagram, Linkedin, Twitter, ChevronRight,
  Lock, Unlock, Eye, CircleDot, Receipt, type LucideIcon,
} from "lucide-react";
import {
  cn, formatScore, getStatusBadgeVariant, formatDate, formatRelativeTime, getScoreColor, safeExternalUrl,
} from "@/lib/utils";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_OPTIONS,
} from "@/lib/lead-status";
import { useUIStore } from "@/stores/ui-store";

/* ---------- helpers ---------- */

const CATEGORY_LABELS: Record<string, string> = {
  web_presence: "Webpresence",
  reputation: "Reputatie",
  social: "Sociaal",
  freshness: "Actualiteit",
};

const CATEGORY_ORDER = ["web_presence", "reputation", "social", "freshness"];

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  LEAD_CREATED: Plus,
  LEAD_UPDATED: Edit,
  LEAD_STATUS_CHANGED: RefreshCw,
  LEAD_SCORED: Zap,
  LEAD_ENRICHED: Search,
  LEAD_ASSIGNED: User,
  NOTE_ADDED: FileText,
  EMAIL_DRAFTED: Send,
  EMAIL_APPROVED: CheckCircle,
  EMAIL_SENT: Send,
  EMAIL_OPENED: Eye,
  EMAIL_REPLIED: Mail,
  OPENCLAW_SUGGESTION: Bot,
  SEARCH_PERFORMED: Search,
  CAMPAIGN_CREATED: Megaphone,
  REPORT_GENERATED: BarChart3,
};

const STATUS_OPTIONS = LEAD_STATUS_OPTIONS.map((option) => option.value);
const STATUS_LABELS = LEAD_STATUS_LABELS;

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function ScoreRing({ score, size = 96 }: { score: number | null | undefined; size?: number }) {
  const s = score ?? 0;
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (s / 100) * circumference;
  const color = s >= 80 ? "#dc2626" : s >= 60 ? "#d97706" : s >= 40 ? "#2563eb" : "#64748b";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={6} className="text-muted/20" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-700" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold" style={{ color }}>{formatScore(score)}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Score</span>
      </div>
    </div>
  );
}

function AuditItem({ label, value }: { label: string; value: boolean | null | undefined }) {
  const isTrue = value === true;
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      {isTrue ? (
        <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-red-500" />
      )}
      <span className="text-sm">{label}</span>
    </div>
  );
}

/* ---------- main page ---------- */

export default function LeadDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const leadId = (Array.isArray(params.id) ? params.id[0] : params.id) ?? "";
  const id = leadId;
  const router = useRouter();
  const { data: leadData, isError: leadIsError, isFetching, isLoading } = trpc.lead.getById.useQuery(
    { id: leadId },
    {
      enabled: Boolean(leadId),
      refetchOnMount: "always",
      refetchOnReconnect: true,
      staleTime: 0,
    }
  );
  const duplicateQuery = trpc.lead.findDuplicates.useQuery(
    { leadId },
    { enabled: Boolean(leadId) }
  );
  const explainValueQuery = trpc.lead.explainValue.useQuery(
    { leadId },
    { enabled: false, staleTime: 120_000 },
  );
  const { data: allTags } = trpc.tag.list.useQuery();
  const { data: pipelineStages } = trpc.pipeline.getStages.useQuery();
  const [noteText, setNoteText] = useState("");
  const utils = trpc.useUtils();
  const { setOpenClawOpen } = useUIStore();

  /* mutations */
  const addNote = trpc.lead.addNote.useMutation({
    onSuccess: () => { setNoteText(""); utils.lead.getById.invalidate({ id: leadId }); },
  });
  const enrichLead = trpc.scoring.enrichLead.useMutation({
    onSuccess: () => utils.lead.getById.invalidate({ id: leadId }),
  });
  const computeScore = trpc.scoring.computeForLead.useMutation({
    onSuccess: () => utils.lead.getById.invalidate({ id: leadId }),
  });
  const analyzeLead = trpc.openclaw.analyzeLead.useMutation({
    onSuccess: () => utils.lead.getById.invalidate({ id: leadId }),
  });
  const draftEmail = trpc.openclaw.draftEmail.useMutation({
    onSuccess: (data) => {
      utils.lead.getById.invalidate({ id: leadId });
      if (data?.draft?.id) {
        router.push(`/contacts/drafts/${data.draft.id}`);
      }
    },
  });
  const updateLead = trpc.lead.update.useMutation({
    onSuccess: () => utils.lead.getById.invalidate({ id: leadId }),
  });
  const addTag = trpc.tag.addToLead.useMutation({
    onSuccess: () => utils.lead.getById.invalidate({ id: leadId }),
  });
  const removeTag = trpc.tag.removeFromLead.useMutation({
    onSuccess: () => utils.lead.getById.invalidate({ id: leadId }),
  });
  const generateReport = trpc.report.generateLeadReport.useMutation({
    onSuccess: (data) => {
      window.open(`/reports/${data.id}/print`, "_blank");
    },
  });

  /* loading skeleton */
  if (isLoading || isFetching) {
    return (
      <div className="space-y-5 p-1">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-72" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-24 w-24 rounded-full" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="space-y-5">
            <Skeleton className="h-64" />
            <Skeleton className="h-80" />
            <Skeleton className="h-48" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!id || (leadIsError && !leadData) || (!isLoading && !isFetching && !leadData)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-medium">Lead niet gevonden</p>
          <Link href="/leads"><Button variant="outline" className="mt-4">Terug naar leads</Button></Link>
        </div>
      </div>
    );
  }

  /* derived data */
  const lead = leadData!;
  const scoreFactors = lead.scoringFactors ?? [];
  type ScoreFactor = (typeof scoreFactors)[number];
  type LeadActivity = (typeof lead.activities)[number];
  type LeadTag = (typeof lead.tags)[number];
  type LeadNote = (typeof lead.notes)[number];
  type CampaignLead = (typeof lead.campaignLeads)[number];
  type EmailDraft = (typeof lead.emailDrafts)[number];

  type WebsiteAnalysis = {
    hasSSL?: boolean; isMobileFriendly?: boolean; loadTimeMs?: number;
    hasMetaTitle?: boolean; hasMetaDescription?: boolean; hasH1?: boolean;
    hasStructuredData?: boolean; hasFavicon?: boolean; hasAnalytics?: boolean;
    hasCTA?: boolean; contentLength?: number; lastModified?: string | null;
    contactFormFound?: boolean;
    technologies?: string[];
  };
  type EnrichmentRow = { data?: { website_analysis?: WebsiteAnalysis }; fetchedAt?: string | Date };
  type OpenClawSuggestion = { id?: string; type: string; title?: string; content?: string; metadata?: Record<string, unknown>; [k: string]: unknown };
  type ScoringMeta = { bestNextAction?: string; suggestedServices?: string[]; painPoints?: string[] };

  const enrichmentRow = (lead.enrichmentData as EnrichmentRow[] | undefined)?.[0];
  const wa = enrichmentRow?.data?.website_analysis;
  const hasEnrichment = !!wa;

  const factorsByCategory: Record<string, typeof scoreFactors> = {};
  scoreFactors.forEach((f: ScoreFactor) => {
    const cat = f.scoringWeight?.category ?? "other";
    if (!factorsByCategory[cat]) factorsByCategory[cat] = [];
    factorsByCategory[cat].push(f);
  });

  const openclawSuggestions = (lead.openclawSuggestions as OpenClawSuggestion[] | undefined) ?? [];
  const latestAnalysis = openclawSuggestions.find((s) => s.type === "OPPORTUNITY_ANALYSIS");
  const analysisMetadata = latestAnalysis?.metadata as Record<string, unknown> | undefined;
  const scoringActivity = lead.activities.find(
    (a: LeadActivity) => a.type === "LEAD_SCORED" && (a.metadata as ScoringMeta)?.bestNextAction
  );
  const scoringMeta = scoringActivity?.metadata as ScoringMeta | undefined;
  const suggestedServices = scoringMeta?.suggestedServices ?? [];
  const confidence = readNumber(analysisMetadata?.confidence);
  const opportunities = readStringArray(analysisMetadata?.opportunities);
  const risks = readStringArray(analysisMetadata?.risks);
  const suggestedApproach = readString(analysisMetadata?.suggestedApproach);
  const technologies = wa?.technologies ?? [];

  const leadTagIds = new Set(lead.tags.map((lt: LeadTag) => lt.tag.id));
  const availableTags = allTags?.filter((t: NonNullable<typeof allTags>[number]) => !leadTagIds.has(t.id)) ?? [];
  const primaryDomain = lead.domains?.[0];
  const highImpactFactorCount = scoreFactors.filter((factor: ScoreFactor) => factor.rawValue >= 7).length;
  const lowFactorCount = scoreFactors.filter((factor: ScoreFactor) => factor.rawValue <= 4).length;
  const contactCoverage = Math.round(
    (lead.email ? 40 : 0) + (lead.phone ? 35 : 0) + (lead.website ? 25 : 0)
  );
  const reviewRisk = (() => {
    let risk = 45;
    if (lead.gmbRating != null) {
      if (lead.gmbRating < 3.5) risk += 30;
      else if (lead.gmbRating < 4.2) risk += 15;
      else risk -= 10;
    } else {
      risk += 15;
    }
    if (lead.gmbReviewCount != null && lead.gmbReviewCount < 10) risk += 10;
    return Math.max(0, Math.min(100, Math.round(risk)));
  })();

  const address = [lead.address, lead.zipCode, lead.city, lead.country].filter(Boolean).join(", ");
  const gmapsUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="app-page">
        {/* ===== HEADER ===== */}
        <div className="app-page-header">
          <Link href="/leads">
            <Button variant="ghost" size="icon" className="shrink-0 rounded-xl">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="app-page-title">{lead.companyName}</h1>
              {lead.industry && <Badge variant="outline" className="font-normal">{lead.industry}</Badge>}
              <Badge variant={getStatusBadgeVariant(lead.status)}>{STATUS_LABELS[lead.status] ?? lead.status}</Badge>
              {lead.scorePriority && (
                <Badge variant={lead.scorePriority === "Hot" ? "destructive" : lead.scorePriority === "Warm" ? "warning" : "secondary"}>
                  {lead.scorePriority === "Hot" ? "🔥 Hot" : lead.scorePriority === "Warm" ? "🌡️ Warm" : "❄️ Low"}
                </Badge>
              )}
              {lead.doNotContact && (
                <Badge variant="destructive" className="gap-1">
                  <Shield className="h-3 w-3" /> Niet contacteren
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {[lead.city, lead.country].filter(Boolean).join(", ")}
              {safeExternalUrl(lead.website) && (
                <>
                  {" · "}
                  <a href={safeExternalUrl(lead.website)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    {lead.website!.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
            </p>

            {/* Quick Actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/leads/${id}/edit`}>
                <Button variant="outline" size="sm">
                  <Edit className="mr-1.5 h-3.5 w-3.5" /> Bewerken
                </Button>
              </Link>
              <Button
                variant="outline" size="sm"
                onClick={() => enrichLead.mutate({ leadId: id })}
                disabled={enrichLead.isPending}
              >
                {enrichLead.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1.5 h-3.5 w-3.5" />}
                {enrichLead.isPending ? "Analyseren..." : "Enrich & Score"}
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => analyzeLead.mutate({ leadId: id })}
                disabled={analyzeLead.isPending}
              >
                {analyzeLead.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Bot className="mr-1.5 h-3.5 w-3.5" />}
                {analyzeLead.isPending ? "Analyseren..." : "AI Analyse"}
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => draftEmail.mutate({ leadId: id })}
                disabled={draftEmail.isPending}
              >
                {draftEmail.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                {draftEmail.isPending ? "Genereren..." : "E-mail Draft"}
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => generateReport.mutate({ leadId: id })}
                disabled={generateReport.isPending}
              >
                {generateReport.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
                {generateReport.isPending ? "Genereren..." : "Genereer Voorstel"}
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/quotes/new?leadId=${id}`}>
                  <Receipt className="mr-1.5 h-3.5 w-3.5" />
                  Maak Offerte
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => explainValueQuery.refetch()}
                disabled={explainValueQuery.isFetching}
              >
                {explainValueQuery.isFetching ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="mr-1.5 h-3.5 w-3.5" />}
                Waarom waardevol?
              </Button>
              {primaryDomain ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      `<script async src="${getAppUrl()}/tracker.js?domain=${primaryDomain.id}"></script>`
                    )
                  }
                >
                  <Activity className="mr-1.5 h-3.5 w-3.5" />
                  Kopieer Tracker
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => setOpenClawOpen(true)}>
                <Bot className="mr-1.5 h-3.5 w-3.5" /> OpenClaw
              </Button>
            </div>
          </div>

          {/* Score Ring */}
          <div className="shrink-0 self-center sm:self-start">
            <ScoreRing score={lead.overallScore} size={100} />
          </div>
        </div>

        {/* ===== 2-COLUMN LAYOUT ===== */}
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">

          {/* ===== LEFT COLUMN ===== */}
          <div className="space-y-5">

            {explainValueQuery.data ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    AI Waarde-uitleg
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{explainValueQuery.data.explanation}</p>
                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {explainValueQuery.data.bullets.map((item: string) => (
                      <li key={item} className="flex items-start gap-2">
                        <CircleDot className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}

            {duplicateQuery.data && duplicateQuery.data.length > 0 ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="h-4 w-4 text-amber-500" />
                    Mogelijke duplicaten
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {duplicateQuery.data.slice(0, 5).map((item) => (
                    <div key={item.id} className="rounded-lg border p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/leads/${item.id}`} className="text-sm font-medium hover:text-primary">
                          {item.companyName}
                        </Link>
                        <Badge variant="outline">{Math.round(item.confidence * 100)}%</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{item.reasons.join(" · ") || "Naamovereenkomst"}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {/* --- Opportunity Score Card --- */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-4 w-4 text-primary" />
                    Opportunity Score
                  </CardTitle>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => computeScore.mutate({ leadId: id })}
                    disabled={computeScore.isPending}
                  >
                    {computeScore.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                    Herbereken
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {scoreFactors.length === 0 ? (
                  <div className="py-8 text-center">
                    <Zap className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground mb-3">Nog geen score berekend</p>
                    <Button size="sm" onClick={() => enrichLead.mutate({ leadId: id })} disabled={enrichLead.isPending}>
                      {enrichLead.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-1.5 h-3.5 w-3.5" />}
                      Website analyseren & scoren
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Score by category */}
                    {CATEGORY_ORDER.map((cat) => {
                      const factors = factorsByCategory[cat];
                      if (!factors?.length) return null;
                      return (
                        <div key={cat}>
                          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {CATEGORY_LABELS[cat] ?? cat}
                          </h4>
                          <div className="space-y-3">
                            {factors.map((factor: ScoreFactor) => {
                              const max = factor.scoringWeight?.maxPoints ?? 10;
                              const pct = Math.min((factor.rawValue / max) * 100, 100);
                              return (
                                <div key={factor.id} className="space-y-1">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="font-medium">{factor.scoringWeight?.label ?? factor.scoringWeightId}</span>
                                    <span className="tabular-nums text-muted-foreground">
                                      {factor.rawValue.toFixed(1)} / {max}
                                      <span className="ml-1.5 text-xs">
                                        (x{factor.scoringWeight?.weight?.toFixed(1) ?? "1.0"} = {factor.weightedValue.toFixed(1)})
                                      </span>
                                    </span>
                                  </div>
                                  <Progress value={pct} className="h-2" />
                                  {factor.explanation && (
                                    <p className="text-xs text-muted-foreground">{factor.explanation}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* Factors in "other" category */}
                    {factorsByCategory["other"]?.length ? (
                      <div>
                        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overig</h4>
                        <div className="space-y-3">
                          {factorsByCategory["other"].map((factor: ScoreFactor) => {
                            const max = factor.scoringWeight?.maxPoints ?? 10;
                            const pct = Math.min((factor.rawValue / max) * 100, 100);
                            return (
                              <div key={factor.id} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="font-medium">{factor.scoringWeight?.label ?? factor.scoringWeightId}</span>
                                  <span className="tabular-nums text-muted-foreground">
                                    {factor.rawValue.toFixed(1)} / {max}
                                    <span className="ml-1.5 text-xs">
                                      (x{factor.scoringWeight?.weight?.toFixed(1) ?? "1.0"} = {factor.weightedValue.toFixed(1)})
                                    </span>
                                  </span>
                                </div>
                                <Progress value={pct} className="h-2" />
                                {factor.explanation && (
                                  <p className="text-xs text-muted-foreground">{factor.explanation}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg border bg-muted/20 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">High-impact factoren</p>
                        <p className="mt-1 text-lg font-bold">{highImpactFactorCount}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lage factoren</p>
                        <p className="mt-1 text-lg font-bold">{lowFactorCount}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Contact coverage</p>
                        <p className="mt-1 text-lg font-bold">{contactCoverage}%</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Review risk</p>
                        <p className="mt-1 text-lg font-bold">{reviewRisk}%</p>
                      </div>
                    </div>

                    <Separator />

                    {/* Best next action & suggested services */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      {scoringMeta?.bestNextAction && (
                        <div className="rounded-lg border bg-muted/30 p-3">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Beste volgende actie</p>
                          <p className="text-sm font-medium">{scoringMeta?.bestNextAction}</p>
                        </div>
                      )}
                      {suggestedServices.length > 0 && (
                        <div className="rounded-lg border bg-muted/30 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Voorgestelde diensten</p>
                          <div className="flex flex-wrap gap-1">
                            {suggestedServices.map((s: string) => (
                              <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* --- Website Audit Card --- */}
            {hasEnrichment && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Globe className="h-4 w-4 text-primary" />
                      Website Audit
                    </CardTitle>
                    <Badge variant="outline" className="text-xs font-normal">
                      {enrichmentRow?.fetchedAt ? formatDate(enrichmentRow.fetchedAt) : "Onbekend"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                    <AuditItem label="SSL / HTTPS" value={wa.hasSSL} />
                    <AuditItem label="Mobiel vriendelijk" value={wa.isMobileFriendly} />
                    <AuditItem label="Call-to-action" value={wa.hasCTA} />
                    <AuditItem label="Contactformulier" value={wa.contactFormFound ?? false} />
                    <AuditItem label="Analytics geïnstalleerd" value={wa.hasAnalytics} />
                    <AuditItem label="Favicon aanwezig" value={wa.hasFavicon} />
                  </div>

                  <Separator className="my-4" />

                  {/* SEO indicators */}
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">SEO Indicatoren</h4>
                  <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                    <AuditItem label="Meta titel" value={wa.hasMetaTitle} />
                    <AuditItem label="Meta beschrijving" value={wa.hasMetaDescription} />
                    <AuditItem label="H1 tag" value={wa.hasH1} />
                    <AuditItem label="Structured Data" value={wa.hasStructuredData} />
                  </div>

                  <Separator className="my-4" />

                  {/* Performance */}
                  <div className="flex flex-wrap items-center gap-6">
                    {wa.loadTimeMs != null && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={cn("h-4 w-4", wa.loadTimeMs > 3000 ? "text-red-500" : wa.loadTimeMs > 1500 ? "text-amber-500" : "text-emerald-500")} />
                        <span className="text-sm">Laadtijd: <strong>{(wa.loadTimeMs / 1000).toFixed(1)}s</strong></span>
                      </div>
                    )}
                    {wa.contentLength != null && (
                      <div className="text-sm text-muted-foreground">
                        Content: {(wa.contentLength / 1024).toFixed(0)} KB
                      </div>
                    )}
                  </div>

                  {/* Technologies */}
                  {technologies.length > 0 && (
                    <div className="mt-4">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Technologieen</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {technologies.map((tech: string) => (
                          <Badge key={tech} variant="secondary" className="text-xs">{tech}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* --- AI Summary Card --- */}
            {(openclawSuggestions.length > 0 || latestAnalysis) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    AI Analyse
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {latestAnalysis && (
                    <div className="space-y-3">
                      {confidence != null && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Betrouwbaarheid</span>
                          <Badge variant={confidence >= 0.7 ? "success" : confidence >= 0.4 ? "warning" : "secondary"}>
                            {Math.round(confidence * 100)}%
                          </Badge>
                        </div>
                      )}
                      <div>
                        <h4 className="mb-1 text-sm font-semibold">Samenvatting</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">{readString(latestAnalysis.content) || "Geen samenvatting beschikbaar."}</p>
                      </div>
                      {opportunities.length > 0 && (
                        <div>
                          <h4 className="mb-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">Kansen</h4>
                          <ul className="space-y-1">
                            {opportunities.map((o: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                <span>{o}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {risks.length > 0 && (
                        <div>
                          <h4 className="mb-1.5 text-sm font-semibold text-red-600 dark:text-red-400">Risico&apos;s</h4>
                          <ul className="space-y-1">
                            {risks.map((r: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {suggestedApproach && (
                        <div className="rounded-lg border bg-muted/30 p-3">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Voorgestelde aanpak</p>
                          <p className="text-sm">{suggestedApproach}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Other suggestions */}
                  {openclawSuggestions.filter((s) => s.type !== "OPPORTUNITY_ANALYSIS").map((s) => (
                    <div key={s.id || `${s.type}-${readString(s.title) || "suggestion"}`} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{readString(s.title) || "Suggestie"}</span>
                        <Badge variant="outline" className="text-xs">{s.type}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          const preview = readString(s.content) || "Geen extra inhoud beschikbaar.";
                          return `${preview.slice(0, 200)}${preview.length > 200 ? "..." : ""}`;
                        })()}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* --- Google Business --- */}
            {lead.gmbRating != null && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Star className="h-4 w-4 text-amber-500" />
                    Google Business Profile
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
                      <span className="text-3xl font-bold">{lead.gmbRating}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {lead.gmbReviewCount} reviews
                    </div>
                  </div>
                  {(lead.gmbCategories as string[])?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(lead.gmbCategories as string[]).map((cat, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{cat}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* --- Activity Timeline --- */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-primary" />
                  Activiteiten
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lead.activities.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">Nog geen activiteiten</p>
                ) : (
                  <ScrollArea className={lead.activities.length > 8 ? "h-[400px]" : undefined}>
                    <div className="relative space-y-0">
                      {lead.activities.slice(0, 20).map((activity: LeadActivity, idx: number) => {
                        const IconComp = ACTIVITY_ICONS[activity.type] || Clock;
                        const isLast = idx === Math.min(lead.activities.length, 20) - 1;
                        return (
                          <div key={activity.id} className="relative flex gap-3 pb-4">
                            {/* Timeline line */}
                            {!isLast && (
                              <div className="absolute left-[11px] top-[24px] h-[calc(100%-12px)] w-px bg-border" />
                            )}
                            <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-background">
                              <IconComp className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                              <p className="text-sm leading-tight">{activity.title}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {activity.user?.name && <>{activity.user.name} · </>}
                                {formatRelativeTime(activity.createdAt)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* --- Notes Section --- */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-primary" />
                  Notities
                  {lead.notes.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">{lead.notes.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add note form */}
                <div className="space-y-2">
                  <Textarea
                    placeholder="Schrijf een notitie..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="min-h-[80px] resize-none"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={!noteText.trim() || addNote.isPending}
                      onClick={() => addNote.mutate({ leadId: id, content: noteText })}
                    >
                      {addNote.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                      Toevoegen
                    </Button>
                  </div>
                </div>

                {lead.notes.length > 0 && <Separator />}

                {/* Notes list */}
                <div className="space-y-3">
                  {lead.notes.map((note: LeadNote) => (
                    <div key={note.id} className={cn("rounded-lg border p-3", note.isPinned && "border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20")}>
                      {note.isPinned && (
                        <div className="mb-1.5 flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                          <Pin className="h-3 w-3" /> Vastgepind
                        </div>
                      )}
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{note.content}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {note.user?.name} · {formatRelativeTime(note.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ===== RIGHT COLUMN (SIDEBAR) ===== */}
          <div className="space-y-4">

            {/* --- Contact Info Card --- */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-primary" />
                  Contactgegevens
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {lead.email ? (
                  <a href={`mailto:${lead.email}`} className="flex items-center gap-2.5 text-sm text-primary hover:underline">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {lead.email}
                  </a>
                ) : (
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 shrink-0" /> Geen e-mail
                  </div>
                )}
                {lead.phone ? (
                  <a href={`tel:${lead.phone}`} className="flex items-center gap-2.5 text-sm text-primary hover:underline">
                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {lead.phone}
                  </a>
                ) : (
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4 shrink-0" /> Geen telefoon
                  </div>
                )}
                {safeExternalUrl(lead.website) ? (
                  <a href={safeExternalUrl(lead.website)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-sm text-primary hover:underline">
                    <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {lead.website!.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : (
                  <div className="flex items-center gap-2.5 text-sm text-red-500">
                    <Globe className="h-4 w-4 shrink-0" /> Geen website
                  </div>
                )}
                {address && (
                  <div className="flex items-start gap-2.5 text-sm">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <span>{address}</span>
                      {gmapsUrl && (
                        <a href={gmapsUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-primary hover:underline">
                          Google Maps <ExternalLink className="inline h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* --- Social Presence Card --- */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Hash className="h-4 w-4 text-primary" />
                  Sociale Media
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: "Facebook", url: lead.facebookUrl, Icon: Facebook },
                  { label: "Instagram", url: lead.instagramUrl, Icon: Instagram },
                  { label: "LinkedIn", url: lead.linkedinUrl, Icon: Linkedin },
                  { label: "Twitter / X", url: lead.twitterUrl, Icon: Twitter },
                  { label: "TikTok", url: lead.tiktokUrl, Icon: CircleDot },
                  { label: "YouTube", url: lead.youtubeUrl, Icon: CircleDot },
                ].map(({ label, url, Icon }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span>{label}</span>
                    </div>
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">Niet gevonden</span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* --- Tags Card --- */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Tag className="h-4 w-4 text-primary" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {lead.tags.map((lt: LeadTag) => (
                    <Badge
                      key={lt.tag.id}
                      variant="outline"
                      className="gap-1 pr-1"
                      style={{ borderColor: lt.tag.color, color: lt.tag.color }}
                    >
                      {lt.tag.name}
                      <button
                        onClick={() => removeTag.mutate({ leadId: id, tagId: lt.tag.id })}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {lead.tags.length === 0 && (
                    <p className="text-xs text-muted-foreground">Geen tags</p>
                  )}
                </div>
                {availableTags.length > 0 && (
                  <Select onValueChange={(tagId) => addTag.mutate({ leadId: id, tagId })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Tag toevoegen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTags.map((tag: NonNullable<typeof availableTags>[number]) => (
                        <SelectItem key={tag.id} value={tag.id}>
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                            {tag.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>

            {/* --- Pipeline & Status Card --- */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Pipeline & Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Status */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                  <Select
                    value={lead.status}
                    onValueChange={(val) => updateLead.mutate({ id, status: val })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LABELS[s] ?? s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Pipeline stage */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Pipeline fase</label>
                  <Select
                    value={lead.pipelineStageId ?? "none"}
                    onValueChange={(val) => updateLead.mutate({ id, pipelineStageId: val === "none" ? null : val })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Geen fase" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Geen fase</SelectItem>
                      {pipelineStages?.map((stage: NonNullable<typeof pipelineStages>[number]) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                            {stage.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Meta info */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Toegewezen aan</span>
                    <span className="font-medium">{lead.assignedTo?.name ?? "Niet toegewezen"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bron</span>
                    <span>{lead.source ?? "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Aangemaakt</span>
                    <span>{formatDate(lead.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bijgewerkt</span>
                    <span>{formatDate(lead.updatedAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Laatste contact</span>
                    <span>{lead.lastContactedAt ? formatDate(lead.lastContactedAt) : "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Score berekend</span>
                    <span>{lead.scoreComputedAt ? formatDate(lead.scoreComputedAt) : "-"}</span>
                  </div>
                </div>

                {lead.doNotContact && (
                  <>
                    <Separator />
                    <Badge variant="destructive" className="w-full justify-center gap-1.5">
                      <Shield className="h-3.5 w-3.5" /> Niet contacteren
                    </Badge>
                  </>
                )}
              </CardContent>
            </Card>

            {/* --- Campaigns Card --- */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Megaphone className="h-4 w-4 text-primary" />
                  Campagnes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lead.campaignLeads.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Niet in een campagne</p>
                ) : (
                  <div className="space-y-1.5">
                    {lead.campaignLeads.map((cl: CampaignLead) => (
                      <Link
                        key={cl.campaign.id}
                        href={`/campaigns/${cl.campaign.id}`}
                        className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                      >
                        <span>{cl.campaign.name}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* --- Email Drafts Card --- */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Send className="h-4 w-4 text-primary" />
                    E-mail Drafts
                    {lead.emailDrafts.length > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">{lead.emailDrafts.length}</Badge>
                    )}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {lead.emailDrafts.length === 0 ? (
                  <div className="py-2 text-center">
                    <p className="text-xs text-muted-foreground mb-2">Nog geen e-mails</p>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => draftEmail.mutate({ leadId: id })}
                      disabled={draftEmail.isPending}
                    >
                      {draftEmail.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Bot className="mr-1 h-3 w-3" />}
                      AI Draft genereren
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lead.emailDrafts.map((draft: EmailDraft) => (
                      <div key={draft.id} className="rounded-md border p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <Link href={`/contacts/drafts/${draft.id}`} className="text-sm font-medium leading-tight hover:text-primary hover:underline">
                            {draft.subject}
                          </Link>
                          <Badge variant={getStatusBadgeVariant(draft.status)} className="shrink-0 text-[10px]">
                            {draft.status}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">{formatDate(draft.createdAt)}</p>
                          <Link href={`/contacts/drafts/${draft.id}`}>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]">
                              Bewerken & verzenden
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                    <Link href={`/contacts`} className="block">
                      <Button variant="ghost" size="sm" className="w-full text-xs">
                        Alle contacten bekijken <ChevronRight className="ml-1 h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
