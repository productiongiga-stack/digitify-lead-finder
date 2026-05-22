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
import { CheckCircle, XCircle, Eye, Inbox } from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { EmailPreview } from "@/components/email/preview";
import { OutboundWorkflowHelp } from "@/components/outbound/outbound-workflow-help";
import { extractEmailTemplateMetadata } from "@/lib/email-content";
import { OUTBOUND_STATUS_LABELS, OUTBOUND_STATUS_VARIANTS } from "@/lib/contact-status";

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

      <div className="grid gap-3 xl:grid-cols-3">
        <Card className="border-emerald-200 bg-emerald-50/80 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Open items</p>
            <p className="mt-2 text-2xl font-bold">{data?.items.length ?? 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Werk deze wachtrij af voor je nieuwe outreach uitstuurd.
            </p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/80 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Beslis sneller</p>
            <p className="mt-2 text-sm font-medium">
              Goedkeuren maakt de mail klaar om te verzenden. Klik daarna op Verzenden in Outbound Center.
            </p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/80 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gerelateerde acties</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/contacts">Outbound center</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/templates">Templates</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
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
            return (
            <Card key={draft.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Link href={`/leads/${draft.lead.id}`} className="font-medium hover:text-primary">
                        {draft.lead.companyName}
                      </Link>
                      <Badge variant={OUTBOUND_STATUS_VARIANTS.PENDING_APPROVAL}>
                        {OUTBOUND_STATUS_LABELS.PENDING_APPROVAL}
                      </Badge>
                    </div>
                    <p className="text-sm font-semibold">{draft.subject}</p>
                    <p className="text-xs text-muted-foreground">Naar: {draft.toEmail}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{parsedDraft.cleanBody}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Door: {draft.author.name}</span>
                      <span>{formatDate(draft.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {/* Preview Dialog */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
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
                          body={parsedDraft.cleanBody}
                          companyName={brandCompanyName}
                          primaryColor={brandPrimaryColor}
                          fromName={draft.author.name || brandCompanyName}
                          headerSlogan={brandHeaderSlogan}
                          recipientCompany={draft.lead.companyName}
                          layout={parsedDraft.layout}
                        />
                      </DialogContent>
                    </Dialog>

                    <Button
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={() => approve.mutate({ id: draft.id })}
                      disabled={approve.isPending}
                    >
                      <CheckCircle className="mr-1 h-3.5 w-3.5" />
                      {approve.isPending ? "..." : "Goedkeuren (niet verzenden)"}
                    </Button>

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => openRejectDialog(draft.id)}
                      disabled={reject.isPending}
                    >
                      <XCircle className="mr-1 h-3.5 w-3.5" />
                      Afkeuren
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )})}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={(open) => { if (!open) { setRejectDialogOpen(false); setRejectingId(null); } }}>
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
            <Button variant="outline" onClick={() => { setRejectDialogOpen(false); setRejectingId(null); }}>
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
