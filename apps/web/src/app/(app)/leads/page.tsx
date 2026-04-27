"use client";

import { useEffect, useMemo, useState } from "react";
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
  Button,
  Badge,
  Input,
  Card,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DataTable,
  type DataTableColumn,
  CreateModal,
  EmptyState,
  BulkActions,
} from "@digitify/ui";
import {
  Search,
  Plus,
  Star,
  Globe,
  Mail as MailIcon,
  Tag,
  Trash2,
  RefreshCw,
  Eye,
  SearchX,
  Send,
  Target,
  X,
  ChevronDown,
} from "lucide-react";
import { cn, formatScore, formatDate, safeExternalUrl } from "@/lib/utils";
import { LEADS_WORKFLOW_ITEMS } from "@/lib/navigation";

type Lead = {
  id: string;
  companyName: string;
  city: string | null;
  country: string | null;
  industry: string | null;
  status: string;
  scorePriority: string | null;
  overallScore: number | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  gmbRating: number | null;
  gmbReviewCount: number | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  linkedinUrl: string | null;
  createdAt: string | Date;
  tags: { tag: { id: string; name: string; color: string } }[];
};

function getOpportunityMetrics(lead: Lead) {
  const digitalPresencePoints =
    (lead.website ? 35 : 0) +
    (lead.facebookUrl ? 10 : 0) +
    (lead.instagramUrl ? 10 : 0) +
    (lead.linkedinUrl ? 10 : 0) +
    (lead.email ? 20 : 0) +
    (lead.phone ? 15 : 0);
  const contactability =
    (lead.email ? 45 : 0) + (lead.phone ? 35 : 0) + (lead.website ? 20 : 0);

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

  return {
    fitScore: Math.round(lead.overallScore ?? 0),
    digitalGap: Math.min(100, Math.max(0, 100 - digitalPresencePoints)),
    contactability: Math.min(100, Math.max(0, contactability)),
    reputationRisk: Math.min(100, Math.max(0, reputationRisk)),
  };
}

