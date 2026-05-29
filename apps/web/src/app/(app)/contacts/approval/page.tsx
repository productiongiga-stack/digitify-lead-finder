"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Button,
  Card,
  CardContent,
  Badge,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
  Textarea,
  Label,
} from "@digitify/ui";
import { CheckCircle, XCircle, Eye, Inbox, Mail, FileText, Clock, User, AtSign, Pencil } from "lucide-react";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import Link from "next/link";
import { EmailPreview } from "@/components/email/preview";
import { OutboundWorkflowHelp } from "@/components/outbound/outbound-workflow-help";
import { extractEmailTemplateMetadata } from "@/lib/email-content";
import { OUTBOUND_STATUS_LABELS, OUTBOUND_STATUS_VARIANTS } from "@/lib/contact-status";
import { extractQuoteIdFromDraftBody, getQuoteConfiguratorUrl } from "@/lib/quote-outbound";

export default function ApprovalPage() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.contact.listDrafts.useQuery({
    status: "PENDING_APPROVAL",
    page: 1,
    pageSize: 50,
  });

  const { data: brandingSettings } = trpc.settings.getAll.useQuery(undefined, {
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

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");

  const approve = trpc.contact.approve.useMutation({
    onSuccess: () => utils.contact.listDrafts.invalidate(),
  });

  const reject = trpc.contact.reject.useMutation({
    onSuccess: () => {
      utils.contact.listDrafts.invalidate();
      setRejectDialogOpen(false);
      setRejectingId(null);
      setRejectionNote("");
    },
  });

  function openRejectDialog(id: string) {
    setRejectingId(id);
    setRejectionNote("");
    setRejectDialogOpen(true);
  }

  function handleReject() {
    if (!rejectingId) return;
    reject.mutate({
      id: rejectingId,
      note: rejectionNote.trim() || undefined,
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Goedkeuringswachtrij</h1>
        <p className="text-sm text-muted-foreground">
          Keur inhoud goed — verzending gebeurt apart via Outbound Center
        </p>
      </div>

      <OutboundWorkflowHelp />

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : data?.items.length === 0 ? (
        <Card>
          <CardContent className="flex h-48 flex-col items-center justify-center">
            <Inbox className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">Geen e-mails wachten op goedkeuring</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Alles is verwerkt. Nieuwe e-mails verschijnen hier automatisch.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data?.items.map((draft: NonNullable<typeof data>["items"][number]) => {
            const parsedDraft = extractEmailTemplateMetadata(draft.body);
            const quoteId = draft.type === "QUOTE" ? extractQuoteIdFromDraftBody(draft.body) : null;
            const isQuoteDraft = draft.type === "QUOTE";

            return (
              <Card key={draft.id} className="approval-queue-item overflow-hidden">
                <CardContent className="p-0">
                  <div className="approval-queue-item-header">
                    <div
                      className={`approval-queue-item-icon ${isQuoteDraft ? "approval-queue-item-icon-quote" : ""}`}
                    >
                      {isQuoteDraft ? <FileText className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={draft.lead ? `/leads/${draft.lead.id}` : "#"}
                          className="text-sm font-semibold hover:text-primary"
                        >
                          {draft.lead?.companyName ?? draft.toEmail}
                        </Link>
                        <Badge variant={OUTBOUND_STATUS_VARIANTS.PENDING_APPROVAL}>
                          {OUTBOUND_STATUS_LABELS.PENDING_APPROVAL}
                        </Badge>
                        {isQuoteDraft ? (
                          <Badge
                            variant="outline"
                            className="border-amber-300/70 bg-amber-50/80 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
                          >
                            Offerte-e-mail
                          </Badge>
                        ) : null}
                      </div>
                      <Link
                        href={`/contacts/drafts/${draft.id}`}
                        className="mt-1 block text-base font-semibold leading-snug hover:text-primary"
                      >
                        {draft.subject}
                      </Link>
                    </div>
                  </div>

                  <div className="space-y-3 px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <AtSign className="h-3.5 w-3.5 shrink-0" />
                        {draft.toEmail}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        {draft.author.name}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        {formatRelativeTime(draft.createdAt)} · {formatDate(draft.createdAt)}
                      </span>
                    </div>

                    <div className="approval-queue-item-excerpt">
                      <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                        {parsedDraft.cleanBody}
                      </p>
                    </div>
                  </div>

                  <div className="approval-queue-item-actions">
                    <div className="flex flex-wrap gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Eye className="mr-1.5 h-3.5 w-3.5" />
                            Preview
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>E-mail preview</DialogTitle>
                          </DialogHeader>
                          <EmailPreview
                            subject={draft.subject}
                            body={parsedDraft.cleanBody}
                            companyName={brandCompanyName}
                            primaryColor={brandPrimaryColor}
                            fromName={draft.author.name || brandCompanyName}
                            headerSlogan={brandHeaderSlogan}
                            recipientCompany={draft.lead?.companyName ?? draft.toEmail}
                            layout={parsedDraft.layout}
                          />
                        </DialogContent>
                      </Dialog>

                      <Button asChild variant="outline" size="sm">
                        <Link href={`/contacts/drafts/${draft.id}`}>
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />
                          Bewerken
                        </Link>
                      </Button>

                      {quoteId ? (
                        <Button asChild variant="outline" size="sm">
                          <Link href={getQuoteConfiguratorUrl(quoteId, `/contacts/drafts/${draft.id}`)}>
                            <FileText className="mr-1.5 h-3.5 w-3.5" />
                            Offerte aanpassen
                          </Link>
                        </Button>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <Button
                        size="sm"
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={() => approve.mutate({ id: draft.id })}
                        disabled={approve.isPending}
                      >
                        <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                        {approve.isPending ? "Bezig..." : "Goedkeuren"}
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => openRejectDialog(draft.id)}
                        disabled={reject.isPending}
                      >
                        <XCircle className="mr-1.5 h-3.5 w-3.5" />
                        Afkeuren
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={rejectDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRejectDialogOpen(false);
            setRejectingId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>E-mail afkeuren</DialogTitle>
            <DialogDescription>
              Geef optioneel een reden op waarom deze e-mail wordt afgekeurd.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="rejection-note">Reden (optioneel)</Label>
              <Textarea
                id="rejection-note"
                placeholder="Bijv. toon aanpassen, meer personalisatie nodig..."
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectingId(null);
              }}
            >
              Annuleren
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={reject.isPending}>
              {reject.isPending ? "Afkeuren..." : "Afkeuren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
