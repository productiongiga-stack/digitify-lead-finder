"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc/client";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Input,
  Textarea,
  Label,
  Skeleton,
  Separator,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@digitify/ui";
import {
  ArrowLeft,
  Save,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Building2,
  Mail,
  MapPin,
  Loader2,
  AlertTriangle,
  Eye,
  Sparkles,
  Receipt,
} from "lucide-react";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import {
  extractQuoteIdFromDraftBody,
  getQuoteConfiguratorUrl,
} from "@/lib/quote-outbound";
import { useShellEmailPreviewProps } from "@/lib/outbound-email-settings";
import { EmailPreview } from "@/components/email/preview";
import { OutboundDraftTimeline } from "@/components/outbound/outbound-draft-timeline";
import {
  OutboundDraftStatusBanner,
  getOutboundFailureAction,
} from "@/components/outbound/outbound-draft-status-banner";
import { applyEmailTemplateSelection } from "@/lib/apply-email-template";
import { TemplatePicker } from "@/components/templates/template-picker";
import { extractEmailTemplateMetadata, injectEmailTemplateMetadata } from "@/lib/email-content";
import {
  OUTBOUND_STATUS_LABELS,
  OUTBOUND_STATUS_VARIANTS,
  SEND_OUTBOUND_TOOLTIP,
  canSendOutboundDraft,
  canEditOutboundDraft,
  getApprovedNotSentBanner,
  getOutboundStatusLabel,
  getSendButtonLabel,
} from "@/lib/contact-status";