function scoreClass(score: number | null) {
  if (!score) return "text-muted-foreground";
  if (score >= 80) return "text-red-600 dark:text-red-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
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
  const [bulkStatus, setBulkStatus] = useState<
    (typeof LEAD_STATUS_OPTIONS)[number]["value"] | ""
  >("");
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

  const items = (data?.items ?? []) as Lead[];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const activeFilterCount = [search, statusFilter, priorityFilter].filter(Boolean).length;
  const visibleCount = items.length;
  const topLead = items[0];
  const hasResults = visibleCount > 0;

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setPriorityFilter("");
    setPage(1);
    router.replace("/leads");
  }

  const columns = useMemo<DataTableColumn<Lead>[]>(
    () => [
      {
        id: "company",
        header: "Bedrijf",
        sortKey: "companyName",
        cell: (lead) => (
          <div className="min-w-0">
            <p className="truncate font-medium hover:text-primary">{lead.companyName}</p>
            {lead.tags.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {lead.tags.slice(0, 2).map((lt) => (
                  <Badge
                    key={lt.tag.id}
                    variant="outline"
                    className="text-[10px] px-1 py-0"
                    style={{ borderColor: lt.tag.color, color: lt.tag.color }}
                  >
                    {lt.tag.name}
                  </Badge>
                ))}
                {lead.tags.length > 2 ? (
                  <span className="text-[10px] text-muted-foreground">
                    +{lead.tags.length - 2}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: "location",
        header: "Locatie",
        hideBelow: "lg",
        cell: (lead) => (
          <span className="text-sm text-muted-foreground">
            {[lead.city, lead.country].filter(Boolean).join(", ") || "—"}
          </span>
        ),
      },
      {
        id: "industry",
        header: "Niche",
        hideBelow: "lg",
        cell: (lead) => (
          <span className="text-sm">{lead.industry || "—"}</span>
        ),
      },
      {
        id: "score",
        header: "Score",
        sortKey: "overallScore",
        cell: (lead) => (
          <span className={cn("text-base font-semibold", scoreClass(lead.overallScore))}>
            {formatScore(lead.overallScore)}
          </span>
        ),
      },
      {
        id: "priority",
        header: "Prioriteit",
        cell: (lead) =>
          lead.scorePriority ? (
            <Badge variant={getLeadPriorityBadgeVariant(lead.scorePriority)}>
              {lead.scorePriority}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: "status",
        header: "Status",
        cell: (lead) => (
          <Badge variant={getLeadStatusBadgeVariant(lead.status)}>
            {getLeadStatusLabel(lead.status)}
          </Badge>
        ),
      },
      {
        id: "reviews",
        header: "Reviews",
        hideBelow: "lg",
        cell: (lead) =>
          lead.gmbRating != null ? (
            <div className="flex items-center gap-1 text-sm">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span>{lead.gmbRating}</span>
              <span className="text-muted-foreground">({lead.gmbReviewCount})</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: "opportunity",
        header: "Opportunity",
        hideBelow: "lg",
        cell: (lead) => {
          const o = getOpportunityMetrics(lead);
          return (
            <div className="space-y-0.5 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Target className="h-3 w-3 text-primary" /> Fit {o.fitScore}
              </div>
              <div className="flex items-center gap-1.5">
                <MailIcon className="h-3 w-3 text-emerald-500" /> Contact {o.contactability}
              </div>
              <div className="flex items-center gap-1.5">
                <Globe className="h-3 w-3 text-amber-500" /> Gap {o.digitalGap}
              </div>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Acties",
        stopPropagation: true,
        cell: (lead) => (
          <div className="flex items-center gap-0.5">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => router.push(`/leads/${lead.id}`)}
              title="Lead openen"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {safeExternalUrl(lead.website) ? (
              <Button asChild size="icon" variant="ghost" className="h-7 w-7" title="Website">
                <a href={safeExternalUrl(lead.website)!} target="_blank" rel="noopener noreferrer">
                  <Globe className="h-3.5 w-3.5" />
                </a>
              </Button>
            ) : null}
            {lead.email ? (
              <Button asChild size="icon" variant="ghost" className="h-7 w-7" title="E-mail">
                <a href={`mailto:${lead.email}`}>
                  <MailIcon className="h-3.5 w-3.5" />
                </a>
              </Button>
            ) : null}
            <Button asChild size="icon" variant="ghost" className="h-7 w-7" title="Mail opmaken">
              <Link href={`/contacts/compose?leadId=${lead.id}`}>
                <Send className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        ),
      },
      {
        id: "createdAt",
        header: "Datum",
        sortKey: "createdAt",
        hideBelow: "md",
        cell: (lead) => (
          <span className="text-sm text-muted-foreground">{formatDate(lead.createdAt)}</span>
        ),
      },
    ],
    [router],
  );

  const renderMobileCard = (lead: Lead) => {
    const o = getOpportunityMetrics(lead);
    return (
      <div className="rounded-xl border p-3">
        <button
          type="button"
          className="w-full text-left"
          onClick={() => router.push(`/leads/${lead.id}`)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{lead.companyName}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[lead.city, lead.country].filter(Boolean).join(", ") || "Locatie onbekend"}
              </p>
            </div>
            <span className={cn("text-base font-semibold", scoreClass(lead.overallScore))}>
              {formatScore(lead.overallScore)}
            </span>
          </div>
        </button>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant={getLeadStatusBadgeVariant(lead.status)}>
            {getLeadStatusLabel(lead.status)}
          </Badge>
          {lead.scorePriority ? (
            <Badge variant={getLeadPriorityBadgeVariant(lead.scorePriority)}>
              {lead.scorePriority}
            </Badge>
          ) : null}
          {lead.gmbRating != null ? (
            <Badge variant="outline" className="gap-1">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {lead.gmbRating} ({lead.gmbReviewCount})
            </Badge>
          ) : null}
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-[11px] text-muted-foreground">
          <div className="rounded-md border bg-muted/20 px-2 py-1">Fit {o.fitScore}</div>
          <div className="rounded-md border bg-muted/20 px-2 py-1">Contact {o.contactability}</div>
          <div className="rounded-md border bg-muted/20 px-2 py-1">Gap {o.digitalGap}</div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={() => router.push(`/leads/${lead.id}`)}>
            <Eye className="mr-1 h-3.5 w-3.5" /> Open
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/contacts/compose?leadId=${lead.id}`}>
              <Send className="mr-1 h-3.5 w-3.5" /> Mail
            </Link>
          </Button>
          {safeExternalUrl(lead.website) ? (
            <Button asChild size="sm" variant="ghost">
              <a href={safeExternalUrl(lead.website)!} target="_blank" rel="noopener noreferrer">
                <Globe className="mr-1 h-3.5 w-3.5" /> Site
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    );
  };

  const emptyEl = (
    <EmptyState
      icon={<SearchX />}
      title="Geen leads gevonden"
      description={
        activeFilterCount > 0
          ? "Probeer je filters aan te passen of zoek op een andere term."
          : "Begin met het zoeken van leads via de Lead Search."
      }
      action={
        activeFilterCount > 0 ? (
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Filters wissen
          </Button>
        ) : (
          <Link href="/leads/search">
            <Button size="sm">
              <Search className="mr-2 h-4 w-4" /> Zoek Leads
            </Button>
          </Link>
        )
      }
    />
  );

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div className="app-page-heading">
          <h1 className="app-page-title">Leads</h1>
          <p className="app-page-subtitle">{total} leads gevonden</p>
        </div>
        <div className="app-page-actions">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Workflow
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Leads Dropdown</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {LEADS_WORKFLOW_ITEMS.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href}>
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/leads/new">
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" /> Nieuwe Lead
            </Button>
          </Link>
          <Link href="/leads/search">
            <Button size="sm">
              <Search className="mr-2 h-4 w-4" /> Zoek Leads
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-3">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3">
          {/* Filters */}
          <Card className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[170px] flex-1 sm:min-w-[220px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Zoek op naam, email, stad..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v === "all" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[138px] sm:w-[150px]">
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
              <Select
                value={priorityFilter}
                onValueChange={(v) => {
                  setPriorityFilter(v === "all" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[122px] sm:w-[130px]">
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
                <RefreshCw
                  className={cn("mr-1.5 h-3.5 w-3.5", recomputeScores.isPending && "animate-spin")}
                />
                Scores ophalen
              </Button>
              {recomputeScores.data ? (
                <span className="text-xs text-muted-foreground">
                  {recomputeScores.data.updated}/{recomputeScores.data.total} bijgewerkt
                  {recomputeScores.data.failed > 0
                    ? ` · ${recomputeScores.data.failed} fouten`
                    : ""}
                </span>
              ) : null}
            </div>
            {(activeFilterCount > 0 || total > 0) && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="h-6 px-2">
                  {activeFilterCount > 0
                    ? `${visibleCount} zichtbaar`
                    : `${total} totaal`}
                </Badge>
                {statusFilter ? (
                  <Badge variant="outline" className="h-6 px-2">
                    Status: {getLeadStatusLabel(statusFilter)}
                  </Badge>
                ) : null}
                {priorityFilter ? (
                  <Badge variant="outline" className="h-6 px-2">
                    Prioriteit: {priorityFilter}
                  </Badge>
                ) : null}
                {search ? (
                  <Badge variant="outline" className="h-6 px-2">
                    Zoekterm: {search}
                  </Badge>
                ) : null}
                {activeFilterCount > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={clearFilters}
                  >
                    <X className="mr-1 h-3 w-3" />
                    Wissen
                  </Button>
                ) : null}
              </div>
            )}
          </Card>

          {/* Bulk Actions */}
          <BulkActions
            count={selectedIds.size}
            itemLabel={{ singular: "lead", plural: "leads" }}
            onClear={() => setSelectedIds(new Set())}
          >
            <Button size="sm" variant="outline" onClick={() => setShowTagDialog(true)}>
              <Tag className="mr-1.5 h-3.5 w-3.5" /> Tag
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowStatusDialog(true)}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Status
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Verwijderen
            </Button>
          </BulkActions>

          {/* Table */}
          <DataTable<Lead>
            data={items}
            columns={columns}
            getRowId={(l) => l.id}
            loading={isLoading}
            selection={{ selectedIds, onChange: setSelectedIds }}
            sort={{
              sortBy,
              sortDir,
              onSortChange: (key, dir) => {
                setSortBy(key);
                setSortDir(dir);
              },
            }}
            onRowClick={(lead) => router.push(`/leads/${lead.id}`)}
            renderMobileCard={renderMobileCard}
            empty={emptyEl}
            pagination={{
              page,
              pageSize,
              total,
              totalPages,
              onPageChange: setPage,
            }}
          />
        </TabsContent>

        <TabsContent value="info" className="space-y-3">
          <div className="grid gap-2 md:grid-cols-3">
            <button
              type="button"
              onClick={() => {
                setPriorityFilter("Hot");
                setStatusFilter("");
                setPage(1);
              }}
              className="rounded-lg border border-red-200 bg-red-50/70 p-3 text-left transition-colors hover:bg-red-50 dark:border-red-900/50 dark:bg-red-950/20"
            >
              <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                Focus: Hot leads
              </p>
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
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                Nieuwe instroom
              </p>
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
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                Offertes opvolgen
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Focus op leads met een voorstel dat nog extra opvolging kan gebruiken.
              </p>
            </button>
          </div>
          {hasResults && topLead ? (
            <Card className="border-border/60 bg-muted/30 p-3">
              <p className="text-xs font-semibold">Aanbevolen eerste actie</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Begin met{" "}
                <span className="font-medium text-foreground">{topLead.companyName}</span>
                {topLead.scorePriority ? ` (${topLead.scorePriority})` : ""} en open de
                detailpagina voor de volgende stap.
              </p>
            </Card>
          ) : (
            <Card className="border-border/60 bg-muted/20 p-3">
              <p className="text-xs font-semibold">Tip</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Gebruik de focusknoppen om snel tussen warme leads, nieuwe instroom en
                offerte-opvolging te wisselen.
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Tag Dialog */}
      <CreateModal
        open={showTagDialog}
        onOpenChange={setShowTagDialog}
        title={`Tag toevoegen aan ${selectedIds.size} leads`}
        description="Selecteer een tag om toe te voegen aan de geselecteerde leads."
        submitLabel="Tag toevoegen"
        submitDisabled={!bulkTagId}
        pending={bulkAddTag.isPending}
        onSubmit={() => {
          if (bulkTagId)
            bulkAddTag.mutate({ leadIds: Array.from(selectedIds), tagId: bulkTagId });
        }}
      >
        <Select value={bulkTagId} onValueChange={setBulkTagId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecteer een tag" />
          </SelectTrigger>
          <SelectContent>
            {tags?.map((tag: { id: string; name: string; color: string }) => (
              <SelectItem key={tag.id} value={tag.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CreateModal>

      {/* Status Dialog */}
      <CreateModal
        open={showStatusDialog}
        onOpenChange={setShowStatusDialog}
        title={`Status wijzigen van ${selectedIds.size} leads`}
        description="Selecteer de nieuwe status voor de geselecteerde leads."
        submitLabel="Status wijzigen"
        submitDisabled={!bulkStatus}
        pending={bulkUpdateStatus.isPending}
        onSubmit={() => {
          if (bulkStatus)
            bulkUpdateStatus.mutate({ ids: Array.from(selectedIds), status: bulkStatus });
        }}
      >
        <Select
          value={bulkStatus}
          onValueChange={(value) =>
            setBulkStatus(value as (typeof LEAD_STATUS_OPTIONS)[number]["value"])
          }
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
      </CreateModal>

      {/* Delete Dialog */}
      <CreateModal
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Leads verwijderen"
        description={`Weet je zeker dat je ${selectedIds.size} lead${selectedIds.size !== 1 ? "s" : ""} wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`}
        submitLabel={`${selectedIds.size} verwijderen`}
        submitVariant="destructive"
        pending={bulkDelete.isPending}
        onSubmit={() => bulkDelete.mutate({ ids: Array.from(selectedIds) })}
      >
        <p className="text-sm text-muted-foreground">
          Verwijderde leads zijn permanent niet meer beschikbaar.
        </p>
      </CreateModal>
    </div>
  );
}
