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
import {
  CheckCircle,
  Eye,
  FileText,
  Inbox,
  Mail,
  PenSquare,
  Search,
  Send,
  Trash2,
  X,
  Receipt,
  LayoutGrid,
  Info,
  CalendarDays,
} from "lucide-react";
import { OutboundAgendaPanel } from "@/components/outbound/outbound-agenda-panel";
import {
  OUTBOUND_EMAIL_TYPE_OPTIONS,
  OUTBOUND_SOURCE_MODULE_OPTIONS,
  getOutboundEmailTypeLabel,
  getOutboundSourceModuleLabel,
} from "@/lib/outbound-source";
import { formatDate } from "@/lib/utils";
import { EmailPreview } from "@/components/email/preview";
import { extractEmailTemplateMetadata } from "@/lib/email-content";
import {
  type OutboundStatCardStatus,
  OUTBOUND_STATUS_LABELS,
  OUTBOUND_STATUS_OPTIONS,
  OUTBOUND_STATUS_VARIANTS,
  SEND_OUTBOUND_TOOLTIP,
  canSendOutboundDraft,
  canEditOutboundDraft,
  getOutboundStatusLabel,
  getOutboundStatusForDisplay,
  getSendButtonLabel,
} from "@/lib/contact-status";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { OutboundInfoPanel } from "@/components/outbound/outbound-info-panel";
import {
  extractQuoteIdFromDraftBody,
  getQuoteConfiguratorUrl,
} from "@/lib/quote-outbound";
import { useShellEmailPreviewProps } from "@/lib/outbound-email-settings";

function QuoteConfiguratorButton({
  draft,
}: {
  draft: { id: string; type: string; body: string };
}) {
  if (draft.type !== "QUOTE") return null;
  const quoteId = extractQuoteIdFromDraftBody(draft.body);
  if (!quoteId) return null;

  return (
    <Button asChild variant="outline" size="sm">
      <Link href={getQuoteConfiguratorUrl(quoteId, `/contacts/drafts/${draft.id}`)}>
        <Receipt className="mr-1.5 h-3.5 w-3.5" />
        Configurator
      </Link>
    </Button>
  );
}

