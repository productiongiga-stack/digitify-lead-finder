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
} from "lucide-react";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import { EmailPreview } from "@/components/email/preview";
import { extractEmailTemplateMetadata, injectEmailTemplateMetadata, type EmailLayout } from "@/lib/email-content";
import {
  OUTBOUND_STATUS_LABELS,
  OUTBOUND_STATUS_VARIANTS,
  OUTBOUND_TIMELINE_STEPS,
  canSendOutboundDraft,
  getOutboundTimelineStatus,
} from "@/lib/contact-status";

export default function DraftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const { data: draft, isLoading } = trpc.contact.getDraftById.useQuery({ id });

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
  const followupDays = brandingSettings?.["email.followup_days"]
    ? Math.max(1, Number.parseInt(String(brandingSettings["email.followup_days"]), 10) || 3)
    : 3;

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [emailLayout, setEmailLayout] = useState<EmailLayout>("modern");
  const [rewriteStyle, setRewriteStyle] = useState("Korter");
  const [rewriteResult, setRewriteResult] = useState<{ subject: string; body: string } | null>(null);

  useEffect(() => {
    if (!draft || initialized) return;
    const parsed = extractEmailTemplateMetadata(draft.body);
    setSubject(draft.subject);
    setBody(parsed.cleanBody);
    setToEmail(draft.toEmail);
    setEmailLayout(parsed.layout || "proposal");
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
      if (data.rewritten) {
        setRewriteResult(data.rewritten);
      }
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

  const isEditable = draft.status === "DRAFT" || draft.status === "REJECTED";
  const draftBodyForSave = injectEmailTemplateMetadata(body, { layout: emailLayout });
  const hasChanges = subject !== draft.subject || draftBodyForSave !== draft.body || toEmail !== draft.toEmail;
  const draftId = draft.id;
  const { activeIndex, rejected } = getOutboundTimelineStatus(draft.status);
  const recommendedFollowUpDate = draft.sentAt
    ? new Date(new Date(draft.sentAt).getTime() + followupDays * 24 * 60 * 60 * 1000)
    : null;
  const followUpDue =
    recommendedFollowUpDate ? recommendedFollowUpDate.getTime() <= Date.now() : false;

  function handleSave() {
    updateDraft.mutate({
      id: draftId,
      subject,
      body: draftBodyForSave,
      toEmail,
    });
  }

  function handleSubmit() {
    // Save first if there are changes, then submit
    if (hasChanges) {
      updateDraft.mutate(
        { id: draftId, subject, body: draftBodyForSave, toEmail },
        {
          onSuccess: () => {
            submitForApproval.mutate({ id: draftId });
          },
        }
      );
    } else {
      submitForApproval.mutate({ id: draftId });
    }
  }

  function handleReject() {
    reject.mutate({ id: draftId, note: rejectNote || undefined });
  }

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
            {draft.lead.companyName} &mdash; {draft.toEmail}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
                Goedkeuren
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
              disabled={sendEmail.isPending}
              onClick={() => sendEmail.mutate({ id: draftId })}
            >
              {sendEmail.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {sendEmail.isPending ? "Verzenden..." : draft.status === "FAILED" ? "Opnieuw verzenden" : "Verzenden"}
            </Button>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {OUTBOUND_TIMELINE_STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = index <= activeIndex;
              const isCurrent = index === activeIndex;
              const isRejectedStep = index === 2 && rejected;

              return (
                <div key={step.key} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                        isRejectedStep
                          ? "border-destructive bg-destructive/10 text-destructive"
                          : isCurrent
                            ? "border-primary bg-primary text-primary-foreground"
                            : isActive
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-muted-foreground/30 text-muted-foreground/30"
                      }`}
                    >
                      {isRejectedStep ? (
                        <XCircle className="h-4 w-4" />
                      ) : (
                        <StepIcon className="h-4 w-4" />
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        isRejectedStep
                          ? "text-destructive"
                          : isActive
                            ? "text-foreground"
                            : "text-muted-foreground/50"
                      }`}
                    >
                      {isRejectedStep ? "Afgekeurd" : step.label}
                    </span>
                    {/* Timestamp under the step */}
                    {index === 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(draft.createdAt)}
                      </span>
                    )}
                    {index === 2 && draft.approvedAt && !rejected && (
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(draft.approvedAt)}
                      </span>
                    )}
                    {index === 2 && draft.rejectedAt && rejected && (
                      <span className="text-[10px] text-destructive/70">
                        {formatDate(draft.rejectedAt)}
                      </span>
                    )}
                    {index === 3 && draft.sentAt && (
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(draft.sentAt)}
                      </span>
                    )}
                  </div>
                  {index < OUTBOUND_TIMELINE_STEPS.length - 1 && (
                    <div
                      className={`mx-2 h-0.5 flex-1 rounded-full ${
                        index < activeIndex
                          ? isRejectedStep || (index === 1 && rejected)
                            ? "bg-destructive/40"
                            : "bg-primary/40"
                          : "bg-muted-foreground/20"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 xl:grid-cols-3">
        <Card className="border-emerald-200 bg-emerald-50/80 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Volgende actie</p>
            <p className="mt-2 text-sm font-medium">
              {draft.status === "DRAFT"
                ? "Werk inhoud af en dien in ter goedkeuring."
                : draft.status === "PENDING_APPROVAL"
                  ? "Wacht op review of keur dit als admin meteen goed."
                  : draft.status === "APPROVED"
                    ? "Deze draft is klaar om te verzenden."
                    : draft.status === "SENT"
                      ? "Volg de reactie op en plan indien nodig een opvolgmail."
                      : draft.status === "FAILED"
                        ? "Controleer foutmelding en probeer opnieuw te verzenden."
                        : "Controleer deze draft en bepaal de volgende stap."}
            </p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/80 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reminder</p>
            <p className="mt-2 text-sm font-medium">
              {recommendedFollowUpDate
                ? `Aanbevolen opvolging op ${recommendedFollowUpDate.toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" })}`
                : `Standaard follow-up interval is ${followupDays} dagen na verzending.`}
            </p>
            {draft.status === "SENT" ? (
              <p className={`mt-1 text-xs ${followUpDue ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
                {followUpDue
                  ? "Deze follow-up is nu aan de beurt."
                  : "Zodra dit moment bereikt is, verschijnt deze lead ook in de follow-up queue."}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/80 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gerelateerd</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/contacts/compose?leadId=${draft.lead.id}`}>Nieuwe mail voor lead</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/contacts">Outbound center</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rejection note */}
      {draft.status === "REJECTED" && draft.rejectionNote && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <XCircle className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">Afgekeurd</p>
              <p className="mt-1 text-sm text-muted-foreground">{draft.rejectionNote}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {(draft.status === "FAILED" || draft.status === "BOUNCED") && (
        <Card className="border-amber-300/70 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Verzending mislukt
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {draft.rejectionNote || "Controleer SMTP, DKIM/SPF en ontvangeradres. Daarna kan je opnieuw verzenden."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approval info */}
      {draft.status === "APPROVED" && draft.approvedAt && (
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
          <CardContent className="flex items-start gap-3 p-4">
            <CheckCircle className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Goedgekeurd</p>
              <p className="mt-1 text-sm text-muted-foreground">
                op {formatDate(draft.approvedAt)}
              </p>
            </div>
          </CardContent>
        </Card>
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
                <Link href={`/leads/${draft.lead.id}`} className="font-medium hover:text-primary">
                  {draft.lead.companyName}
                </Link>
              </div>
              {draft.lead.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{draft.lead.email}</span>
                </div>
              )}
              {draft.lead.city && (
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
                    disabled={rewriteDraft.isPending || !body}
                    onClick={() => {
                      setRewriteResult(null);
                      rewriteDraft.mutate({ draftId: id, style: rewriteStyle });
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

                {rewriteDraft.error && (
                  <p className="text-sm text-destructive">{rewriteDraft.error.message}</p>
                )}

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
                <Label>Layout</Label>
                <Select value={emailLayout} onValueChange={(v) => setEmailLayout(v as typeof emailLayout)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="modern">Modern (standaard)</SelectItem>
                    <SelectItem value="minimal">Minimalistisch</SelectItem>
                    <SelectItem value="business">Zakelijk</SelectItem>
                    <SelectItem value="proposal">Voorstel</SelectItem>
                    <SelectItem value="followup">Follow-up</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <EmailPreview
                subject={subject}
                body={body}
                companyName={brandCompanyName}
                primaryColor={brandPrimaryColor}
                fromName={draft.author.name || brandCompanyName}
                headerSlogan={brandHeaderSlogan}
                recipientCompany={draft.lead.companyName}
                layout={emailLayout}
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
                    <span className="text-muted-foreground">Goedgekeurd op</span>
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
