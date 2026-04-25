"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import {
  LEAD_PRIORITY_OPTIONS,
  LEAD_STATUS_OPTIONS,
  getLeadPriorityBadgeVariant,
  getLeadStatusBadgeVariant,
  getLeadStatusLabel,
} from "@/lib/lead-status";
import {
  Button, Badge, Input, Card, Skeleton, Checkbox,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@digitify/ui";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@digitify/ui";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@digitify/ui";
import {
  Search, Plus, ChevronLeft, ChevronRight, ArrowUpDown,
  Star, Globe, Mail as MailIcon, Tag, Trash2, RefreshCw, Eye,
  SearchX, Send, Target, X,
} from "lucide-react";
import { cn, formatScore, formatDate, safeExternalUrl } from "@/lib/utils";

function getOpportunityMetrics(lead: {
  overallScore: number | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  gmbRating: number | null;
  gmbReviewCount: number | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  linkedinUrl: string | null;
}) {
  const digitalPresencePoints =
    (lead.website ? 35 : 0) +
    (lead.facebookUrl ? 10 : 0) +
    (lead.instagramUrl ? 10 : 0) +
    (lead.linkedinUrl ? 10 : 0) +
    (lead.email ? 20 : 0) +
    (lead.phone ? 15 : 0);
  const contactability =
    (lead.email ? 45 : 0) +
    (lead.phone ? 35 : 0) +
    (lead.website ? 20 : 0);

  let reputationRisk = 50;
  if (lead.gmbRating != null) {
    if (lead.gmbRating >= 4.5) reputationRisk -= 25;
    else if (lead.gmbRating >= 4.0) reputationRisk -= 10;
    else if (lead.gmbRating < 3.5) reputationRisk += 25;
    else reputationRisk += 10;
  } else {
    reputationRisk += 15;
  }
  if (lead.gmbReviewCount != null) {
    if (lead.gmbReviewCount === 0) reputationRisk += 20;
    else if (lead.gmbReviewCount < 10) reputationRisk += 10;
    else if (lead.gmbReviewCount > 80) reputationRisk -= 10;
  }

  const fitScore = Math.round(lead.overallScore ?? 0);
  const digitalGap = Math.max(0, 100 - digitalPresencePoints);
  return {
    fitScore,
    digitalGap: Math.min(100, Math.max(0, digitalGap)),
    contactability: Math.min(100, Math.max(0, contactability)),
    reputationRisk: Math.min(100, Math.max(0, reputationRisk)),
  };
}

export default function LeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<(typeof LEAD_STATUS_OPTIONS)[number]["value"] | "">("");
  const [bulkTagId, setBulkTagId] = useState<string>("");
  const pageSize = 25;

  const utils = trpc.useUtils();

  useEffect(() => {
    const nextSearch = searchParams.get("search") ?? "";
    const nextStatus = searchParams.get("status") ?? "";
    const nextPriority = searchParams.get("priority") ?? "";
    const nextPage = Number.parseInt(searchParams.get("page") ?? "1", 10);

    setSearch(nextSearch);
    setStatusFilter(nextStatus);
    setPriorityFilter(nextPriority);
    setPage(Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1);
  }, [searchParams]);

  const { data, isLoading } = trpc.lead.list.useQuery({
    filters: {
      search: search || undefined,
      status: statusFilter ? [statusFilter] : undefined,
      scorePriority: priorityFilter || undefined,
    },
    sortBy,
    sortDir,
    page,
    pageSize,
  });

  const { data: tags } = trpc.tag.list.useQuery();

  const bulkUpdateStatus = trpc.lead.bulkUpdateStatus.useMutation({
    onSuccess: () => {
      utils.lead.list.invalidate();
      setSelectedIds(new Set());
      setShowStatusDialog(false);
    },
  });

  const bulkAddTag = trpc.lead.bulkAddTag.useMutation({
    onSuccess: () => {
      utils.lead.list.invalidate();
      setSelectedIds(new Set());
      setShowTagDialog(false);
    },
  });

  const bulkDelete = trpc.lead.bulkDelete.useMutation({
    onSuccess: () => {
      utils.lead.list.invalidate();
      setSelectedIds(new Set());
      setShowDeleteDialog(false);
    },
  });

  const recomputeScores = trpc.scoring.recomputeScores.useMutation({
    onSuccess: () => {
      utils.lead.list.invalidate();
    },
  });

  function toggleSort(column: string) {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!data?.items) return;
    const allSelected = data.items.every((item: NonNullable<typeof data>["items"][number]) => selectedIds.has(item.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.items.map((item: NonNullable<typeof data>["items"][number]) => item.id)));
    }
  }

  const allSelected = data?.items
    && data.items.length > 0
    && data.items.every((item: NonNullable<typeof data>["items"][number]) => selectedIds.has(item.id));
  const someSelected = selectedIds.size > 0;
  const activeFilterCount = [search, statusFilter, priorityFilter].filter(Boolean).length;
  const visibleCount = data?.items.length ?? 0;
  const hasResults = visibleCount > 0;
  const topLead = data?.items[0];

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setPriorityFilter("");
    setPage(1);
    router.replace("/leads");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            {data?.total ?? 0} leads gevonden
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/leads/new">
            <Button variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Nieuwe Lead
            </Button>
          </Link>
          <Link href="/leads/search">
            <Button>
              <Search className="mr-2 h-4 w-4" />
              Zoek Leads
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Zoek op naam, email, stad..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle statussen</SelectItem>
              {LEAD_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Prioriteit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              {LEAD_PRIORITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => recomputeScores.mutate({ onlyMissing: false, limit: 5000 })}
            disabled={recomputeScores.isPending}
          >
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", recomputeScores.isPending && "animate-spin")} />
            Alle scores ophalen
          </Button>
          {recomputeScores.data ? (
            <span className="text-xs text-muted-foreground">
              {recomputeScores.data.updated}/{recomputeScores.data.total} bijgewerkt
              {recomputeScores.data.failed > 0 ? ` · ${recomputeScores.data.failed} fouten` : ""}
            </span>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="h-7 px-2.5">
            {activeFilterCount > 0 ? `${visibleCount} zichtbare leads` : `${data?.total ?? 0} leads totaal`}
          </Badge>
          {statusFilter ? (
            <Badge variant="outline" className="h-7 px-2.5">
              Status: {getLeadStatusLabel(statusFilter)}
            </Badge>
          ) : null}
          {priorityFilter ? (
            <Badge variant="outline" className="h-7 px-2.5">
              Prioriteit: {priorityFilter}
            </Badge>
          ) : null}
          {search ? (
            <Badge variant="outline" className="h-7 px-2.5">
              Zoekterm: {search}
            </Badge>
          ) : null}
          {activeFilterCount > 0 ? (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearFilters}>
              <X className="mr-1 h-3 w-3" />
              Filters wissen
            </Button>
          ) : null}
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <button
            type="button"
            onClick={() => {
              setPriorityFilter("Hot");
              setStatusFilter("");
              setPage(1);
            }}
            className="rounded-lg border border-red-200 bg-red-50/70 p-3 text-left transition-colors hover:bg-red-50 dark:border-red-900/50 dark:bg-red-950/20"
          >
            <p className="text-xs font-semibold text-red-700 dark:text-red-300">Focus: Hot leads</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Toon eerst de meest kansrijke opportuniteiten voor snelle opvolging.
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter("NEW");
              setPriorityFilter("");
              setPage(1);
            }}
            className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-left transition-colors hover:bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20"
          >
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Nieuwe instroom</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Bekijk nieuwe leads die nog geen eerste actie kregen.
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter("PROPOSAL_SENT");
              setPriorityFilter("");
              setPage(1);
            }}
            className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-3 text-left transition-colors hover:bg-indigo-50 dark:border-indigo-900/50 dark:bg-indigo-950/20"
          >
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Offertes opvolgen</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Focus op leads met een voorstel dat nog extra opvolging kan gebruiken.
            </p>
          </button>
        </div>
        {hasResults && topLead ? (
          <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-xs font-semibold">Aanbevolen eerste actie</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Begin met <span className="font-medium text-foreground">{topLead.companyName}</span>
              {topLead.scorePriority ? ` (${topLead.scorePriority})` : ""} en open de detailpagina voor de volgende stap.
            </p>
          </div>
        ) : null}
      </Card>

      {/* Bulk Action Bar */}
      {someSelected && (
        <div className="sticky top-0 z-20 flex items-center justify-between rounded-lg border bg-primary/5 px-4 py-3 shadow-sm backdrop-blur-sm">
          <span className="text-sm font-medium">
            {selectedIds.size} lead{selectedIds.size !== 1 ? "s" : ""} geselecteerd
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowTagDialog(true)}>
              <Tag className="mr-2 h-3.5 w-3.5" />
              Tag toevoegen
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowStatusDialog(true)}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Status wijzigen
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Verwijderen
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Annuleren
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected ?? false}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("companyName")}>
                <div className="flex items-center gap-1">
                  Bedrijf
                  {sortBy === "companyName" && <ArrowUpDown className="h-3 w-3" />}
                </div>
              </TableHead>
              <TableHead>Locatie</TableHead>
              <TableHead>Niche</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("overallScore")}>
                <div className="flex items-center gap-1">
                  Score
                  {sortBy === "overallScore" && <ArrowUpDown className="h-3 w-3" />}
                </div>
              </TableHead>
              <TableHead>Prioriteit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reviews</TableHead>
              <TableHead>Opportunity</TableHead>
              <TableHead>Acties</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("createdAt")}>
                <div className="flex items-center gap-1">
                  Datum
                  {sortBy === "createdAt" && <ArrowUpDown className="h-3 w-3" />}
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-10" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-12 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                </TableRow>
              ))
            ) : data?.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-48">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                      <SearchX className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <p className="mt-3 text-base font-medium">Geen leads gevonden</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {search || statusFilter || priorityFilter
                        ? "Probeer je filters aan te passen of zoek op een andere term."
                        : "Begin met het zoeken van leads via de Lead Search."}
                    </p>
                    {(search || statusFilter || priorityFilter) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={clearFilters}
                      >
                        Filters wissen
                      </Button>
                    )}
                    {!search && !statusFilter && !priorityFilter && (
                      <Link href="/leads/search" className="mt-3">
                        <Button size="sm">
                          <Search className="mr-2 h-4 w-4" />
                          Zoek Leads
                        </Button>
                      </Link>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data?.items.map((lead: NonNullable<typeof data>["items"][number]) => {
                const opportunity = getOpportunityMetrics({
                  overallScore: lead.overallScore,
                  website: lead.website,
                  email: lead.email,
                  phone: lead.phone,
                  gmbRating: lead.gmbRating,
                  gmbReviewCount: lead.gmbReviewCount,
                  facebookUrl: lead.facebookUrl,
                  instagramUrl: lead.instagramUrl,
                  linkedinUrl: lead.linkedinUrl,
                });

                return (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/leads/${lead.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(lead.id)}
                      onCheckedChange={() => toggleSelect(lead.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium hover:text-primary">{lead.companyName}</p>
                    {lead.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {lead.tags.slice(0, 2).map((lt: NonNullable<typeof lead.tags>[number]) => (
                          <Badge key={lt.tag.id} variant="outline" className="text-[10px] px-1 py-0" style={{ borderColor: lt.tag.color, color: lt.tag.color }}>
                            {lt.tag.name}
                          </Badge>
                        ))}
                        {lead.tags.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">+{lead.tags.length - 2}</span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[lead.city, lead.country].filter(Boolean).join(", ")}
                  </TableCell>
                  <TableCell className="text-sm">{lead.industry || "\u2014"}</TableCell>
                  <TableCell>
                    <span className={cn("text-lg font-bold", lead.overallScore ? (lead.overallScore >= 80 ? "text-red-600 dark:text-red-400" : lead.overallScore >= 60 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground") : "text-muted-foreground")}>
                      {formatScore(lead.overallScore)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {lead.scorePriority && (
                      <Badge variant={getLeadPriorityBadgeVariant(lead.scorePriority)}>
                        {lead.scorePriority}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getLeadStatusBadgeVariant(lead.status)}>
                      {getLeadStatusLabel(lead.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {lead.gmbRating != null && (
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span>{lead.gmbRating}</span>
                        <span className="text-muted-foreground">({lead.gmbReviewCount})</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Target className="h-3 w-3 text-primary" />
                        Fit {opportunity.fitScore}
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MailIcon className="h-3 w-3 text-emerald-500" />
                        Contact {opportunity.contactability}
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Globe className="h-3 w-3 text-amber-500" />
                        Gap {opportunity.digitalGap}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => router.push(`/leads/${lead.id}`)}
                        title="Lead openen"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {safeExternalUrl(lead.website) && (
                        <Button asChild size="icon" variant="ghost" className="h-8 w-8" title="Website openen">
                          <a href={safeExternalUrl(lead.website)!} target="_blank" rel="noopener noreferrer">
                            <Globe className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      {lead.email && (
                        <Button asChild size="icon" variant="ghost" className="h-8 w-8" title="E-mail sturen">
                          <a href={`mailto:${lead.email}`}>
                            <MailIcon className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      <Button asChild size="icon" variant="ghost" className="h-8 w-8" title="Mail opmaken">
                        <Link href={`/contacts/compose?leadId=${lead.id}`}>
                          <Send className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(lead.createdAt)}
                  </TableCell>
                </TableRow>
              )})
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {(page - 1) * pageSize + 1}&ndash;{Math.min(page * pageSize, data.total)} van {data.total}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">Pagina {page} van {data.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page === data.totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Tag Dialog */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tag toevoegen aan {selectedIds.size} leads</DialogTitle>
            <DialogDescription>Selecteer een tag om toe te voegen aan de geselecteerde leads.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={bulkTagId} onValueChange={setBulkTagId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecteer een tag" />
              </SelectTrigger>
              <SelectContent>
                {tags?.map((tag: NonNullable<typeof tags>[number]) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTagDialog(false)}>
              Annuleren
            </Button>
            <Button
              disabled={!bulkTagId || bulkAddTag.isPending}
              onClick={() => {
                if (bulkTagId) {
                  bulkAddTag.mutate({ leadIds: Array.from(selectedIds), tagId: bulkTagId });
                }
              }}
            >
              {bulkAddTag.isPending ? "Bezig..." : "Tag toevoegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Status wijzigen van {selectedIds.size} leads</DialogTitle>
            <DialogDescription>Selecteer de nieuwe status voor de geselecteerde leads.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select
              value={bulkStatus}
              onValueChange={(value) => {
                setBulkStatus(value as (typeof LEAD_STATUS_OPTIONS)[number]["value"]);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecteer status" />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
              Annuleren
            </Button>
            <Button
              disabled={!bulkStatus || bulkUpdateStatus.isPending}
              onClick={() => {
                if (bulkStatus) {
                  bulkUpdateStatus.mutate({ ids: Array.from(selectedIds), status: bulkStatus });
                }
              }}
            >
              {bulkUpdateStatus.isPending ? "Bezig..." : "Status wijzigen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leads verwijderen</DialogTitle>
            <DialogDescription>
              Weet je zeker dat je {selectedIds.size} lead{selectedIds.size !== 1 ? "s" : ""} wilt
              verwijderen? Dit kan niet ongedaan worden gemaakt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Annuleren
            </Button>
            <Button
              variant="destructive"
              disabled={bulkDelete.isPending}
              onClick={() => {
                bulkDelete.mutate({ ids: Array.from(selectedIds) });
              }}
            >
              {bulkDelete.isPending ? "Bezig..." : `${selectedIds.size} leads verwijderen`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
