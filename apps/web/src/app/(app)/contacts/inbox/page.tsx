"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc/client";
import { buildInboxHtmlDocument, sanitizeInboxHtml } from "@/lib/sanitize-inbox-html";
import {
  Button,
  Card,
  Badge,
  Input,
  Label,
  Textarea,
  ScrollArea,
  Skeleton,
  Separator,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@digitify/ui";
import {
  Inbox,
  Mail,
  Reply,
  Send,
  RefreshCw,
  ArrowLeft,
  AlertCircle,
  Trash2,
  Archive,
  CheckCheck,
  Copy,
  ExternalLink,
  Plus,
  PencilLine,
  Sparkles,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { findUnknownMailVariables } from "@/lib/mail-variables";
import { injectEmailTemplateMetadata, type EmailLayout } from "@/lib/email-content";
import { applyEmailTemplateSelection } from "@/lib/apply-email-template";
import { TemplatePicker } from "@/components/templates/template-picker";
import Link from "next/link";

const MAIL_TYPES = [
  { value: "general", label: "Algemeen" },
  { value: "lead_contact", label: "Lead contact" },
  { value: "quote", label: "Offerte" },
  { value: "follow_up", label: "Follow-up" },
  { value: "booking_confirmation", label: "Booking bevestiging" },
] as const;

type MailType = (typeof MAIL_TYPES)[number]["value"];

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

const INBOX_AI_STYLES = [
  "Korter",
  "Professioneler",
  "Warmer",
  "Directer",
  "Overtuigender",
  "Meer sales-gericht",
  "Vriendelijker",
] as const;

function buildTemplate(type: MailType) {
  switch (type) {
    case "quote":
      return {
        subject: "Offerte op maat voor uw project",
        body: "Beste,\n\nHierbij ontvangt u onze offerte op maat. Hieronder vindt u de gekozen opties en prijzen.\n\nLaat gerust weten als u nog vragen heeft.\n",
      };
    case "lead_contact":
      return {
        subject: "Even kennismaken",
        body: "Beste,\n\nIk neem graag kort contact op om te bekijken hoe we jullie kunnen helpen.\n\nPast een kort gesprek deze week?\n",
      };
    case "follow_up":
      return {
        subject: "Korte opvolging",
        body: "Beste,\n\nIk volg even kort op over mijn vorige bericht. Laat gerust weten of dit nog relevant is.\n",
      };
    case "booking_confirmation":
      return {
        subject: "Bevestiging van uw afspraak",
        body: "Beste,\n\nUw afspraak is ingepland. Hieronder bevestigen we datum en praktische info.\n\nTot binnenkort.\n",
      };
    default:
      return {
        subject: "",
        body: "",
      };
  }
}

export default function InboxPage() {
  const [selectedMailbox, setSelectedMailbox] = useState("INBOX");
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composeType, setComposeType] = useState<MailType>("general");
  const [composeTemplateId, setComposeTemplateId] = useState<string>("none");
  const [composeLeadSearch, setComposeLeadSearch] = useState("");
  const [composeLeadId, setComposeLeadId] = useState("");
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeStatus, setComposeStatus] = useState<"draft" | "queued" | "sent" | "failed" | "replied" | null>(null);
  const [composeError, setComposeError] = useState("");
  const [composeLayout, setComposeLayout] = useState<EmailLayout>("modern");
  const [composeCtaText, setComposeCtaText] = useState("");
  const [composeCtaUrl, setComposeCtaUrl] = useState("");
  const [inboxAiStyle, setInboxAiStyle] = useState<string>("Professioneler");
  const composeDraftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [followUpContext, setFollowUpContext] = useState<{
    subject: string;
    from: string;
    fromAddress: string;
    text?: string | null;
    html?: string | null;
  } | null>(null);

  const composeEmailValid = isValidEmail(composeTo);

  const utils = trpc.useUtils();

  const { data: mailboxes } = trpc.inbox.mailboxes.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });

  const {
    data: emails,
    isLoading: listLoading,
    error: listError,
    refetch: refetchList,
  } = trpc.inbox.list.useQuery({ mailbox: selectedMailbox }, {
    refetchOnWindowFocus: false,
    retry: false,
  });
  const { data: templateData } = trpc.template.list.useQuery(
    { forOutbound: true },
    { refetchOnWindowFocus: false },
  );
  const savedTemplates = templateData?.templates ?? [];
  const composeLeadsQuery = trpc.lead.list.useQuery(
    {
      filters: { search: composeLeadSearch || undefined, hasEmail: true },
      page: 1,
      pageSize: 8,
      sortBy: "companyName",
      sortDir: "asc",
    },
    {
      enabled: composeLeadSearch.trim().length > 1,
      refetchOnWindowFocus: false,
    },
  );

  const {
    data: message,
    isLoading: messageLoading,
    error: messageError,
  } = trpc.inbox.getMessage.useQuery(
    { uid: selectedUid!, mailbox: selectedMailbox },
    {
      enabled: selectedUid !== null,
      refetchOnWindowFocus: false,
      retry: false,
    },
  );

  const { data: linkedFromMessage } = trpc.inbox.resolveLeadByEmail.useQuery(
    { email: message?.fromAddress || "invalid@example.com" },
    {
      enabled: Boolean(message?.fromAddress && isValidEmail(message.fromAddress)),
      refetchOnWindowFocus: false,
    },
  );
  const { data: linkedFromComposeTo } = trpc.inbox.resolveLeadByEmail.useQuery(
    { email: composeTo },
    {
      enabled: composerOpen && composeEmailValid,
      refetchOnWindowFocus: false,
    },
  );

  const sendReply = trpc.inbox.reply.useMutation({
    onSuccess: () => {
      setReplyBody("");
      setReplyOpen(false);
      setComposeStatus("replied");
      utils.inbox.list.invalidate();
      if (linkedFromMessage?.id) {
        utils.lead.getEmailTimeline.invalidate({ leadId: linkedFromMessage.id });
      }
    },
    onError: (err) => {
      setComposeStatus("failed");
      setComposeError(err.message);
    },
  });
  const suggestReply = trpc.inbox.suggestReply.useMutation({
    onError: (err) => {
      setComposeError(err.message);
    },
  });
  const rewriteInboxMessage = trpc.openclaw.rewriteInboxMessage.useMutation({
    onError: (err) => {
      setComposeStatus("failed");
      setComposeError(err.message);
    },
  });
  const sendEmail = trpc.inbox.send.useMutation({
    onSuccess: () => {
      setComposeStatus("sent");
      setComposeError("");
      setComposeBody("");
      setComposeSubject("");
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("digitify_inbox_compose_draft");
      }
      utils.inbox.list.invalidate();
      if (composeLeadId) {
        utils.lead.getEmailTimeline.invalidate({ leadId: composeLeadId });
      }
    },
    onError: (err) => {
      setComposeStatus("failed");
      setComposeError(err.message);
    },
  });

  const sanitizedMessageHtml = useMemo(() => {
    if (!message?.html) return null;
    return buildInboxHtmlDocument(sanitizeInboxHtml(message.html));
  }, [message?.html]);

  useEffect(() => {
    if (!message?.uid || !linkedFromMessage?.id) return;
    utils.lead.getEmailTimeline.invalidate({ leadId: linkedFromMessage.id });
  }, [message?.uid, linkedFromMessage?.id, utils.lead.getEmailTimeline]);

  useEffect(() => {
    if (!linkedFromMessage?.id) return;
    setComposeLeadId(linkedFromMessage.id);
    setComposeLeadSearch(linkedFromMessage.companyName || "");
  }, [linkedFromMessage?.id, linkedFromMessage?.companyName]);

  useEffect(() => {
    if (!composerOpen || !linkedFromComposeTo?.id) return;
    setComposeLeadId(linkedFromComposeTo.id);
    setComposeLeadSearch(linkedFromComposeTo.companyName || "");
  }, [composerOpen, linkedFromComposeTo?.id, linkedFromComposeTo?.companyName]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("digitify_inbox_compose_draft");
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as Partial<{
        type: MailType;
        leadId: string;
        leadSearch: string;
        to: string;
        subject: string;
        body: string;
      }>;
      if (draft.type && MAIL_TYPES.some((item) => item.value === draft.type)) setComposeType(draft.type);
      if (draft.leadId) setComposeLeadId(draft.leadId);
      if (draft.leadSearch) setComposeLeadSearch(draft.leadSearch);
      if (draft.to) setComposeTo(draft.to);
      if (draft.subject) setComposeSubject(draft.subject);
      if (draft.body) setComposeBody(draft.body);
      if (draft.to || draft.subject || draft.body) setComposeStatus("draft");
    } catch {
      // ignore corrupt local draft state
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      type: composeType,
      leadId: composeLeadId,
      leadSearch: composeLeadSearch,
      to: composeTo,
      subject: composeSubject,
      body: composeBody,
    };
    if (composeDraftSaveTimerRef.current) clearTimeout(composeDraftSaveTimerRef.current);
    composeDraftSaveTimerRef.current = setTimeout(() => {
      window.localStorage.setItem("digitify_inbox_compose_draft", JSON.stringify(payload));
    }, 300);
    return () => {
      if (composeDraftSaveTimerRef.current) clearTimeout(composeDraftSaveTimerRef.current);
    };
  }, [composeType, composeLeadId, composeLeadSearch, composeTo, composeSubject, composeBody]);

  function handleSelectComposeLead(lead: {
    id: string;
    companyName: string | null;
    website: string | null;
    email: string | null;
  }) {
    setComposeLeadId(lead.id);
    setComposeLeadSearch(lead.companyName || lead.website || "");
    if (lead.email) {
      setComposeTo(lead.email);
    }
    setComposeStatus("draft");
  }

  function handleReply() {
    if (!message || !replyBody.trim()) return;
    const toAddress = message.fromAddress || extractAddress(message.from);
    if (!toAddress) {
      setComposeStatus("failed");
      setComposeError("Geen geldig afzenderadres gevonden voor dit bericht.");
      return;
    }
    sendReply.mutate({
      uid: message.uid,
      to: toAddress,
      subject: message.subject,
      messageId: message.messageId,
      inReplyTo: message.inReplyTo || message.messageId,
      body: replyBody,
      ...(linkedFromMessage?.id || composeLeadId ? { leadId: linkedFromMessage?.id || composeLeadId } : {}),
    });
  }

  function extractAddress(value: string) {
    const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match?.[0] || "";
  }

  function handleApplyTemplate(nextType: MailType) {
    setComposeType(nextType);
    setComposeTemplateId("none");
    const template = buildTemplate(nextType);
    if (!composeSubject.trim()) setComposeSubject(template.subject);
    if (!composeBody.trim()) setComposeBody(template.body);
    setComposeStatus("draft");
  }

  function handleApplySavedTemplate(templateId: string) {
    setComposeTemplateId(templateId);
    if (templateId === "none") {
      setComposeCtaText("");
      setComposeCtaUrl("");
      return;
    }
    const template = savedTemplates.find((item) => item.id === templateId);
    if (!template) return;
    const applied = applyEmailTemplateSelection(template);
    setComposeSubject(applied.subject);
    setComposeBody(applied.body);
    setComposeLayout(applied.layout);
    setComposeCtaText(applied.ctaText);
    setComposeCtaUrl(applied.ctaUrl);
    setComposeStatus("draft");
  }

  function handleSendComposed() {
    if (!composeReady) {
      setComposeStatus("failed");
      if (!composeEmailValid) {
        setComposeError("Vul een geldig ontvangeradres in.");
      } else if (composeUnknownVariables.length > 0) {
        setComposeError(`Onbekende placeholders: ${composeUnknownVariables.map((key) => `{{${key}}}`).join(", ")}`);
      } else {
        setComposeError("Vul alle verplichte velden in.");
      }
      return;
    }
    setComposeStatus("queued");
    setComposeError("");
    sendEmail.mutate({
      to: composeTo.trim(),
      subject: composeSubject.trim(),
      body: injectEmailTemplateMetadata(composeBody, {
        layout: composeLayout,
        ctaText: composeCtaText,
        ctaUrl: composeCtaUrl,
      }),
      type: composeType,
      ...(composeLeadId ? { leadId: composeLeadId } : {}),
    });
  }

  function handleAiReply() {
    if (!message || selectedUid === null) return;
    setComposeError("");
    suggestReply.mutate(
      {
        uid: message.uid,
        mailbox: selectedMailbox,
        style: inboxAiStyle,
        draftBody: replyBody.trim() || undefined,
      },
      {
        onSuccess: (data) => {
          if (data.error) {
            setComposeError(data.error);
            return;
          }
          if (data.rewritten?.body) setReplyBody(data.rewritten.body);
        },
      },
    );
  }

  function handleAiCompose() {
    const incoming = followUpContext ?? (message ? {
      subject: message.subject,
      from: message.from,
      fromAddress: message.fromAddress,
      text: message.text,
      html: message.html,
    } : null);
    setComposeError("");
    rewriteInboxMessage.mutate(
      {
        purpose: composeType === "follow_up" ? "follow_up" : "compose",
        style: inboxAiStyle,
        subject: composeSubject.trim() || undefined,
        body: composeBody.trim() || undefined,
        incomingSubject: incoming?.subject,
        incomingBody: incoming?.text?.trim() || undefined,
        incomingHtml: incoming?.html?.trim() || undefined,
        recipientEmail: composeTo.trim() || incoming?.fromAddress,
        recipientName: incoming ? extractName(incoming.from) : undefined,
      },
      {
        onSuccess: (data) => {
          if (data.error) {
            setComposeError(data.error);
            return;
          }
          if (data.rewritten?.subject) setComposeSubject(data.rewritten.subject);
          if (data.rewritten?.body) setComposeBody(data.rewritten.body);
          setComposeStatus("draft");
        },
      },
    );
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      return d.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
  }

  function extractName(from: string) {
    const match = from.match(/^(.+?)\s*</);
    if (match?.[1]) return match[1].trim().replace(/^"|"$/g, "");
    return from.replace(/<.*>/, "").trim() || from;
  }

  const isConfigError = listError?.message?.includes("niet geconfigureerd");
  const selectedMailboxLabel =
    mailboxes?.find((mailbox) => mailbox.path === selectedMailbox)?.label ?? "Inbox";

  function mailboxIcon(path: string) {
    if (path.toLowerCase().includes("trash")) return Trash2;
    if (path.toLowerCase().includes("archive") || path.toLowerCase().includes("all mail")) return Archive;
    if (path.toLowerCase().includes("sent")) return CheckCheck;
    return Inbox;
  }

  const composeUnknownVariables = Array.from(
    new Set([...findUnknownMailVariables(composeSubject), ...findUnknownMailVariables(composeBody)]),
  );
  const composeReady =
    composeEmailValid &&
    Boolean(composeSubject.trim()) &&
    Boolean(composeBody.trim()) &&
    composeUnknownVariables.length === 0;
  const unreadCount = (emails || []).filter((email) => !email.seen).length;
  const selectedMessageFrom = message?.fromAddress || "";

  function openComposerWithFollowUp() {
    if (!message) return;
    setFollowUpContext({
      subject: message.subject,
      from: message.from,
      fromAddress: message.fromAddress,
      text: message.text,
      html: message.html,
    });
    setComposerOpen(true);
    setSelectedUid(null);
    setComposeType("follow_up");
    setComposeTemplateId("none");
    setComposeTo(selectedMessageFrom);
    setComposeSubject(message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`);
    setComposeBody([
      `Beste ${extractName(message.from)},`,
      "",
      "Ik volg graag even op naar aanleiding van uw bericht.",
      "",
      "Laat gerust weten wat voor u het beste past als volgende stap.",
      "",
      "Vriendelijke groeten,",
    ].join("\n"));
    setComposeStatus("draft");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {selectedUid !== null && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelectedUid(null);
                setReplyOpen(false);
              }}
              className="md:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight">Inbox</h1>
            <p className="text-sm text-muted-foreground">
              Inkomende en uitgaande e-mails beheren
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isConfigError && unreadCount > 0 ? (
            <Badge variant="secondary" className="h-8 px-2.5 tabular-nums">
              {unreadCount} ongelezen
            </Badge>
          ) : null}
          <Button
            variant={composerOpen ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setComposerOpen((current) => !current);
              setSelectedUid(null);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nieuw bericht
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchList()}
            disabled={listLoading}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", listLoading && "animate-spin")} />
            Vernieuwen
          </Button>
        </div>
      </div>

      {composeStatus ? (
        <div className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs">
          <PencilLine className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">Status:</span>
          <Badge
            variant={
              composeStatus === "sent" || composeStatus === "replied"
                ? "success"
                : composeStatus === "failed"
                  ? "destructive"
                  : composeStatus === "queued"
                    ? "info"
                    : "secondary"
            }
          >
            {composeStatus === "draft"
              ? "Draft"
              : composeStatus === "queued"
                ? "Queued"
                : composeStatus === "sent"
                  ? "Sent"
                  : composeStatus === "replied"
                    ? "Replied"
                    : "Failed"}
          </Badge>
          {composeError ? <span className="text-destructive">{composeError}</span> : null}
        </div>
      ) : null}

      {isConfigError && (
        <Card className="border-amber-500/50 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">IMAP niet geconfigureerd</p>
              <p className="text-sm text-muted-foreground mt-1">
                Ga naar{" "}
                <a href="/settings/integrations" className="text-primary hover:underline font-medium">
                  Instellingen &gt; Integraties
                </a>{" "}
                om je IMAP-instellingen te configureren.
              </p>
            </div>
          </div>
        </Card>
      )}

      {!isConfigError && (
        <div className="space-y-2.5">
          <ScrollArea className="w-full whitespace-nowrap rounded-lg border">
            <div className="flex gap-1.5 p-1.5">
              {(mailboxes ?? [{ path: "INBOX", label: "Inbox" }]).map((mailbox) => {
                const Icon = mailboxIcon(mailbox.path);
                return (
                  <Button
                    key={mailbox.path}
                    variant={selectedMailbox === mailbox.path ? "default" : "outline"}
                    size="sm"
                    className="h-8 shrink-0 px-2.5 text-xs"
                    onClick={() => {
                      setSelectedMailbox(mailbox.path);
                      setSelectedUid(null);
                      setReplyOpen(false);
                    }}
                  >
                    <Icon className="mr-1.5 h-3.5 w-3.5" />
                    {mailbox.label}
                  </Button>
                );
              })}
            </div>
          </ScrollArea>
          <div className="grid min-h-[22rem] h-[calc(100vh-12rem)] grid-cols-1 gap-2.5 md:grid-cols-[340px_1fr] xl:grid-cols-[380px_1fr]">

          {/* Email list */}
          <Card className="flex flex-col overflow-hidden">
            <div className="border-b px-2.5 py-2">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {selectedMailboxLabel}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {emails ? `${emails.length} berichten` : "Laden..."}
              </p>
            </div>
            <ScrollArea className="flex-1">
              {listLoading ? (
                <div className="space-y-1.5 p-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="space-y-1.5 rounded-md p-2">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-2.5 w-1/2" />
                      <Skeleton className="h-2.5 w-1/4" />
                    </div>
                  ))}
                </div>
              ) : listError && !isConfigError ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <AlertCircle className="h-8 w-8 text-destructive/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Kon inbox niet laden: {listError.message}
                  </p>
                </div>
              ) : !emails || emails.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Inbox className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Geen berichten gevonden</p>
                </div>
              ) : (
                <div>
                  {emails.map((email) => (
                    <button
                      key={email.uid}
                      onClick={() => {
                        setSelectedUid(email.uid);
                        setReplyOpen(false);
                      }}
                      className={cn(
                        "w-full border-b px-2.5 py-2 text-left transition-colors hover:bg-accent/50",
                        selectedUid === email.uid && "bg-accent",
                        !email.seen && "bg-primary/5",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {!email.seen && (
                              <Badge variant="default" className="h-4 px-1.5 text-[10px] shrink-0">
                                Nieuw
                              </Badge>
                            )}
                            <p
                              className={cn(
                                "truncate text-xs",
                                !email.seen ? "font-semibold" : "font-medium",
                              )}
                            >
                              {extractName(email.from)}
                            </p>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-foreground/80">
                            {email.subject}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                          {formatDate(email.date)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </Card>

          {/* Email detail */}
          <Card className="flex flex-col overflow-hidden">
            {selectedUid === null ? (
              composerOpen ? (
                <div className="flex h-full flex-col">
                  <div className="space-y-2.5 border-b p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold">Nieuw bericht opstellen</h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setComposerOpen(false);
                          setComposeError("");
                        }}
                      >
                        Sluiten
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="space-y-1">
                        <Label>Type</Label>
                        <Select
                          value={composeType}
                          onValueChange={(value) => handleApplyTemplate(value as MailType)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MAIL_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label>Template Studio</Label>
                          <Link href="/templates" className="text-xs text-primary hover:underline">
                            Beheren
                          </Link>
                        </div>
                        <TemplatePicker
                          value={composeTemplateId}
                          onValueChange={handleApplySavedTemplate}
                          templates={savedTemplates}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Lead in CRM</Label>
                        {composeLeadId ? (
                          <div className="rounded-md border bg-muted/30 px-2.5 py-2 text-xs">
                            <p className="font-medium text-foreground">
                              Automatisch gekoppeld:{" "}
                              {linkedFromComposeTo?.companyName || composeLeadSearch || "Lead"}
                            </p>
                            <Link
                              href={`/leads/${composeLeadId}`}
                              className="text-primary hover:underline"
                            >
                              Bekijk leadprofiel &amp; mailgeschiedenis
                            </Link>
                          </div>
                        ) : composeEmailValid ? (
                          <p className="text-[11px] text-muted-foreground">
                            Geen lead met dit e-mailadres — er wordt automatisch een lead aangemaakt bij verzenden.
                          </p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">
                            Vul een ontvangeradres in om de lead automatisch te koppelen.
                          </p>
                        )}
                        <details className="text-[11px] text-muted-foreground">
                          <summary className="cursor-pointer text-primary">Handmatig andere lead kiezen</summary>
                          <Input
                            className="mt-2 h-8"
                            value={composeLeadSearch}
                            onChange={(event) => {
                              setComposeLeadSearch(event.target.value);
                              setComposeStatus("draft");
                              if (!event.target.value) setComposeLeadId("");
                            }}
                            placeholder="Zoek lead op naam..."
                          />
                          {composeLeadsQuery.data?.items && composeLeadsQuery.data.items.length > 0 ? (
                            <div className="mt-1 max-h-28 overflow-y-auto rounded-md border bg-background">
                              {composeLeadsQuery.data.items.map((lead) => (
                                <button
                                  key={lead.id}
                                  type="button"
                                  className="flex w-full items-center justify-between px-2.5 py-1.5 text-left hover:bg-accent"
                                  onClick={() => handleSelectComposeLead(lead)}
                                >
                                  <span className="truncate font-medium">
                                    {lead.companyName || lead.website || "Onbekende lead"}
                                  </span>
                                  <span className="ml-2 truncate">{lead.email || "-"}</span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </details>
                      </div>
                      <div className="space-y-1">
                        <Label>Aan</Label>
                        <Input
                          type="email"
                          value={composeTo}
                          onChange={(event) => {
                            setComposeTo(event.target.value);
                            setComposeStatus("draft");
                          }}
                          placeholder="naam@bedrijf.be"
                          className={!composeTo || composeEmailValid ? "" : "border-destructive"}
                        />
                        {composeTo && !composeEmailValid ? (
                          <p className="text-[11px] text-destructive">Vul een geldig e-mailadres in.</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Onderwerp</Label>
                      <Input
                        value={composeSubject}
                        onChange={(event) => {
                          setComposeSubject(event.target.value);
                          setComposeStatus("draft");
                        }}
                        placeholder="Onderwerp"
                      />
                    </div>
                  </div>
                  <div className="flex-1 space-y-2 p-3">
                    <div className="rounded-md border bg-muted/30 p-2.5 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                        AI-assistent
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[140px] flex-1 space-y-1">
                          <Label className="text-[11px]">Stijl</Label>
                          <Select value={inboxAiStyle} onValueChange={setInboxAiStyle}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {INBOX_AI_STYLES.map((style) => (
                                <SelectItem key={style} value={style}>
                                  {style}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={rewriteInboxMessage.isPending}
                          onClick={handleAiCompose}
                        >
                          {rewriteInboxMessage.isPending ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 h-3.5 w-3.5" />
                          )}
                          {composeBody.trim() ? "Herschrijf met AI" : "Genereer met AI"}
                        </Button>
                      </div>
                    </div>
                    <Label>Bericht</Label>
                    <Textarea
                      value={composeBody}
                      onChange={(event) => {
                        setComposeBody(event.target.value);
                        setComposeStatus("draft");
                      }}
                      className="mt-1 h-full min-h-[190px] resize-none text-sm"
                      placeholder="Schrijf je bericht..."
                    />
                  </div>
                  <div className="space-y-2 border-t p-3">
                    <p className="text-xs text-muted-foreground">
                      Draft blijft lokaal staan tot je verzendt via Inbox SMTP.
                    </p>
                    {composeUnknownVariables.length > 0 ? (
                      <p className="text-xs text-destructive">
                        Onbekende placeholders: {composeUnknownVariables.map((key) => `{{${key}}}`).join(", ")}
                      </p>
                    ) : null}
                    <div className="flex items-center justify-end">
                      <Button
                        size="sm"
                        onClick={handleSendComposed}
                        disabled={sendEmail.isPending || !composeReady}
                      >
                        <Send className={cn("mr-2 h-4 w-4", sendEmail.isPending && "animate-pulse")} />
                        {sendEmail.isPending ? "Verzenden..." : "Verzend e-mail"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <Mail className="h-12 w-12 text-muted-foreground/20 mb-4" />
                  <p className="text-muted-foreground">
                    Selecteer een bericht om het te bekijken
                  </p>
                </div>
              )
            ) : messageLoading ? (
                <div className="space-y-3 p-4">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-1/3" />
                <Separator />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : messageError ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <AlertCircle className="h-8 w-8 text-destructive/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Kon bericht niet laden: {messageError.message}
                </p>
              </div>
            ) : message ? (
              <>
                {/* Header */}
                <div className="space-y-1 border-b p-3">
                  <h2 className="text-sm font-semibold">{message.subject}</h2>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">{extractName(message.from)}</span>
                      <span className="mx-1">&middot;</span>
                      <span>{message.fromAddress}</span>
                    </div>
                    <span>
                      {new Date(message.date).toLocaleDateString("nl-BE", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Aan: {message.to}
                  </div>
                  {linkedFromMessage ? (
                    <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2 text-xs">
                      <span className="text-muted-foreground">CRM: </span>
                      <Link
                        href={`/leads/${linkedFromMessage.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {linkedFromMessage.companyName}
                      </Link>
                      <span className="text-muted-foreground"> · mailgeschiedenis op leadprofiel</span>
                    </div>
                  ) : isValidEmail(message.fromAddress) ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Geen lead met {message.fromAddress} — wordt bij verzenden automatisch aangemaakt.
                    </p>
                  ) : null}
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(message.fromAddress)}
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Kopieer e-mail
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setReplyOpen((current) => !current)}
                    >
                      <Reply className="mr-1.5 h-3.5 w-3.5" />
                      {replyOpen ? "Verberg reply" : "Snel beantwoorden"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openComposerWithFollowUp}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Opvolgmail voorbereiden
                    </Button>
                    <a href={`mailto:${message.fromAddress}`} className="inline-flex">
                      <Button type="button" variant="outline" size="sm">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Open extern
                      </Button>
                    </a>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden">
                  {sanitizedMessageHtml ? (
                    <iframe
                      srcDoc={sanitizedMessageHtml}
                      sandbox=""
                      title="E-mail inhoud"
                      className="w-full h-full border-0"
                    />
                  ) : (
                    <ScrollArea className="h-full">
                      <div className="whitespace-pre-wrap p-3 text-sm">
                        {message.text || "(Geen inhoud)"}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                {/* Reply area */}
                <div className="space-y-2.5 border-t p-3">
                  {!replyOpen ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReplyOpen(true)}
                    >
                      <Reply className="mr-2 h-4 w-4" />
                      Beantwoorden
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground">
                        Antwoord aan: <span className="font-medium text-foreground">{message.fromAddress}</span>
                      </div>
                      <div className="rounded-md border bg-muted/30 p-2.5 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                          AI-antwoord
                        </div>
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="min-w-[140px] flex-1 space-y-1">
                            <Label className="text-[11px]">Stijl</Label>
                            <Select value={inboxAiStyle} onValueChange={setInboxAiStyle}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {INBOX_AI_STYLES.map((style) => (
                                  <SelectItem key={style} value={style}>
                                    {style}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={suggestReply.isPending || messageLoading}
                            onClick={handleAiReply}
                          >
                            {suggestReply.isPending ? (
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="mr-2 h-3.5 w-3.5" />
                            )}
                            {replyBody.trim() ? "Herschrijf antwoord" : "Antwoord op mail genereren"}
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          De AI leest de volledige inkomende mail en stelt een inhoudelijk antwoord voor.
                        </p>
                      </div>
                      <Textarea
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        placeholder="Schrijf je antwoord..."
                        rows={4}
                        className="resize-none"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={handleReply}
                          disabled={sendReply.isPending || !replyBody.trim()}
                        >
                          <Send className={cn("mr-2 h-4 w-4", sendReply.isPending && "animate-pulse")} />
                          {sendReply.isPending ? "Verzenden..." : "Verzenden"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setReplyOpen(false);
                            setReplyBody("");
                          }}
                        >
                          Annuleren
                        </Button>
                        {sendReply.error && (
                          <p className="text-sm text-destructive ml-2">
                            {sendReply.error.message}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </Card>
        </div>
        </div>
      )}
    </div>
  );
}
