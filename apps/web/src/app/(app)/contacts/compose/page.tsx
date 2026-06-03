"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
  Badge,
  Separator,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@digitify/ui";
import {
  Send,
  Save,
  Eye,
  Sparkles,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Info,
  PenSquare,
  ToggleLeft,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { EmailPreview } from "@/components/email/preview";
import { MailVariablesHelp } from "@/components/email/mail-variables-help";
import { MAIL_VARIABLE_REGISTRY, extractMailVariableKeys, findUnknownMailVariables } from "@/lib/mail-variables";
import { extractEmailTemplateMetadata, injectEmailTemplateMetadata, type EmailLayout } from "@/lib/email-content";
import { applyEmailTemplateSelection } from "@/lib/apply-email-template";
import { TemplatePicker } from "@/components/templates/template-picker";
import { TemplateScopeHelp } from "@/components/templates/template-scope-help";
import { OutboundWorkflowHelp } from "@/components/outbound/outbound-workflow-help";
import { useOutboundEmailSettings } from "@/lib/outbound-email-settings";
// Inline placeholder data/functions to avoid importing @digitify/email (which pulls in nodemailer/server deps)
type PlaceholderContext = Record<string, string | number | undefined>;

function replacePlaceholders(text: string, context: PlaceholderContext): string {
  const months = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
  const now = new Date();
  const fullContext: PlaceholderContext = {
    todayDate: `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`,
    ...context,
  };
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = fullContext[key];
    if (value !== undefined && value !== null && value !== "") return String(value);
    return match;
  });
}

