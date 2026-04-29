"use client";

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { findUnknownMailVariables } from "@/lib/mail-variables";
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
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
  const { data: savedTemplates } = trpc.contact.listTemplates.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
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

  const sendReply = trpc.inbox.reply.useMutation({
    onSuccess: () => {
      setReplyBody("");
      setReplyOpen(false);
      setComposeStatus("replied");
      utils.inbox.list.invalidate();
    },
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
      utils.inbox.list.invalidate();
    },
    onError: (err) => {
      setComposeStatus("failed");
      setComposeError(err.message);
    },
  });

  // Write HTML into sandboxed iframe
  useEffect(() => {
    if (message?.html && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #333; padding: 16px; margin: 0; line-height: 1.6; }
              img { max-width: 100%; height: auto; }
              a { color: #6366f1; }
              pre, code { white-space: pre-wrap; word-break: break-all; }
            </style>
          </head>
          <body>${message.html}</body>
          </html>
        `);
        doc.close();
      }
    }
  }, [message?.html]);

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
    window.localStorage.setItem("digitify_inbox_compose_draft", JSON.stringify(payload));
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
    if (templateId === "none") return;
    const template = (savedTemplates || []).find((item) => item.id === templateId);
    if (!template) return;
    setComposeSubject(template.subject || "");
    setComposeBody(template.body || "");
    setComposeStatus("draft");
  }

  function handleSendComposed() {
    if (!composeLeadId) {
      setComposeStatus("failed");
      setComposeError("Koppel eerst een lead voor je verzendt.");
      return;
    }
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
      body: composeBody,
      type: composeType,
      leadId: composeLeadId,
    });
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
  const composeEmailValid = isValidEmail(composeTo);
  const composeReady =
    Boolean(composeLeadId) &&
    composeEmailValid &&
    Boolean(composeSubject.trim()) &&
    Boolean(composeBody.trim()) &&
    composeUnknownVariables.length === 0;
  const unreadCount = (emails || []).filter((email) => !email.seen).length;
  const selectedMessageFrom = message?.fromAddress || "";

  function openComposerWithFollowUp() {
    if (!message) return;
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
        <div className="flex items-center gap-2">
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

      {!isConfigError ? (
        <div className="grid gap-3 xl:grid-cols-4">
          <Card className="border-emerald-200 bg-emerald-50/80 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Huidige mailbox</p>
            <p className="mt-2 text-sm font-medium">{selectedMailboxLabel}</p>
          </Card>
          <Card className="border-blue-200 bg-blue-50/80 p-4 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ongelezen</p>
            <p className="mt-2 text-2xl font-bold">{unreadCount}</p>
          </Card>
          <Card className="border-amber-200 bg-amber-50/80 p-4 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Compose status</p>
            <p className="mt-2 text-sm font-medium">
              {composeStatus === "draft"
                ? "Je hebt een lokaal inbox-concept openstaan."
                : composeStatus === "queued"
                  ? "Bericht wordt verwerkt."
                  : composeStatus === "failed"
                    ? "Laatste actie mislukte."
                    : "Geen open inbox-concept."}
            </p>
          </Card>
          <Card className="border-violet-200 bg-violet-50/80 p-4 shadow-sm dark:border-violet-900/40 dark:bg-violet-950/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Snelle acties</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/contacts">Outbound center</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/settings/integrations">Integraties</Link>
              </Button>
            </div>
          </Card>
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
                      <div className="space-y-1">
                        <Label>Template</Label>
                        <Select value={composeTemplateId} onValueChange={handleApplySavedTemplate}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Geen template" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Geen template</SelectItem>
                            {(savedTemplates || []).map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Lead koppeling (verplicht)</Label>
                        <Input
                          value={composeLeadSearch}
                          onChange={(event) => {
                            setComposeLeadSearch(event.target.value);
                            setComposeStatus("draft");
                            if (!event.target.value) setComposeLeadId("");
                          }}
                          placeholder="Zoek lead op naam..."
                        />
                        {composeLeadId ? (
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant="outline">Lead gekoppeld</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[11px]"
                              onClick={() => {
                                setComposeLeadId("");
                                setComposeLeadSearch("");
                              }}
                            >
                              Ontkoppelen
                            </Button>
                          </div>
                        ) : (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Selecteer eerst een lead. Verzenden zonder lead-koppeling is geblokkeerd.
                          </p>
                        )}
                        {composeLeadsQuery.data?.items && composeLeadsQuery.data.items.length > 0 ? (
                          <div className="mt-1 max-h-36 overflow-y-auto rounded-md border bg-background">
                            {composeLeadsQuery.data.items.map((lead) => (
                              <button
                                key={lead.id}
                                type="button"
                                className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs hover:bg-accent"
                                onClick={() => handleSelectComposeLead(lead)}
                              >
                                <span className="truncate font-medium">
                                  {lead.companyName || lead.website || "Onbekende lead"}
                                </span>
                                <span className="ml-2 truncate text-muted-foreground">
                                  {lead.email || "-"}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null}
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
                  <div className="flex-1 p-3">
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
                  {message.html ? (
                    <iframe
                      ref={iframeRef}
                      sandbox="allow-same-origin"
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
