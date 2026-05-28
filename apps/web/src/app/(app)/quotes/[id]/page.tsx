"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@digitify/ui";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  CheckCircle,
  XCircle,
  Trash2,
  Printer,
  Clock,
  FileText,
  AlertCircle,
  Activity,
  Link2,
  Pencil,
  ShieldCheck,
  MoreHorizontal,
  Inbox,
  StickyNote,
  MessageCircleQuestion,
} from "lucide-react";
import { useToast } from "@/components/feedback/toast-provider";
import { formatRelativeTime } from "@/lib/utils";

const STATUS_VARIANTS: Record<string, "secondary" | "info" | "warning" | "success" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  SENT: "info",
  VIEWED: "warning",
  ACCEPTED: "success",
  REJECTED: "destructive",
  EXPIRED: "outline",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Concept",
  SENT: "Verstuurd",
  VIEWED: "Bekeken",
  ACCEPTED: "Geaccepteerd",
  REJECTED: "Afgewezen",
  EXPIRED: "Verlopen",
};

function formatCurrency(amount: number) {
  return `\u20AC${amount.toFixed(2).replace(".", ",")}`;
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type QuoteNoteBlock =
  | { kind: "heading"; text: string }
  | { kind: "qa"; question: string; answer: string }
  | { kind: "text"; text: string };

function parseQuoteNotes(raw: string): QuoteNoteBlock[] {
  const blocks: QuoteNoteBlock[] = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const bulletQa = trimmed.match(/^-\s*(.+?):\s*(.+)$/);
    if (bulletQa) {
      blocks.push({ kind: "qa", question: bulletQa[1].trim(), answer: bulletQa[2].trim() });
      continue;
    }

    const inlineQa = trimmed.match(/^(.+\?):\s*(.+)$/);
    if (inlineQa) {
      blocks.push({ kind: "qa", question: inlineQa[1].trim(), answer: inlineQa[2].trim() });
      continue;
    }

    if (/offertevragen/i.test(trimmed) || (trimmed.endsWith(":") && trimmed.length < 80)) {
      blocks.push({ kind: "heading", text: trimmed.replace(/:$/, "") });
      continue;
    }

    blocks.push({ kind: "text", text: trimmed });
  }

  return blocks;
}