export function ContactsPageInner() {
  const searchParams = useSearchParams();
  const leadIdFilter = searchParams.get("leadId") || undefined;
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [sendingDraftId, setSendingDraftId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<null | { mode: "single"; id: string } | { mode: "bulk" }>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const utils = trpc.useUtils();

  const overviewQuery = {
    status: statusFilter || undefined,
    search: searchFilter.trim() || undefined,
    leadId: leadIdFilter,
    type: typeFilter ? (typeFilter as "LEAD_CONTACT") : undefined,
    sourceModule: sourceFilter ? (sourceFilter as "campaign") : undefined,
    page: 1,
    pageSize: 50,
  } as const;

  const { data: overview, isLoading } = trpc.contact.getOverview.useQuery(overviewQuery, {
    staleTime: 60_000,
    refetchOnMount: false,
  });

  const shellPreview = useShellEmailPreviewProps();
  const data = overview?.drafts;
  const followUpQueue = overview?.followUpQueue;
  const topbarStats = overview?.topbarStats;

  const invalidateOutbound = () => {
    utils.contact.getOverview.invalidate();
    utils.contact.getOutboundStats.invalidate();
    utils.contact.listAgenda.invalidate();
  };

  const sendEmail = trpc.contact.sendEmail.useMutation({
    onSuccess: invalidateOutbound,
  });
  const deleteDraft = trpc.contact.deleteDraft.useMutation({
    onSuccess: (_data, variables) => {
      setSelectedDraftIds((current) => current.filter((id) => id !== variables.id));
      invalidateOutbound();
    },
  });
  const bulkDeleteDrafts = trpc.contact.bulkDeleteDrafts.useMutation({
    onSuccess: () => {
      setSelectedDraftIds([]);
      invalidateOutbound();
    },
  });
  const bulkSendDrafts = trpc.contact.bulkSendDrafts.useMutation({
    onSuccess: () => {
      setSelectedDraftIds([]);
      invalidateOutbound();
    },
  });

  const drafts = data?.items ?? [];
  const selectedSet = new Set(selectedDraftIds);
  const selectableDrafts = drafts.filter((draft) => draft.status !== "SENDING");
  const selectedDrafts = drafts.filter((draft) => selectedSet.has(draft.id));
  const allVisibleSelected = selectableDrafts.length > 0 && selectableDrafts.every((draft) => selectedSet.has(draft.id));
  const sendableSelectedCount = selectedDrafts.filter((draft) => canSendOutboundDraft(draft.status)).length;
  const activeFilterCount =
    (statusFilter ? 1 : 0) +
    (searchFilter.trim() ? 1 : 0) +
    (sourceFilter ? 1 : 0) +
    (typeFilter ? 1 : 0);
  const followUpItems = followUpQueue?.items ?? [];

  function handleStatusCardClick(status: OutboundStatCardStatus) {
    setStatusFilter((current) => (current === status ? "" : status));
    setActiveTab("overview");
  }

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
    setDeleteConfirm({ mode: "single", id });
  }

  function handleBulkDelete() {
    if (selectedDraftIds.length === 0) return;
    setDeleteConfirm({ mode: "bulk" });
  }

  function handleBulkSend() {
    const ids = selectedDrafts.filter((draft) => canSendOutboundDraft(draft.status)).map((draft) => draft.id);
    if (ids.length === 0) return;
    bulkSendDrafts.mutate({ ids });
  }

  return (
    <div className="app-page">
      <ConfirmDialog
        open={Boolean(deleteConfirm)}
        title={deleteConfirm?.mode === "bulk" ? "Outbound e-mails verwijderen?" : "Outbound e-mail verwijderen?"}
        description={
          deleteConfirm?.mode === "bulk"
            ? `${selectedDraftIds.length} geselecteerde e-mail(s) worden permanent verwijderd.`
            : "Deze e-mail wordt permanent verwijderd uit het outbound center."
        }
        confirmLabel="Verwijderen"
        loading={deleteDraft.isPending || bulkDeleteDrafts.isPending}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}
        onConfirm={() => {
          if (!deleteConfirm) return;
          if (deleteConfirm.mode === "single") {
            deleteDraft.mutate({ id: deleteConfirm.id });
          } else {
            bulkDeleteDrafts.mutate({ ids: selectedDraftIds });
          }
          setDeleteConfirm(null);
        }}
      />
      <div className="app-page-header">
        <div className="app-page-heading">
          <h1 className="app-page-title">Outbound Center</h1>
          <p className="app-page-subtitle">
            Concept → goedkeuren → verzenden. Goedkeuren stuurt nog niet; gebruik Verzenden voor SMTP.
          </p>
        </div>
        <div className="app-page-actions">
          <Link href="/contacts/compose">
            <Button size="sm">
              <PenSquare className="mr-2 h-4 w-4" />
              Nieuwe E-mail
            </Button>
          </Link>
          <Link href="/templates">
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="page-view-tabs">
          <TabsTrigger value="overview" className="page-view-tabs-trigger">
            <LayoutGrid />
            Overzicht
          </TabsTrigger>
          <TabsTrigger value="agenda" className="page-view-tabs-trigger">
            <CalendarDays />
            Agenda
          </TabsTrigger>
          <TabsTrigger value="info" className="page-view-tabs-trigger">
            <Info />
            Info
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
      <div className="app-page-filters">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchFilter}
              onChange={(event) => setSearchFilter(event.target.value)}
              placeholder="Zoek lead, onderwerp of e-mail…"
              className="h-9 min-w-0 border-border/70 bg-background/80 pl-9 shadow-none"
            />
          </div>
          <Select
            value={statusFilter || "all"}
            onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-9 w-full border-border/70 bg-background/80 shadow-none sm:w-[210px]">
              <SelectValue placeholder="Alle statussen" />
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
          <Select
            value={sourceFilter || "all"}
            onValueChange={(v) => setSourceFilter(v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-9 w-full border-border/70 bg-background/80 shadow-none sm:w-[200px]">
              <SelectValue placeholder="Module" />
            </SelectTrigger>
            <SelectContent>
              {OUTBOUND_SOURCE_MODULE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={typeFilter || "all"}
            onValueChange={(v) => setTypeFilter(v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-9 w-full border-border/70 bg-background/80 shadow-none sm:w-[190px]">
              <SelectValue placeholder="Mailtype" />
            </SelectTrigger>
            <SelectContent>
              {OUTBOUND_EMAIL_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 lg:border-l lg:border-border/50 lg:pl-4">
          <Button asChild variant="outline" size="sm" className="h-9 border-border/70 bg-background/80 shadow-none">
            <Link href="/contacts/inbox">
              <Inbox className="mr-1.5 h-4 w-4" />
              Inbox
            </Link>
          </Button>
          {activeFilterCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-muted-foreground"
              onClick={() => {
                setStatusFilter("");
                setSearchFilter("");
                setSourceFilter("");
                setTypeFilter("");
              }}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Filters wissen
            </Button>
          ) : null}
          {leadIdFilter ? (
            <>
              <Badge variant="secondary" className="h-9 px-2.5 text-xs">
                Leadfilter actief
              </Badge>
              <Button asChild variant="ghost" size="sm" className="h-9">
                <Link href={`/leads/${leadIdFilter}`}>Open lead</Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {selectedDraftIds.length > 0 ? (
        <Card className="border-primary/30 bg-primary/5 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <span className="font-semibold">{selectedDraftIds.length}</span> e-mail(s) geselecteerd
              {sendableSelectedCount > 0 ? (
                <span className="ml-2 text-muted-foreground">
                  {sendableSelectedCount} {OUTBOUND_STATUS_LABELS.APPROVED!.toLowerCase()}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                title={SEND_OUTBOUND_TOOLTIP}
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
                    {draft.lead ? (
                      <Link href={`/leads/${draft.lead.id}`} className="text-sm font-semibold hover:text-primary">
                        {draft.lead.companyName}
                      </Link>
                    ) : (
                      <span className="text-sm font-semibold text-muted-foreground">{draft.toEmail}</span>
                    )}
                    <Link href={`/contacts/drafts/${draft.id}`} className="mt-1 block truncate text-xs text-muted-foreground hover:text-primary">
                      {draft.subject}
                    </Link>
                    </div>
                  </div>
                  <Badge
                    variant={
                      OUTBOUND_STATUS_VARIANTS[getOutboundStatusForDisplay(draft.status)] || "secondary"
                    }
                    className="whitespace-nowrap px-3 py-1 text-xs font-semibold"
                  >
                    {getOutboundStatusLabel(draft.status, draft.scheduledFor)}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {draft.author.name} · {formatDate(draft.createdAt)}
                  {"sourceModule" in draft && draft.sourceModule ? (
                    <> · {getOutboundSourceModuleLabel(String(draft.sourceModule))}</>
                  ) : null}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {canEditOutboundDraft(draft.status) ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/contacts/drafts/${draft.id}`}>
                        <PenSquare className="mr-1.5 h-3.5 w-3.5" />
                        Bewerken
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/contacts/drafts/${draft.id}`}>
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        Open
                      </Link>
                    </Button>
                  )}
                  <QuoteConfiguratorButton draft={draft} />
                  {canSendOutboundDraft(draft.status) ? (
                    <Button
                      variant="default"
                      size="sm"
                      title={SEND_OUTBOUND_TOOLTIP}
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
                      {getSendButtonLabel(
                        draft.status,
                        sendEmail.isPending && sendingDraftId === draft.id,
                      )}
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
              <TableHead>Module</TableHead>
              <TableHead>Auteur</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead className="text-right">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
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
                    {draft.lead ? (
                      <Link href={`/leads/${draft.lead.id}`} className="font-medium hover:text-primary">
                        {draft.lead.companyName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{draft.toEmail}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link href={`/contacts/drafts/${draft.id}`} className="text-sm font-medium hover:text-primary hover:underline">
                      {draft.subject}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        OUTBOUND_STATUS_VARIANTS[getOutboundStatusForDisplay(draft.status)] || "secondary"
                      }
                      className="whitespace-nowrap px-3 py-1 text-xs font-semibold"
                    >
                      {getOutboundStatusLabel(draft.status, draft.scheduledFor)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {"sourceModule" in draft
                      ? getOutboundSourceModuleLabel(String(draft.sourceModule))
                      : "—"}
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
                            companyName={shellPreview.companyName}
                            primaryColor={shellPreview.primaryColor}
                            fromName={draft.author.name || shellPreview.fromName}
                            headerSlogan={shellPreview.headerSlogan}
                            recipientCompany={draft.lead?.companyName ?? draft.toEmail}
                            logoUrl={shellPreview.logoUrl}
                            masterShellHtml={shellPreview.masterShellHtml}
                            signature={shellPreview.signature}
                            footer={shellPreview.footer}
                          />
                        </DialogContent>
                      </Dialog>

                      {canEditOutboundDraft(draft.status) ? (
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/contacts/drafts/${draft.id}`}>
                            <PenSquare className="mr-1 h-3.5 w-3.5" />
                            Bewerken
                          </Link>
                        </Button>
                      ) : null}

                      <QuoteConfiguratorButton draft={draft} />

                      {canSendOutboundDraft(draft.status) && (
                        <Button
                          variant="default"
                          size="sm"
                          title={SEND_OUTBOUND_TOOLTIP}
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
                          {getSendButtonLabel(
                            draft.status,
                            sendEmail.isPending && sendingDraftId === draft.id,
                          )}
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

      <TabsContent value="agenda" className="space-y-4">
        {activeTab === "agenda" ? <OutboundAgendaPanel /> : null}
      </TabsContent>

      <TabsContent value="info" className="space-y-4">
        {activeTab === "info" ? (
          <OutboundInfoPanel
            activeStatusFilter={statusFilter}
            onStatusCardClick={handleStatusCardClick}
            drafts={drafts.map((draft) => ({
              id: draft.id,
              status: draft.status,
              subject: draft.subject,
              lead: draft.lead
                ? { id: draft.lead.id, companyName: draft.lead.companyName }
                : { id: "", companyName: draft.toEmail },
            }))}
            followUpDays={followUpQueue?.followupDays}
            followUpItems={followUpItems}
            topbarFollowUpCount={topbarStats?.followUpCount}
          />
        ) : null}
      </TabsContent>
      </Tabs>
    </div>
  );
}
