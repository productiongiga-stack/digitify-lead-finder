"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Input,
  Checkbox,
} from "@digitify/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@digitify/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@digitify/ui";
import { EmptyState } from "@digitify/ui";
import { Mail, FileText, CheckCircle, Eye, Send, Inbox, ArrowRight, PenSquare, Trash2, X } from "lucide-react";
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
  const searchParams = useSearchParams();
  const leadIdFilter = searchParams.get("leadId") || undefined;
  const [statusFilter, setStatusFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [sendingDraftId, setSendingDraftId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.contact.listDrafts.useQuery({
    status: statusFilter || undefined,
    search: searchFilter.trim() || undefined,
    leadId: leadIdFilter,
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
  const deleteDraft = trpc.contact.deleteDraft.useMutation({
    onSuccess: (_data, variables) => {
      setSelectedDraftIds((current) => current.filter((id) => id !== variables.id));
      utils.contact.listDrafts.invalidate();
      utils.contact.getTopbarStats.invalidate();
    },
  });
  const bulkDeleteDrafts = trpc.contact.bulkDeleteDrafts.useMutation({
    onSuccess: () => {
      setSelectedDraftIds([]);
      utils.contact.listDrafts.invalidate();
      utils.contact.getTopbarStats.invalidate();
    },
  });
  const bulkSendDrafts = trpc.contact.bulkSendDrafts.useMutation({
    onSuccess: () => {
      setSelectedDraftIds([]);
      utils.contact.listDrafts.invalidate();
      utils.contact.getTopbarStats.invalidate();
    },
  });

  const drafts = data?.items ?? [];
  const selectedSet = new Set(selectedDraftIds);
  const selectableDrafts = drafts.filter((draft) => draft.status !== "SENDING");
  const selectedDrafts = drafts.filter((draft) => selectedSet.has(draft.id));
  const allVisibleSelected = selectableDrafts.length > 0 && selectableDrafts.every((draft) => selectedSet.has(draft.id));
  const sendableSelectedCount = selectedDrafts.filter((draft) => canSendOutboundDraft(draft.status)).length;
  const stats = {
    draft: drafts.filter((item) => item.status === "DRAFT").length,
    pending: drafts.filter((item) => item.status === "PENDING_APPROVAL").length,
    approved: drafts.filter((item) => item.status === "APPROVED").length,
    sent: drafts.filter((item) => item.status === "SENT").length,
    failed: drafts.filter((item) => item.status === "FAILED").length,
  };
  const activeFilterCount = (statusFilter ? 1 : 0) + (searchFilter.trim() ? 1 : 0);
  const nextActionHref =
    stats.pending > 0 ? "/contacts/approval" : stats.failed > 0 ? "/contacts" : "/contacts/compose";
  const nextActionLabel =
    stats.pending > 0 ? "Werk eerst de goedkeuringswachtrij af." : stats.failed > 0 ? "Los mislukte mails eerst op." : "Er is ruimte om nieuwe outreach op te starten.";
  const followUpItems = followUpQueue?.items ?? [];

  function toggleDraftSelection(id: string, checked: boolean) {
    setSelectedDraftIds((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((draftId) => draftId !== id),
    );
  }

  function toggleAllVisible(checked: boolean) {
    if (!checked) {
      setSelectedDraftIds((current) => current.filter((id) => !selectableDrafts.some((draft) => draft.id === id)));
      return;
    }
    setSelectedDraftIds((current) => Array.from(new Set([...current, ...selectableDrafts.map((draft) => draft.id)])));
  }

  function handleDeleteDraft(id: string) {
    if (!window.confirm("Wil je deze outbound e-mail verwijderen?")) return;
    deleteDraft.mutate({ id });
  }

  function handleBulkDelete() {
    if (selectedDraftIds.length === 0) return;
    if (!window.confirm(`${selectedDraftIds.length} outbound e-mail(s) verwijderen?`)) return;
    bulkDeleteDrafts.mutate({ ids: selectedDraftIds });
  }

  function handleBulkSend() {
    const ids = selectedDrafts.filter((draft) => canSendOutboundDraft(draft.status)).map((draft) => draft.id);
    if (ids.length === 0) return;
    bulkSendDrafts.mutate({ ids });
  }

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div className="app-page-heading">
          <h1 className="app-page-title">Outbound Center</h1>
          <p className="app-page-subtitle">
            Opstellen, goedkeuren en verzenden van outreach. Inkomende mail loopt via Inbox.
          </p>
        </div>
        <div className="app-page-actions">
          <Link href="/contacts/compose">
            <Button size="sm">
              <PenSquare className="mr-2 h-4 w-4" />
              Nieuwe E-mail
            </Button>
          </Link>
          <Link href="/contacts/templates">
            <Button variant="outline" size="sm">
              <FileText className="mr-2 h-4 w-4" />
              Templates
            </Button>
          </Link>
          <Link href="/contacts/approval">
            <Button variant="outline" size="sm">
              <CheckCircle className="mr-2 h-4 w-4" />
              Goedkeuringswachtrij
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={searchFilter}
            onChange={(event) => setSearchFilter(event.target.value)}
            placeholder="Zoek op lead, onderwerp of e-mail..."
            className="w-full sm:w-[280px]"
          />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-full sm:w-[190px]">
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter("");
                setSearchFilter("");
              }}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Filters wissen
            </Button>
          ) : null}
          {leadIdFilter ? (
            <>
              <Badge variant="outline" className="h-9 px-3">
                Lead filter actief
              </Badge>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/leads/${leadIdFilter}`}>Open lead</Link>
              </Button>
            </>
          ) : null}
        </div>
      </Card>

      {selectedDraftIds.length > 0 ? (
        <Card className="border-primary/30 bg-primary/5 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <span className="font-semibold">{selectedDraftIds.length}</span> e-mail(s) geselecteerd
              {sendableSelectedCount > 0 ? (
                <span className="ml-2 text-muted-foreground">{sendableSelectedCount} klaar om te verzenden</span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={handleBulkSend}
                disabled={bulkSendDrafts.isPending || sendableSelectedCount === 0}
              >
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Bulk verzenden
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={bulkDeleteDrafts.isPending}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Bulk verwijderen
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedDraftIds([])}>
                Selectie wissen
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

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

      </TabsContent>

      <TabsContent value="info" className="space-y-4">
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
      </TabsContent>

      <TabsContent value="overview" className="space-y-4">
      <Card>
        <div className="grid gap-3 p-3 md:hidden">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
          ) : (data?.items.length ?? 0) === 0 ? (
            <div className="rounded-xl border">
              <EmptyState icon={<Mail />} title="Nog geen e-mail drafts" size="sm" />
            </div>
          ) : (
            (data?.items ?? []).map((draft: NonNullable<typeof data>["items"][number]) => (
              <div key={draft.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 gap-2">
                    <Checkbox
                      checked={selectedSet.has(draft.id)}
                      onCheckedChange={(checked) => toggleDraftSelection(draft.id, Boolean(checked))}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                    <Link href={`/leads/${draft.lead.id}`} className="text-sm font-semibold hover:text-primary">
                      {draft.lead.companyName}
                    </Link>
                    <Link href={`/contacts/drafts/${draft.id}`} className="mt-1 block truncate text-xs text-muted-foreground hover:text-primary">
                      {draft.subject}
                    </Link>
                    </div>
                  </div>
                  <Badge variant={OUTBOUND_STATUS_VARIANTS[draft.status] || "secondary"}>
                    {OUTBOUND_STATUS_LABELS[draft.status] || draft.status}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {draft.author.name} · {formatDate(draft.createdAt)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/contacts/drafts/${draft.id}`}>
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      Open
                    </Link>
                  </Button>
                  {canSendOutboundDraft(draft.status) ? (
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
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      {sendEmail.isPending && sendingDraftId === draft.id
                        ? "Verzenden..."
                        : draft.status === "FAILED"
                          ? "Opnieuw verzenden"
                          : "Verzenden"}
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    disabled={deleteDraft.isPending}
                    onClick={() => handleDeleteDraft(draft.id)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Verwijder
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[42px]">
                <Checkbox checked={allVisibleSelected} onCheckedChange={(checked) => toggleAllVisible(Boolean(checked))} />
              </TableHead>
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
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <EmptyState icon={<Mail />} title="Nog geen e-mail drafts" size="sm" />
                </TableCell>
              </TableRow>
            ) : (
              data?.items.map((draft: NonNullable<typeof data>["items"][number]) => (
                <TableRow key={draft.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedSet.has(draft.id)}
                      onCheckedChange={(checked) => toggleDraftSelection(draft.id, Boolean(checked))}
                    />
                  </TableCell>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={deleteDraft.isPending}
                        onClick={() => handleDeleteDraft(draft.id)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Verwijder
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </Card>
      </TabsContent>
      </Tabs>
    </div>
  );
}