function QuoteNotesDisplay({ notes }: { notes: string }) {
  const blocks = parseQuoteNotes(notes);
  const hasStructuredQa = blocks.some((block) => block.kind === "qa");

  if (!hasStructuredQa) {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{notes}</p>
    );
  }

  const qaItems = blocks.filter((block): block is Extract<QuoteNoteBlock, { kind: "qa" }> => block.kind === "qa");
  const heading = blocks.find((block) => block.kind === "heading");
  const freeText = blocks.filter((block) => block.kind === "text");

  return (
    <div className="space-y-4">
      {heading ? (
        <div className="flex items-center gap-2">
          <MessageCircleQuestion className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">{heading.text}</p>
          <Badge variant="secondary" className="ml-auto tabular-nums">
            {qaItems.length} antwoord{qaItems.length === 1 ? "" : "en"}
          </Badge>
        </div>
      ) : null}

      <div className="quote-notes-qa-grid">
        {qaItems.map((item, index) => (
          <div key={`${item.question}-${index}`} className="quote-note-qa-item">
            <p className="quote-note-qa-question">{item.question}</p>
            <p className="quote-note-qa-answer">{item.answer}</p>
          </div>
        ))}
      </div>

      {freeText.length > 0 ? (
        <div className="space-y-1 rounded-xl border border-border/60 bg-muted/15 p-3">
          {freeText.map((block, index) => (
            <p key={index} className="text-sm leading-relaxed text-muted-foreground">
              {block.text}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function QuoteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const utils = trpc.useUtils();
  const { showToast } = useToast();

  const { data: quote, isLoading } = trpc.quote.getById.useQuery({ id });
  const { data: emailPreflight } = trpc.quote.emailPreflight.useQuery(
    { id },
    { enabled: Boolean(id) },
  );
  const { data: timeline } = trpc.quote.getTimeline.useQuery(
    { id },
    { enabled: Boolean(id) },
  );

  const updateStatusMutation = trpc.quote.updateStatus.useMutation({
    onSuccess: () => {
      utils.quote.getById.invalidate({ id });
      utils.quote.list.invalidate();
    },
  });

  const sendEmailMutation = trpc.quote.sendEmail.useMutation({
    onSuccess: () => {
      utils.quote.getById.invalidate({ id });
      utils.quote.emailPreflight.invalidate({ id });
      utils.quote.list.invalidate();
      showToast({
        title: "Ingediend ter goedkeuring",
        description: "De offerte staat in Outbound. Na goedkeuring kun je de mail verzenden.",
      });
    },
    onError: (error) => {
      showToast({
        title: "Indienen mislukt",
        description: error.message,
        variant: "error",
      });
    },
  });

  const deleteMutation = trpc.quote.delete.useMutation({
    onSuccess: () => {
      router.push("/quotes");
    },
  });

  const [internalNote, setInternalNote] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);
  const addNoteMutation = trpc.quote.addNote.useMutation({
    onSuccess: () => {
      setInternalNote("");
      utils.quote.getById.invalidate({ id });
    },
  });

  function handleStatusChange(status: "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "REJECTED" | "EXPIRED") {
    updateStatusMutation.mutate({ id, status });
  }

  function handleDelete() {
    if (confirm("Weet je zeker dat je deze offerte wilt verwijderen?")) {
      deleteMutation.mutate({ id });
    }
  }

  function handleAddNote() {
    if (!internalNote.trim()) return;
    addNoteMutation.mutate({ id, note: internalNote });
  }

  async function handleCopyPortalLink() {
    setPortalLoading(true);
    try {
      const response = await fetch(`/api/quotes/${id}/portal-link`);
      const payload = await response.json();
      if (!response.ok || !payload.url) {
        showToast({
          title: "Portal-link mislukt",
          description: payload.error || "Kon geen portal-link genereren.",
          variant: "error",
        });
        return;
      }
      await navigator.clipboard.writeText(payload.url);
      showToast({
        title: "Portal-link gekopieerd",
        description: "De klant kan nu quote, booking en bestanden beheren via de link.",
      });
    } finally {
      setPortalLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <FileText className="h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 text-sm font-medium">Offerte niet gevonden</p>
        <Link href="/quotes" className="mt-2">
          <Button variant="outline" size="sm">
            Terug naar offertes
          </Button>
        </Link>
      </div>
    );
  }

  const statusVariant = STATUS_VARIANTS[quote.status] ?? STATUS_VARIANTS.DRAFT;
  const statusLabel = STATUS_LABELS[quote.status] ?? quote.status;

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="quote-detail-header overflow-hidden border-border/60 bg-card/90 shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <Link href="/quotes" className="shrink-0">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" aria-label="Terug naar offertes">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div className="invoice-row-icon shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="max-w-full truncate text-xl font-semibold tracking-tight sm:text-2xl">
                    {quote.quoteNumber}
                  </h1>
                  <Badge variant={statusVariant} className="shrink-0">
                    {statusLabel}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {quote.clientCompany || quote.clientName}
                  <span className="mx-1.5 text-border">·</span>
                  Aangemaakt {formatDate(quote.createdAt)}
                </p>
              </div>
            </div>

            <div className="shrink-0 rounded-2xl border border-border/65 bg-background/80 px-4 py-3 text-left shadow-sm ring-1 ring-primary/10 lg:min-w-[180px] lg:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Totaal</p>
              <p className="mt-0.5 text-[2rem] font-bold tabular-nums leading-none tracking-tight">{formatCurrency(quote.total)}</p>
              <p className="mt-1 text-xs text-muted-foreground">incl. {quote.vatRate}% BTW</p>
            </div>
          </div>

          <div className="quote-detail-actions">
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm" className="h-9 rounded-xl">
                <Link href={`/quotes/new?quoteId=${encodeURIComponent(id)}`}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Bewerken
                </Link>
              </Button>

              {(quote.status === "SENT" || quote.status === "VIEWED") && (
                <>
                  <Button
                    size="sm"
                    className="h-9 rounded-xl"
                    onClick={() => handleStatusChange("ACCEPTED")}
                    disabled={updateStatusMutation.isPending}
                  >
                    <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                    Accepteer
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-9 rounded-xl"
                    onClick={() => handleStatusChange("REJECTED")}
                    disabled={updateStatusMutation.isPending}
                  >
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                    Afwijzen
                  </Button>
                </>
              )}

              <Button
                size="sm"
                variant="outline"
                className="h-9 rounded-xl"
                onClick={() => sendEmailMutation.mutate({ id })}
                disabled={sendEmailMutation.isPending || !emailPreflight?.canSend}
                title={
                  emailPreflight?.canSend
                    ? "Dien in bij Outbound ter goedkeuring"
                    : (emailPreflight?.blockingIssues || []).join(", ") || "Offerte is nog niet klaar om in te dienen"
                }
              >
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                {sendEmailMutation.isPending ? "Indienen..." : "Ter goedkeuring"}
              </Button>

              <Button asChild size="sm" variant="outline" className="h-9 rounded-xl">
                <Link href={`/api/quotes/${id}/pdf`} target="_blank">
                  <Printer className="mr-1.5 h-3.5 w-3.5" />
                  PDF
                </Link>
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="h-9 rounded-xl"
                onClick={handleCopyPortalLink}
                disabled={portalLoading}
              >
                <Link2 className="mr-1.5 h-3.5 w-3.5" />
                {portalLoading ? "..." : "Portal"}
              </Button>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 rounded-xl px-2.5">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Meer acties</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/contacts/approval">
                    <Inbox className="mr-2 h-4 w-4" />
                    Outbound-wachtrij
                  </Link>
                </DropdownMenuItem>
                {quote.status === "DRAFT" ? (
                  <DropdownMenuItem
                    onClick={() => handleStatusChange("SENT")}
                    disabled={updateStatusMutation.isPending}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Markeer als verstuurd
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Verwijder offerte
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* 2-Column Layout */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-5 lg:col-span-2">
          {/* Client Info */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Klantgegevens</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium">{quote.clientName}</p>
                  {quote.clientCompany && (
                    <p className="text-sm text-muted-foreground">{quote.clientCompany}</p>
                  )}
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {quote.clientEmail && <p>{quote.clientEmail}</p>}
                  {quote.clientPhone && <p>{quote.clientPhone}</p>}
                  {quote.clientAddress && <p>{quote.clientAddress}</p>}
                  {quote.clientVat && <p>BTW: {quote.clientVat}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead>Omschrijving</TableHead>
                    <TableHead className="text-right">Aantal</TableHead>
                    <TableHead className="text-right">Prijs/stuk</TableHead>
                    <TableHead className="text-right">Totaal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quote.items?.map((item: NonNullable<typeof quote.items>[number], index: number) => (
                    <TableRow key={item.id ?? index}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Totals */}
              <div className="border-t p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotaal</span>
                  <span className="font-medium">{formatCurrency(quote.subtotal)}</span>
                </div>
                {quote.discount > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Korting</span>
                    <span className="font-medium">-{formatCurrency(quote.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>BTW ({quote.vatRate}%)</span>
                  <span className="font-medium">{formatCurrency(quote.vatAmount)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-base font-bold">
                  <span>Totaal</span>
                  <span>{formatCurrency(quote.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes & Terms */}
          {(quote.notes || quote.terms) && (
            <Card className="border-border/50 shadow-sm">
              {quote.notes ? (
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <StickyNote className="h-4 w-4 text-primary" />
                    Notities
                  </CardTitle>
                </CardHeader>
              ) : null}
              <CardContent className={quote.notes ? "space-y-6 pt-0" : "space-y-4 pt-6"}>
                {quote.notes ? <QuoteNotesDisplay notes={quote.notes} /> : null}
                {quote.terms ? (
                  <div className={quote.notes ? "border-t border-border/60 pt-5" : undefined}>
                    <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      Voorwaarden
                    </p>
                    <p className="whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/15 p-3 text-sm leading-relaxed text-muted-foreground">
                      {quote.terms}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Verzend-preflight</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(emailPreflight?.checks || []).map((check) => (
                <div key={check.key} className="flex items-start justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{check.label}</p>
                    <p className="text-xs text-muted-foreground">{check.detail}</p>
                  </div>
                  <Badge variant={check.ok ? "success" : "destructive"}>
                    {check.ok ? "OK" : "Fout"}
                  </Badge>
                </div>
              ))}
              {(emailPreflight?.warnings || []).length > 0 ? (
                <div className="rounded-md border border-amber-400/50 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                  {(emailPreflight?.warnings || []).map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              ) : null}
              {!emailPreflight?.canSend ? (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>
                    Los de preflight-items op om de offerte per e-mail te verzenden.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Status Timeline */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Status Geschiedenis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { label: "Aangemaakt", date: quote.createdAt },
                  ...(quote.sentAt ? [{ label: "Verstuurd", date: quote.sentAt }] : []),
                  ...(quote.acceptedAt ? [{ label: "Geaccepteerd", date: quote.acceptedAt }] : []),
                  ...(quote.rejectedAt ? [{ label: "Afgewezen", date: quote.rejectedAt }] : []),
                ].map((entry, index, arr) => (
                  <div key={index} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {index < arr.length - 1 && (
                        <div className="w-px flex-1 bg-border mt-1" />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium">{entry.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(entry.date)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Aanpassingen & Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!timeline || timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nog geen extra activiteit geregistreerd.</p>
              ) : (
                <div className="space-y-4">
                  {timeline.slice(0, 8).map((entry: NonNullable<typeof timeline>[number], index: number) => (
                    <div key={entry.id || index} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {index < Math.min(timeline.length, 8) - 1 ? (
                          <div className="mt-1 w-px flex-1 bg-border" />
                        ) : null}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-medium">{entry.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.user?.name ? `${entry.user.name} · ` : ""}
                          {formatRelativeTime(entry.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Internal Notes */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Interne Notities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {quote.internalNotes && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-sm whitespace-pre-wrap">{quote.internalNotes}</p>
                </div>
              )}

              <div className="space-y-2">
                <Textarea
                  placeholder="Voeg een interne notitie toe..."
                  rows={3}
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddNote}
                  disabled={!internalNote.trim() || addNoteMutation.isPending}
                >
                  {addNoteMutation.isPending ? "Bezig..." : "Notitie Toevoegen"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