function buildLeadContext(lead: {
  companyName?: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  industry?: string | null;
  city?: string | null;
  overallScore?: number | null;
  scorePriority?: string | null;
  contacts?: Array<{ name?: string; isPrimary?: boolean }>;
}, senderSettings?: Record<string, string>): PlaceholderContext {
  const primaryContact = lead.contacts?.find((c) => c.isPrimary) || lead.contacts?.[0];
  return {
    companyName: lead.companyName,
    contactName: primaryContact?.name,
    industry: lead.industry ?? undefined,
    city: lead.city ?? undefined,
    website: lead.website ?? undefined,
    email: lead.email ?? undefined,
    phone: lead.phone ?? undefined,
    leadScore: lead.overallScore ?? undefined,
    scorePriority: lead.scorePriority ?? undefined,
    ...senderSettings,
  };
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function ComposePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const leadIdFromQuery = searchParams.get("leadId") || "";
  const templateIdFromQuery = searchParams.get("templateId") || "";
  const campaignIdFromQuery = searchParams.get("campaignId") || "";
  const utils = trpc.useUtils();

  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [emailLayout, setEmailLayout] = useState<EmailLayout>("modern");
  const [previewWithPlaceholders, setPreviewWithPlaceholders] = useState(false);
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [layoutFromTemplate, setLayoutFromTemplate] = useState(false);
  const [bodyFormat, setBodyFormat] = useState<"TEXT" | "HTML">("TEXT");
  const [campaignFilterId, setCampaignFilterId] = useState("");

  // Fetch leads for the dropdown
  const { data: leadsData, isLoading: leadsLoading } = trpc.lead.list.useQuery({
    filters: { search: leadSearch || undefined, hasEmail: true },
    page: 1,
    pageSize: 50,
    sortBy: "companyName",
    sortDir: "asc",
  });
  const leadOptions = useMemo(() => {
    const items = leadsData?.items ?? [];
    const seen = new Set<string>();
    return items.filter((lead: NonNullable<typeof leadsData>["items"][number]) => {
      const company = (lead.companyName || "").trim().toLowerCase();
      const email = (lead.email || "").trim().toLowerCase();
      const city = (lead.city || "").trim().toLowerCase();
      const key = `${company}::${email}::${city}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [leadsData?.items]);

  const { data: campaigns } = trpc.campaign.list.useQuery();
  const { data: templateData } = trpc.template.list.useQuery({
    forOutbound: true,
    campaignId: campaignFilterId || undefined,
  });
  const templates = templateData?.templates ?? [];
  const preloadedTemplateQuery = trpc.template.get.useQuery(
    { id: templateIdFromQuery },
    { enabled: Boolean(templateIdFromQuery) },
  );

  // Branding settings for email preview
  const {
    brandCompanyName,
    brandPrimaryColor,
    brandWebsite,
    brandHeaderSlogan,
    followupDays,
    typographyMode,
    defaultEmailLayout,
    senderEmail,
    senderName,
    senderTitle,
    senderPhone,
  } = useOutboundEmailSettings();

  const preloadedLeadQuery = trpc.lead.getById.useQuery(
    { id: leadIdFromQuery },
    { enabled: !!leadIdFromQuery }
  );

  // Selected lead details
  const selectedLead = useMemo(() => {
    if (selectedLeadId === leadIdFromQuery && preloadedLeadQuery.data) {
      return preloadedLeadQuery.data;
    }
    if (!selectedLeadId || !leadOptions.length) return null;
    return leadOptions.find((l: NonNullable<typeof leadsData>["items"][number]) => l.id === selectedLeadId) || null;
  }, [selectedLeadId, leadOptions, leadIdFromQuery, preloadedLeadQuery.data]);

  // Build placeholder context from selected lead
  const placeholderContext = useMemo<PlaceholderContext>(() => {
    if (!selectedLead) return {};
    return buildLeadContext(selectedLead as Parameters<typeof buildLeadContext>[0], {
      senderName,
      senderTitle,
      senderCompany: brandCompanyName,
      senderEmail,
      senderPhone,
    });
  }, [selectedLead, senderName, senderTitle, brandCompanyName, senderEmail, senderPhone]);

  // Build sample context from examples for preview
  const sampleContext = useMemo<PlaceholderContext>(() => {
    const ctx: PlaceholderContext = {};
    for (const p of MAIL_VARIABLE_REGISTRY) {
      ctx[p.key] = p.example;
    }
    return ctx;
  }, []);

  // Preview text with placeholders filled in
  const previewSubject = useMemo(() => {
    if (!previewWithPlaceholders) return subject;
    const ctx = selectedLead ? placeholderContext : sampleContext;
    return replacePlaceholders(subject, ctx);
  }, [previewWithPlaceholders, subject, selectedLead, placeholderContext, sampleContext]);

  const previewBody = useMemo(() => {
    if (!previewWithPlaceholders) return body;
    const ctx = selectedLead ? placeholderContext : sampleContext;
    return replacePlaceholders(body, ctx);
  }, [previewWithPlaceholders, body, selectedLead, placeholderContext, sampleContext]);

  const unknownVariables = useMemo(
    () => Array.from(new Set([...findUnknownMailVariables(subject), ...findUnknownMailVariables(body)])),
    [subject, body],
  );
  const allUsedVariables = useMemo(
    () => Array.from(new Set([...extractMailVariableKeys(subject), ...extractMailVariableKeys(body)])),
    [subject, body],
  );
  const missingLeadVariables = useMemo(
    () =>
      selectedLead
        ? allUsedVariables.filter((key) => {
            if (key === "todayDate") return false;
            const value = placeholderContext[key];
            return value === undefined || value === null || value === "";
          })
        : [],
    [allUsedVariables, placeholderContext, selectedLead],
  );
  const hasValidEmail = isValidEmail(toEmail);
  const isComposeReady =
    Boolean(selectedLeadId) &&
    hasValidEmail &&
    Boolean(subject.trim()) &&
    Boolean(body.trim()) &&
    unknownVariables.length === 0;
  const suggestedFollowUpDate = useMemo(() => {
    const next = new Date();
    next.setDate(next.getDate() + followupDays);
    return next.toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" });
  }, [followupDays]);

  useEffect(() => {
    if (!ctaUrl) {
      const fallbackUrl = brandWebsite || selectedLead?.website || "";
      if (fallbackUrl) setCtaUrl(fallbackUrl);
    }
  }, [brandWebsite, selectedLead?.website, ctaUrl]);

  useEffect(() => {
    if (!leadIdFromQuery) return;
    setSelectedLeadId((current) => current || leadIdFromQuery);
  }, [leadIdFromQuery]);

  useEffect(() => {
    if (!campaignIdFromQuery) return;
    setCampaignFilterId((current) => current || campaignIdFromQuery);
  }, [campaignIdFromQuery]);

  useEffect(() => {
    if (!preloadedLeadQuery.data) return;
    const lead = preloadedLeadQuery.data;
    setLeadSearch((current) => current || lead.companyName || lead.website || "");
    setToEmail((current) => current || lead.email || "");
  }, [preloadedLeadQuery.data]);

  useEffect(() => {
    if (!templateIdFromQuery || selectedTemplateId === templateIdFromQuery) return;
    const template =
      templates.find((item) => item.id === templateIdFromQuery) ?? preloadedTemplateQuery.data;
    if (!template) return;
    const applied = applyEmailTemplateSelection(template);
    setSelectedTemplateId(templateIdFromQuery);
    setSubject(applied.subject);
    setBody(applied.body);
    setBodyFormat(applied.bodyFormat);
    setCtaText(applied.ctaText);
    setCtaUrl(applied.ctaUrl);
    setEmailLayout(applied.layout);
    setLayoutFromTemplate(true);
    if (template.campaignId) {
      setCampaignFilterId(template.campaignId);
    }
  }, [templateIdFromQuery, templates, preloadedTemplateQuery.data, selectedTemplateId]);

  useEffect(() => {
    setEmailLayout((current) => (current === "modern" && defaultEmailLayout ? defaultEmailLayout : current));
  }, [defaultEmailLayout]);

  // Mutations
  const createDraft = trpc.contact.createDraft.useMutation({
    onSuccess: () => {
      utils.contact.listDrafts.invalidate();
    },
  });

  const submitForApproval = trpc.contact.submitForApproval.useMutation({
    onSuccess: () => {
      utils.contact.listDrafts.invalidate();
    },
  });

  const draftEmail = trpc.openclaw.draftEmail.useMutation();

  // Insert placeholder at cursor position
  const insertPlaceholder = useCallback((key: string) => {
    const placeholder = `{{${key}}}`;
    const textarea = bodyRef.current;

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newBody = body.substring(0, start) + placeholder + body.substring(end);
      setBody(newBody);
      // Re-focus and set cursor after the inserted placeholder
      requestAnimationFrame(() => {
        textarea.focus();
        const newPos = start + placeholder.length;
        textarea.setSelectionRange(newPos, newPos);
      });
    } else {
      setBody((prev) => prev + placeholder);
    }
  }, [body]);

  // Handle lead selection
  function handleLeadSelect(leadId: string) {
    setSelectedLeadId(leadId);
    const lead = leadOptions.find((l: NonNullable<typeof leadsData>["items"][number]) => l.id === leadId);
    if (lead?.email) {
      setToEmail(lead.email);
    }
  }

  function handleTemplateSelect(templateId: string) {
    setSelectedTemplateId(templateId);
    if (templateId === "none") {
      setLayoutFromTemplate(false);
      setBodyFormat("TEXT");
      return;
    }
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    const applied = applyEmailTemplateSelection(template);
    setSubject(applied.subject);
    setBody(applied.body);
    setBodyFormat(applied.bodyFormat);
    setCtaText(applied.ctaText);
    setCtaUrl(applied.ctaUrl);
    setEmailLayout(applied.layout);
    setLayoutFromTemplate(true);
  }

  // Save as draft
  async function handleSaveDraft() {
    if (!isComposeReady) return;
    setIsSaving(true);
    try {
      await createDraft.mutateAsync({
        leadId: selectedLeadId,
        toEmail,
        subject,
        body: injectEmailTemplateMetadata(body, { ctaText, ctaUrl, layout: emailLayout, bodyFormat }),
        templateId: selectedTemplateId && selectedTemplateId !== "none" ? selectedTemplateId : undefined,
      });
      setSuccessMessage("Draft opgeslagen!");
      setTimeout(() => {
        router.push("/contacts");
      }, 1000);
    } finally {
      setIsSaving(false);
    }
  }

  // Save & submit for approval
  async function handleSubmitForApproval() {
    if (!isComposeReady) return;
    setIsSaving(true);
    try {
      const draft = await createDraft.mutateAsync({
        leadId: selectedLeadId,
        toEmail,
        subject,
        body: injectEmailTemplateMetadata(body, { ctaText, ctaUrl, layout: emailLayout, bodyFormat }),
        templateId: selectedTemplateId && selectedTemplateId !== "none" ? selectedTemplateId : undefined,
      });
      await submitForApproval.mutateAsync({ id: draft.id });
      setSuccessMessage("Ingediend ter goedkeuring!");
      setTimeout(() => {
        router.push("/contacts");
      }, 1000);
    } finally {
      setIsSaving(false);
    }
  }

  // AI Generate
  async function handleAiGenerate() {
    if (!selectedLeadId) return;
    setAiLoading(true);
    try {
      const result = await draftEmail.mutateAsync({ leadId: selectedLeadId });
      if (result.draft) {
        setSubject(result.draft.subject);
        const parsed = extractEmailTemplateMetadata(result.draft.body);
        const applied = applyEmailTemplateSelection({
          subject: result.draft.subject,
          cleanBody: parsed.cleanBody,
          ctaText: parsed.ctaText,
          ctaUrl: parsed.ctaUrl,
          layout: parsed.layout,
        });
        setBody(applied.body);
        setCtaText(applied.ctaText);
        setCtaUrl(applied.ctaUrl);
        if (parsed.layout) setEmailLayout(applied.layout);
        setLayoutFromTemplate(false);
        if (result.draft.toEmail) {
          setToEmail(result.draft.toEmail);
        }
      }
    } finally {
      setAiLoading(false);
    }
  }

  const isFormValid = isComposeReady;

  return (
    <div className="space-y-5">
      <Card className="compose-page-header">
        <CardContent className="p-0">
          <div className="compose-page-header-inner">
            <Link href="/contacts" className="shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl"
                aria-label="Terug naar outbound"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <span className="compose-page-header-icon" aria-hidden>
              <PenSquare className="h-5 w-5" />
            </span>
            <div className="compose-page-header-text">
              <h1 className="compose-page-header-title">Nieuwe e-mail</h1>
              <p className="compose-page-header-subtitle">
                Concept opslaan of ter goedkeuring indienen — verzending gebeurt later via
                Outbound Center.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {successMessage && (
        <Card className="border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">{successMessage}</p>
        </Card>
      )}

      <Card className="compose-page-hint">
        <CardContent className="p-0">
          <div className="compose-page-hint-inner">
            <div className="compose-page-hint-main">
              <span
                className={cn(
                  "compose-page-hint-icon",
                  isComposeReady ? "compose-page-hint-icon-ready" : "compose-page-hint-icon-pending",
                )}
                aria-hidden
              >
                {isComposeReady ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Info className="h-4 w-4" />
                )}
              </span>
              <div className="compose-page-hint-text">
                <p className="compose-page-hint-message">
                  {isComposeReady
                    ? "Klaar om op te slaan of ter goedkeuring in te dienen."
                    : "Vul lead, geldig e-mailadres en placeholders in voordat je opslaat."}
                </p>
                <p className="compose-page-hint-meta">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Opvolginterval: {followupDays} dagen
                    {suggestedFollowUpDate ? ` · rond ${suggestedFollowUpDate}` : ""}
                  </span>
                  {!isComposeReady ? (
                    <span className="text-muted-foreground/80">
                      · Verzending via Outbound Center
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
            <details className="compose-page-hint-details">
              <summary className="compose-page-hint-summary">
                <ChevronRight className="compose-page-hint-chevron" aria-hidden />
                Workflow &amp; snelkoppelingen
              </summary>
              <div className="compose-page-hint-expand">
                <OutboundWorkflowHelp
                  variant="compact"
                  className="rounded-xl border border-blue-200/60 bg-blue-50/40 px-3 py-2 dark:border-blue-900/40 dark:bg-blue-950/20"
                />
                <div className="compose-page-hint-links">
                  <Button asChild size="sm" variant="outline" className="rounded-lg">
                    <Link href="/templates">E-mailtemplates</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="rounded-lg">
                    <Link href="/settings/email">E-mailinstellingen</Link>
                  </Button>
                </div>
              </div>
            </details>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* Left: Compose Form */}
        <div className="space-y-4">
          {/* Lead Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ontvanger</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lead-search">Lead zoeken</Label>
                <Input
                  id="lead-search"
                  placeholder="Zoek op bedrijfsnaam, e-mail, stad..."
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Lead selecteren</Label>
                <Select value={selectedLeadId} onValueChange={handleLeadSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder={leadsLoading ? "Laden..." : "Kies een lead"} />
                  </SelectTrigger>
                  <SelectContent>
                    {leadOptions.map((lead: NonNullable<typeof leadsData>["items"][number]) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.companyName} {lead.city ? `- ${lead.city}` : ""} {lead.email ? `(${lead.email})` : ""}
                      </SelectItem>
                    ))}
                    {leadOptions.length === 0 && (
                      <SelectItem value="__empty" disabled>
                        Geen leads gevonden
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="to-email">E-mailadres ontvanger</Label>
                <Input
                  id="to-email"
                  type="email"
                  placeholder="email@bedrijf.be"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  className={!toEmail || hasValidEmail ? "" : "border-destructive"}
                />
                {toEmail && !hasValidEmail ? (
                  <p className="text-xs text-destructive">Vul een geldig e-mailadres in.</p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Template & Content */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Inhoud</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Layout selector */}
              <div className="space-y-2">
                <Label>E-mail layout</Label>
                <Select
                  value={emailLayout}
                  onValueChange={(v) => {
                    setEmailLayout(v as typeof emailLayout);
                    setLayoutFromTemplate(false);
                  }}
                  disabled={layoutFromTemplate}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kies een layout..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="modern">Modern (standaard)</SelectItem>
                    <SelectItem value="minimal">Minimalistisch</SelectItem>
                    <SelectItem value="business">Zakelijk</SelectItem>
                    <SelectItem value="proposal">Voorstel</SelectItem>
                    <SelectItem value="followup">Follow-up</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {layoutFromTemplate
                    ? "Layout komt uit het gekozen Template Studio-template. Kies “Geen template” om handmatig te wijzigen."
                    : "Deze layout wordt mee opgeslagen in het concept en zo verzonden."}
                </p>
              </div>

              {/* Preview met Placeholders toggle */}
              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Preview met Placeholders</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedLead
                        ? `Toont waarden van ${selectedLead.companyName}`
                        : "Toont voorbeelddata"}
                    </p>
                  </div>
                </div>
                <Button
                  variant={previewWithPlaceholders ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreviewWithPlaceholders(!previewWithPlaceholders)}
                >
                  <ToggleLeft className="mr-1 h-4 w-4" />
                  {previewWithPlaceholders ? "Aan" : "Uit"}
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Campagne (template-filter)</Label>
                <Select
                  value={campaignFilterId || "all"}
                  onValueChange={(value) => {
                    setCampaignFilterId(value === "all" ? "" : value);
                    setSelectedTemplateId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Alle campagnes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle campagnes + globale templates</SelectItem>
                    {(campaigns ?? []).map((campaign: { id: string; name: string }) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <TemplateScopeHelp variant="compose" className="border-0 bg-transparent p-0 shadow-none" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Template Studio</Label>
                  <Link href="/templates" className="text-xs text-primary hover:underline">
                    Beheren
                  </Link>
                </div>
                <TemplatePicker
                  value={selectedTemplateId || "none"}
                  onValueChange={handleTemplateSelect}
                  templates={templates}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Onderwerp</Label>
                <Input
                  id="subject"
                  placeholder="Onderwerp van de e-mail..."
                  value={previewWithPlaceholders ? previewSubject : subject}
                  onChange={(e) => {
                    if (!previewWithPlaceholders) setSubject(e.target.value);
                  }}
                  readOnly={previewWithPlaceholders}
                  className={previewWithPlaceholders ? "bg-muted/50" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="body">Bericht</Label>
                <Textarea
                  id="body"
                  ref={bodyRef}
                  placeholder="Schrijf hier je bericht... Gebruik {{companyName}} voor template variabelen."
                  value={previewWithPlaceholders ? previewBody : body}
                  onChange={(e) => {
                    if (!previewWithPlaceholders) setBody(e.target.value);
                  }}
                  readOnly={previewWithPlaceholders}
                  rows={14}
                  className={`font-mono text-sm ${previewWithPlaceholders ? "bg-muted/50" : ""}`}
                />
              </div>

              <MailVariablesHelp
                onInsert={insertPlaceholder}
                defaultOpen
                title="Beschikbare Mail Variables"
                insertHint="Klik op een variable om deze op de cursorpositie in het bericht te plaatsen."
              />
            </CardContent>
          </Card>

          <Card className="p-4">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">CTA-knop voor HTML mail</p>
                <p className="text-xs text-muted-foreground">
                  Voeg optioneel een opvallende knop toe, bijvoorbeeld naar je website of boekingspagina.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>CTA tekst</Label>
                  <Input
                    value={ctaText}
                    onChange={(event) => setCtaText(event.target.value)}
                    placeholder="Plan een gesprek"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CTA URL</Label>
                  <Input
                    value={ctaUrl}
                    onChange={(event) => setCtaUrl(event.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Preflight</p>
              <div className="grid gap-2 md:grid-cols-3">
                <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
                  <p className="font-medium">Lead gekoppeld</p>
                  <p className={selectedLeadId ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                    {selectedLeadId ? "OK" : "Vereist"}
                  </p>
                </div>
                <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
                  <p className="font-medium">E-mail geldig</p>
                  <p className={hasValidEmail ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                    {hasValidEmail ? "OK" : "Vereist"}
                  </p>
                </div>
                <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
                  <p className="font-medium">Onbekende placeholders</p>
                  <p className={unknownVariables.length === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                    {unknownVariables.length === 0 ? "Geen" : `${unknownVariables.length} gevonden`}
                  </p>
                </div>
              </div>
              {unknownVariables.length > 0 ? (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>Onbekende placeholders: {unknownVariables.map((key) => `{{${key}}}`).join(", ")}</p>
                </div>
              ) : null}
              {missingLeadVariables.length > 0 ? (
                <div className="flex items-start gap-2 rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>Deze velden zijn leeg op de lead en worden automatisch leeg ingevuld: {missingLeadVariables.map((key) => `{{${key}}}`).join(", ")}</p>
                </div>
              ) : null}
            </div>
          </Card>

          {/* Actions */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={!isFormValid || isSaving}
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Opslaan..." : "Opslaan als concept"}
              </Button>

              <Button
                onClick={handleSubmitForApproval}
                disabled={!isFormValid || isSaving}
              >
                <Send className="mr-2 h-4 w-4" />
                {isSaving ? "Indienen..." : "Opslaan & indienen ter goedkeuring"}
              </Button>

              <Button
                variant="secondary"
                onClick={handleAiGenerate}
                disabled={!selectedLeadId || aiLoading}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {aiLoading ? "AI genereert..." : "AI Genereren"}
              </Button>

              {/* Preview Dialog */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" disabled={!subject && !body}>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>E-mail preview</DialogTitle>
                  </DialogHeader>
                  <EmailPreview
                    subject={previewWithPlaceholders ? previewSubject : subject}
                    body={previewWithPlaceholders ? previewBody : body}
                    bodyFormat={bodyFormat}
                    companyName={brandCompanyName}
                    primaryColor={brandPrimaryColor}
                    fromName={brandCompanyName}
                    headerSlogan={brandHeaderSlogan}
                    recipientCompany={selectedLead?.companyName || "Ontvanger"}
                    layout={emailLayout}
                    ctaText={ctaText}
                    ctaUrl={ctaUrl}
                    typographyMode={typographyMode}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </Card>
        </div>

        {/* Right: Tips & Lead Info */}
        <div className="space-y-4">
          {/* Selected Lead Info */}
          {selectedLead && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Geselecteerde lead</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Bedrijf</span>
                  <span className="font-medium">{selectedLead.companyName}</span>
                </div>
                {selectedLead.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">E-mail</span>
                    <span className="font-medium">{selectedLead.email}</span>
                  </div>
                )}
                {selectedLead.city && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Stad</span>
                    <span className="font-medium">{selectedLead.city}</span>
                  </div>
                )}
                {selectedLead.industry && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Sector</span>
                    <span className="font-medium">{selectedLead.industry}</span>
                  </div>
                )}
                {selectedLead.overallScore !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Score</span>
                    <Badge variant="secondary">{selectedLead.overallScore}/100</Badge>
                  </div>
                )}
                {selectedLead.scorePriority && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Prioriteit</span>
                    <Badge variant="outline">{selectedLead.scorePriority}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="compose-sidebar-preview lg:sticky lg:top-4">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-base">HTML-voorbeeld</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Live preview met layout{" "}
                    <span className="font-medium text-foreground/80">{emailLayout}</span>
                    {previewWithPlaceholders ? " · placeholders ingevuld" : ""}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {bodyFormat === "HTML" ? "HTML" : "Tekst"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {subject || body ? (
                <EmailPreview
                  compact
                  subject={previewWithPlaceholders ? previewSubject : subject}
                  body={previewWithPlaceholders ? previewBody : body}
                  bodyFormat={bodyFormat}
                  companyName={brandCompanyName}
                  primaryColor={brandPrimaryColor}
                  fromName={brandCompanyName}
                  headerSlogan={brandHeaderSlogan}
                  recipientCompany={selectedLead?.companyName || "Ontvanger"}
                  layout={emailLayout}
                  ctaText={ctaText}
                  ctaUrl={ctaUrl}
                  typographyMode={typographyMode}
                />
              ) : (
                <div className="compose-sidebar-preview-empty">
                  <Eye className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm font-medium text-foreground/80">Nog geen inhoud</p>
                  <p className="max-w-[16rem] text-xs text-muted-foreground">
                    Vul onderwerp en bericht in om het HTML-voorbeeld te zien.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tips */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tips</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>
                <strong>Placeholders:</strong> Klik op een placeholder-chip om deze in te voegen. Activeer &quot;Preview met Placeholders&quot; om het resultaat te zien.
              </p>
              <p>
                <strong>AI Genereren:</strong> Selecteer eerst een lead, dan genereert OpenClaw een gepersonaliseerde e-mail op basis van de lead data.
              </p>
              <p>
                <strong>Templates:</strong> Kies een template om snel te starten. Pas daarna aan waar nodig.
              </p>
              <p>
                <strong>Approval flow:</strong> Na indienen wordt de e-mail beoordeeld voordat deze verzonden wordt.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
