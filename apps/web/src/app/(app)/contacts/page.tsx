"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@digitify/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@digitify/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@digitify/ui";
import { Mail, FileText, CheckCircle, Eye, Send, Inbox, ArrowRight, PenSquare } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { EmailPreview } from "@/components/email/preview";
import { extractEmailTemplateMetadata } from "@/lib/email-content";
import {
  OUTBOUND_STATUS_LABELS,
  OUTBOUND_STATUS_OPTIONS,
  OUTBOUND_STATUS_VARIANTS,
  canSendOutboundDraft,
} from "@/lib/contact-status";

export default function ContactsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [sendingDraftId, setSendingDraftId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.contact.listDrafts.useQuery({
    status: statusFilter || undefined,
    page: 1,
    pageSize: 50,
  });

  const { data: brandingSettings } = trpc.settings.getAll.useQuery(undefined, {
    staleTime: 60_000,
  });
  const { data: followUpQueue } = trpc.contact.getFollowUpQueue.useQuery(undefined, {
    staleTime: 60_000,
  });

  const brandCompanyName = brandingSettings?.["branding.company_name"]
    ? String(brandingSettings["branding.company_name"])
    : "";
  const brandPrimaryColor = brandingSettings?.["branding.primary_color"]
    ? String(brandingSettings["branding.primary_color"])
    : "#6366f1";
  const brandHeaderSlogan = brandingSettings?.["email.header_slogan"]
    ? String(brandingSettings["email.header_slogan"])
    : "";

  const sendEmail = trpc.contact.sendEmail.useMutation({
    onSuccess: () => {
      utils.contact.listDrafts.invalidate();
    },
  });

  const drafts = data?.items ?? [];
  const stats = {
    draft: drafts.filter((item) => item.status === "DRAFT").length,
    pending: drafts.filter((item) => item.status === "PENDING_APPROVAL").length,
    approved: drafts.filter((item) => item.status === "APPROVED").length,
    sent: drafts.filter((item) => item.status === "SENT").length,
    failed: drafts.filter((item) => item.status === "FAILED").length,
  };
  const activeFilterCount = statusFilter ? 1 : 0;
  const nextActionHref =
    stats.pending > 0 ? "/contacts/approval" : stats.failed > 0 ? "/contacts" : "/contacts/compose";
  const nextActionLabel =
    stats.pending > 0 ? "Werk eerst de goedkeuringswachtrij af." : stats.failed > 0 ? "Los mislukte mails eerst op." : "Er is ruimte om nieuwe outreach op te starten.";
  const followUpItems = followUpQueue?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Outbound Center</h1>
          <p className="text-sm text-muted-foreground">
            Opstellen, goedkeuren en verzenden van outreach. Inkomende mail loopt via Inbox.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/contacts/compose">
            <Button>
              <PenSquare className="mr-2 h-4 w-4" />
              Nieuwe E-mail
            </Button>
          </Link>
          <Link href="/contacts/templates">
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Templates
            </Button>
          </Link>
          <Link href="/contacts/approval">
            <Button variant="outline">
              <CheckCircle className="mr-2 h-4 w-4" />
              Goedkeuringswachtrij
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardContent className="p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Concept</p>
            <p className="mt-1 text-lg font-semibold">{stats.draft}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Wacht op goedkeuring</p>
            <p className="mt-1 text-lg font-semibold">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Goedgekeurd</p>
            <p className="mt-1 text-lg font-semibold">{stats.approved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Verzonden</p>
            <p className="mt-1 text-lg font-semibold">{stats.sent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Mislukt</p>
            <p className="mt-1 text-lg font-semibold">{stats.failed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Inkomend</p>
            <Link href="/contacts/inbox" className="mt-1 inline-flex items-center text-sm font-medium text-primary hover:underline">
              Open Inbox
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed">
        <CardContent className="p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Flow:</span> Concept -&gt; Goedkeuring -&gt; Verzenden.{" "}
          <span className="font-medium text-foreground">Tip:</span> status <span className="font-medium">Mislukt</span> kan je opnieuw verzenden na correctie van SMTP/domein.
        </CardContent>
      </Card>

      <div className="grid gap-3 xl:grid-cols-3">
        <Card className="border-emerald-200 bg-emerald-50/80 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Volgende actie</p>
            <p className="mt-2 text-sm font-medium">{nextActionLabel}</p>
            <Button asChild size="sm" variant="outline" className="mt-3">
              <Link href={nextActionHref}>
                {stats.pending > 0 ? "Open goedkeuringswachtrij" : stats.failed > 0 ? "Open mislukte mails" : "Nieuwe e-mail maken"}
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/80 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Werkqueue</p>
            <p className="mt-2 text-sm font-medium">
              {stats.pending} wachten op goedkeuring · {stats.approved} klaar om te verzenden · {stats.failed} mislukt
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Zo zie je sneller waar de outreachflow vandaag blijft hangen.
            </p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/80 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gerelateerd</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/contacts/templates">Templates</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/settings/integrations">SMTP & inbox</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Follow-up herinneringen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {followUpItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Geen follow-ups die vandaag aandacht vragen. Nieuwe reminders worden opgebouwd op basis van verzonden mails en het ingestelde interval van {followUpQueue?.followupDays ?? 3} dagen.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Deze leads kregen al een mail en zijn na {followUpQueue?.followupDays ?? 3} dagen nog niet verder geraakt in de pipeline.
              </p>
              <div className="grid gap-2">
                {followUpItems.map((item) => (
                  <div key={item.id} className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <Link href={`/leads/${item.lead.id}`} className="text-sm font-medium hover:text-primary">
                        {item.lead.companyName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {item.subject} · {item.daysSinceSent} dagen geleden verzonden
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/contacts/compose?leadId=${item.lead.id}`}>Nieuwe follow-up</Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/leads/${item.lead.id}`}>Open lead</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter op status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle statussen</SelectItem>
              {OUTBOUND_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link href="/contacts/inbox">
            <Button variant="ghost" size="sm">
              <Inbox className="mr-1.5 h-3.5 w-3.5" />
              Naar Inbox
            </Button>
          </Link>
          {activeFilterCount > 0 ? (
            <Badge variant="outline" className="h-9 px-3">
              Filter: {OUTBOUND_STATUS_LABELS[statusFilter] || statusFilter}
            </Badge>
          ) : null}
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Onderwerp</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Auteur</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead className="text-right">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Mail className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Nog geen e-mail drafts</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data?.items.map((draft: NonNullable<typeof data>["items"][number]) => (
                <TableRow key={draft.id}>
                  <TableCell>
                    <Link href={`/leads/${draft.lead.id}`} className="font-medium hover:text-primary">
                      {draft.lead.companyName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/contacts/drafts/${draft.id}`} className="text-sm font-medium hover:text-primary hover:underline">
                      {draft.subject}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={OUTBOUND_STATUS_VARIANTS[draft.status] || "secondary"}>
                      {OUTBOUND_STATUS_LABELS[draft.status] || draft.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {draft.author.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(draft.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Preview button */}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Eye className="mr-1 h-3.5 w-3.5" />
                            Preview
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>E-mail preview</DialogTitle>
                          </DialogHeader>
                          <EmailPreview
                            subject={draft.subject}
                            body={extractEmailTemplateMetadata(draft.body).cleanBody}
                            companyName={brandCompanyName}
                            primaryColor={brandPrimaryColor}
                            fromName={draft.author.name || brandCompanyName}
                            headerSlogan={brandHeaderSlogan}
                            recipientCompany={draft.lead.companyName}
                            layout={extractEmailTemplateMetadata(draft.body).layout}
                          />
                        </DialogContent>
                      </Dialog>

                      {canSendOutboundDraft(draft.status) && (
                        <Button
                          variant="default"
                          size="sm"
                          disabled={sendEmail.isPending}
                          onClick={() => {
                            setSendingDraftId(draft.id);
                            sendEmail.mutate(
                              { id: draft.id },
                              {
                                onSettled: () => {
                                  setSendingDraftId(null);
                                },
                              },
                            );
                          }}
                        >
                          <Send className="mr-1 h-3.5 w-3.5" />
                          {sendEmail.isPending && sendingDraftId === draft.id
                            ? "Verzenden..."
                            : draft.status === "FAILED"
                              ? "Opnieuw verzenden"
                              : "Verzenden"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