export default function DraftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = role === "OWNER" || role === "ADMIN";

  const { data: draft, isLoading } = trpc.contact.getDraftById.useQuery({ id });

  const shellPreview = useShellEmailPreviewProps();
  const { data: templateData } = trpc.template.list.useQuery({ forOutbound: true });
  const templates = templateData?.templates ?? [];

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [bodyFormat, setBodyFormat] = useState<"TEXT" | "HTML">("TEXT");
  const [rewriteStyle, setRewriteStyle] = useState("Korter");
  const [rewriteResult, setRewriteResult] = useState<{ subject: string; body: string } | null>(null);
  const [rewriteError, setRewriteError] = useState("");

  useEffect(() => {
    if (!draft || initialized) return;
    const parsed = extractEmailTemplateMetadata(draft.body);
    setSubject(draft.subject);
    setBody(parsed.cleanBody);
    setToEmail(draft.toEmail);
    setCtaText(parsed.ctaText);
    setCtaUrl(parsed.ctaUrl);
    setBodyFormat(parsed.bodyFormat === "HTML" ? "HTML" : "TEXT");
    setSelectedTemplateId(draft.templateId || "");
    setInitialized(true);
  }, [draft, initialized]);

  const updateDraft = trpc.contact.updateDraft.useMutation({
    onSuccess: () => {
      utils.contact.getDraftById.invalidate({ id });
    },
  });

  const submitForApproval = trpc.contact.submitForApproval.useMutation({
    onSuccess: () => {
      utils.contact.getDraftById.invalidate({ id });
    },
  });

  const approve = trpc.contact.approve.useMutation({
    onSuccess: () => {
      utils.contact.getDraftById.invalidate({ id });
    },
  });

  const reject = trpc.contact.reject.useMutation({
    onSuccess: () => {
      utils.contact.getDraftById.invalidate({ id });
      setRejectOpen(false);
      setRejectNote("");
    },
  });

  const sendEmail = trpc.contact.sendEmail.useMutation({
    onSuccess: () => {
      utils.contact.getDraftById.invalidate({ id });
    },
  });

  const rewriteDraft = trpc.openclaw.rewriteDraft.useMutation({
    onSuccess: (data) => {
      if (data.error) {
        setRewriteError(data.error);
        setRewriteResult(null);
        return;
      }
      if (data.rewritten) {
        setRewriteError("");
        setRewriteResult(data.rewritten);
      }
    },
    onError: (error) => {
      setRewriteError(error.message);
      setRewriteResult(null);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertTriangle className="mb-4 h-12 w-12 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Draft niet gevonden</p>
        <Link href="/contacts" className="mt-4">
          <Button variant="outline">Terug naar overzicht</Button>
        </Link>
      </div>
    );
  }

  const isEditable = canEditOutboundDraft(draft.status);
  const draftBodyForSave = injectEmailTemplateMetadata(body, {
    ctaText,
    ctaUrl,
    bodyFormat,
  });
  const selectedTemplateForSave =
    selectedTemplateId && selectedTemplateId !== "none" ? selectedTemplateId : null;
  const hasChanges =
    subject !== draft.subject ||
    draftBodyForSave !== draft.body ||
    toEmail !== draft.toEmail ||
    selectedTemplateForSave !== (draft.templateId || null);
  const draftId = draft.id;

  function handleTemplateSelect(templateId: string) {
    if (!isEditable) return;
    setSelectedTemplateId(templateId);
    if (templateId === "none") return;
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    const applied = applyEmailTemplateSelection(template);
    setSubject(applied.subject);
    setBody(applied.body);
    setBodyFormat(applied.bodyFormat);
    setCtaText(applied.ctaText);
    setCtaUrl(applied.ctaUrl);
  }

  function handleSave() {
    updateDraft.mutate({
      id: draftId,
      subject,
      body: draftBodyForSave,
      toEmail,
      templateId: selectedTemplateForSave,
    });
  }

  function handleSubmit() {
    const payload = {
      id: draftId,
      subject,
      body: draftBodyForSave,
      toEmail,
      templateId: selectedTemplateForSave,
    };
    if (hasChanges) {
      updateDraft.mutate(payload, {
        onSuccess: () => {
          submitForApproval.mutate({ id: draftId });
        },
      });
    } else {
      submitForApproval.mutate({ id: draftId });
    }
  }

  function handleReject() {
    reject.mutate({ id: draftId, note: rejectNote || undefined });
  }

  const linkedQuoteId =
    draft?.type === "QUOTE" ? extractQuoteIdFromDraftBody(draft.body) : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/contacts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">E-mail Draft</h1>
            <Badge variant={OUTBOUND_STATUS_VARIANTS[draft.status] || "secondary"}>
              {OUTBOUND_STATUS_LABELS[draft.status] || draft.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {draft.lead?.companyName ?? "Geen lead"} &mdash; {draft.toEmail}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {linkedQuoteId ? (
            <Button asChild variant="outline">
              <Link href={getQuoteConfiguratorUrl(linkedQuoteId, `/contacts/drafts/${draftId}`)}>
                <Receipt className="mr-2 h-4 w-4" />
                Offerte in configurator
              </Link>
            </Button>
          ) : null}
          {isEditable && (
            <>
              <Button
                variant="outline"
                disabled={!hasChanges || updateDraft.isPending}
                onClick={handleSave}
              >
                {updateDraft.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Opslaan
              </Button>
              {draft.status === "DRAFT" && (
                <Button
                  disabled={submitForApproval.isPending}
                  onClick={handleSubmit}
                >
                  {submitForApproval.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Ter goedkeuring indienen
                </Button>
              )}
            </>
          )}
          {draft.status === "PENDING_APPROVAL" && isAdmin && (
            <>
              <Button
                variant="default"
                disabled={approve.isPending}
                onClick={() => approve.mutate({ id: draftId })}
              >
                {approve.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Goedkeuren (niet verzenden)
              </Button>
              <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive">
                    <XCircle className="mr-2 h-4 w-4" />
                    Afkeuren
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>E-mail afkeuren</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Reden (optioneel)</Label>
                      <Textarea
                        placeholder="Waarom wordt deze e-mail afgekeurd?"
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRejectOpen(false)}>
                      Annuleren
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={reject.isPending}
                      onClick={handleReject}
                    >
                      {reject.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Afkeuren
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
          {canSendOutboundDraft(draft.status) && (
            <Button
              title={SEND_OUTBOUND_TOOLTIP}
              disabled={sendEmail.isPending}
              onClick={() => sendEmail.mutate({ id: draftId })}
            >
              {sendEmail.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {getSendButtonLabel(draft.status, sendEmail.isPending)}
            </Button>
          )}
        </div>
      </div>

      {linkedQuoteId ? (
        <Card className="border-amber-200/70 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Dit is een offerte-mail. Pas regels, prijzen en klantgegevens aan via de configurator —
            de outbound-mail wordt automatisch bijgewerkt.
          </CardContent>
        </Card>
      ) : null}

      <OutboundDraftTimeline
        status={draft.status}
        createdAt={draft.createdAt}
        approvedAt={draft.approvedAt}
        rejectedAt={draft.rejectedAt}
        sentAt={draft.sentAt}
      />

      {draft.status === "REJECTED" && draft.rejectionNote && (
        <OutboundDraftStatusBanner
          variant="error"
          title={getOutboundStatusLabel("REJECTED")}
          detail={draft.rejectionNote}
        />
      )}

      {(draft.status === "FAILED" || draft.status === "BOUNCED") && (
        <OutboundDraftStatusBanner
          variant="warning"
          title="Verzending mislukt"
          detail={
            draft.rejectionNote ||
            "Controleer SMTP, DKIM/SPF en ontvangeradres. Daarna kan je opnieuw verzenden."
          }
          action={getOutboundFailureAction(
            draft.rejectionNote ||
              "Controleer SMTP, DKIM/SPF en ontvangeradres. Daarna kan je opnieuw verzenden.",
          )}
        />
      )}

      {draft.status === "APPROVED" && draft.approvedAt && (
        <OutboundDraftStatusBanner
          variant="success"
          title={getApprovedNotSentBanner().title}
          detail={getApprovedNotSentBanner().detail(formatDate(draft.approvedAt))}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left: Edit form */}
        <div className="space-y-5">
          {/* Lead info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Lead informatie</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {draft.lead ? (
                  <Link href={`/leads/${draft.lead.id}`} className="font-medium hover:text-primary">
                    {draft.lead.companyName}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Geen gekoppelde lead</span>
                )}
              </div>
              {draft.lead?.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{draft.lead.email}</span>
                </div>
              )}
              {draft.lead?.city && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{draft.lead.city}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Editable fields */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">E-mail inhoud</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {draft.status === "APPROVED" ? (
                <p className="rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                  Na opslaan gaat deze mail terug naar concept en moet opnieuw goedgekeurd worden voordat je kunt verzenden.
                </p>
              ) : null}
              {draft.status === "PENDING_APPROVAL" ? (
                <p className="rounded-lg border border-blue-200/80 bg-blue-50/70 px-3 py-2 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-100">
                  Wijzigingen worden opgeslagen terwijl de mail in de goedkeuringswachtrij blijft staan.
                </p>
              ) : null}
              <div className="space-y-2">
                <Label>Aan</Label>
                <Input
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  disabled={!isEditable}
                  placeholder="email@voorbeeld.be"
                />
              </div>
              <div className="space-y-2">
                <Label>Onderwerp</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={!isEditable}
                  placeholder="Onderwerp..."
                />
              </div>
              <div className="space-y-2">
                <Label>Inhoud</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  disabled={!isEditable}
                  className="min-h-[320px] font-mono text-sm"
                  placeholder="E-mail inhoud..."
                />
              </div>
            </CardContent>
          </Card>

          {/* AI Rewrite */}
          {isEditable && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <CardTitle className="text-sm">AI Herschrijf</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-2">
                    <Label>Stijl</Label>
                    <Select value={rewriteStyle} onValueChange={setRewriteStyle}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Korter">Korter</SelectItem>
                        <SelectItem value="Professioneler">Professioneler</SelectItem>
                        <SelectItem value="Warmer">Warmer</SelectItem>
                        <SelectItem value="Directer">Directer</SelectItem>
                        <SelectItem value="Overtuigender">Overtuigender</SelectItem>
                        <SelectItem value="Meer sales-gericht">Meer sales-gericht</SelectItem>
                        <SelectItem value="Vriendelijker">Vriendelijker</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    disabled={rewriteDraft.isPending || !body.trim()}
                    onClick={() => {
                      setRewriteResult(null);
                      setRewriteError("");
                      rewriteDraft.mutate({
                        draftId: id,
                        style: rewriteStyle,
                        subject: subject.trim(),
                        body: body.trim(),
                      });
                    }}
                  >
                    {rewriteDraft.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Herschrijf met AI
                  </Button>
                </div>

                {rewriteError ? (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {rewriteError}
                  </p>
                ) : null}

                {rewriteResult && (
                  <div className="space-y-3 rounded-md border bg-muted/50 p-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Nieuw onderwerp</Label>
                      <p className="text-sm font-medium">{rewriteResult.subject}</p>
                    </div>
                    <Separator />
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Nieuwe inhoud</Label>
                      <p className="whitespace-pre-wrap text-sm">{rewriteResult.body}</p>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSubject(rewriteResult.subject);
                          setBody(rewriteResult.body);
                          setRewriteResult(null);
                        }}
                      >
                        <CheckCircle className="mr-1 h-3.5 w-3.5" />
                        Toepassen
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRewriteResult(null)}
                      >
                        Annuleren
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Preview + Activity */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm">Preview</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>E-mailtemplate</Label>
                  <Link href="/templates" className="text-xs text-primary hover:underline">
                    Beheren
                  </Link>
                </div>
                <TemplatePicker
                  value={selectedTemplateId || "none"}
                  onValueChange={handleTemplateSelect}
                  templates={templates}
                  emptyLabel="Geen template"
                  placeholder="Kies een template..."
                  disabled={!isEditable}
                />
                <p className="text-xs text-muted-foreground">
                  Unieke inhoud per lead; opmaak volgt je workspace-instellingen onder Instellingen → E-mail.
                </p>
              </div>
              <EmailPreview
                subject={subject}
                body={body}
                companyName={shellPreview.companyName}
                primaryColor={shellPreview.primaryColor}
                fromName={draft.author.name || shellPreview.fromName}
                headerSlogan={shellPreview.headerSlogan}
                recipientCompany={draft.lead?.companyName ?? draft.toEmail}
                bodyFormat={bodyFormat}
                ctaText={ctaText}
                ctaUrl={ctaUrl}
                logoUrl={shellPreview.logoUrl}
                masterShellHtml={shellPreview.masterShellHtml}
                signature={shellPreview.signature}
                footer={shellPreview.footer}
              />
            </CardContent>
          </Card>

          {/* Activity / Meta */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Activiteit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Aangemaakt door</span>
                <span className="font-medium">{draft.author.name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Aangemaakt op</span>
                <span className="font-medium">{formatDate(draft.createdAt)}</span>
                <span className="text-xs text-muted-foreground">
                  ({formatRelativeTime(draft.createdAt)})
                </span>
              </div>
              {draft.status === "SENT" && draft.sentAt && (
                <div className="flex items-center gap-2 text-sm">
                  <Send className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Verzonden op</span>
                  <span className="font-medium">{formatDate(draft.sentAt)}</span>
                </div>
              )}
              {draft.approvedAt && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span className="text-muted-foreground">Beoordeeld op</span>
                    <span className="font-medium">{formatDate(draft.approvedAt)}</span>
                  </div>
                </>
              )}
              {draft.rejectedAt && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="text-muted-foreground">Afgekeurd op</span>
                    <span className="font-medium">{formatDate(draft.rejectedAt)}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mutation error display */}
      {(updateDraft.error || submitForApproval.error || approve.error || reject.error || sendEmail.error) && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">Fout</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {updateDraft.error?.message ||
                  submitForApproval.error?.message ||
                  approve.error?.message ||
                  reject.error?.message ||
                  sendEmail.error?.message}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
