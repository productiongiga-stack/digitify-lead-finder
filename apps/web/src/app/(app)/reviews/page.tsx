"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Card,
  CardContent,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  CreateModal,
  DataTable,
  type DataTableColumn,
  EmptyState,
  StatsCards,
  type StatItem,
} from "@digitify/ui";
import {
  Star,
  Plus,
  Send,
  ExternalLink,
  Trash2,
  ThumbsUp,
  BarChart3,
  MailCheck,
  CheckCircle2,
  Settings2,
  QrCode,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/feedback/toast-provider";
import { buildUrl } from "@/lib/config";
import { ReviewQrCodeCard } from "@/components/reviews/qr-code-card";

const REVIEW_STATUSES = ["PENDING", "SENT", "OPENED", "REVIEWED", "FEEDBACK"] as const;
type ReviewStatus = (typeof REVIEW_STATUSES)[number];

const STATUS_MAP: Record<ReviewStatus, { label: string; variant: "warning" | "info" | "secondary" | "success" }> = {
  PENDING: { label: "In Afwachting", variant: "warning" },
  SENT: { label: "Verstuurd", variant: "info" },
  OPENED: { label: "Geopend", variant: "secondary" },
  REVIEWED: { label: "Beoordeeld", variant: "success" },
  FEEDBACK: { label: "Interne Feedback", variant: "secondary" },
};

function getStatusInfo(status: string | null | undefined) {
  return REVIEW_STATUSES.includes(status as ReviewStatus)
    ? STATUS_MAP[status as ReviewStatus]
    : STATUS_MAP.PENDING;
}

const PLATFORM_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  google: { label: "Google", icon: Star, color: "bg-amber-50 text-amber-700 border-amber-200" },
  trustpilot: {
    label: "Trustpilot",
    icon: Star,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  facebook: {
    label: "Facebook",
    icon: ThumbsUp,
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
};

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function renderStars(rating: number | null) {
  if (!rating) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
          }`}
        />
      ))}
      <span className="ml-1 text-xs font-medium text-muted-foreground">{rating}/5</span>
    </div>
  );
}

type Review = {
  id: string;
  clientName: string;
  clientEmail: string;
  status: string;
  platform: string | null;
  rating: number | null;
  reviewUrl: string | null;
  feedback: string | null;
  sentAt: Date | string | null;
  reviewedAt: Date | string | null;
  lead: { id: string; companyName: string } | null;
};

export default function ReviewsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [qrTarget, setQrTarget] = useState<{ id: string; name: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | undefined>(undefined);
  const [platform, setPlatform] = useState<"google" | "trustpilot" | "facebook">("google");
  const [createLeadId, setCreateLeadId] = useState("__none");
  const { showToast } = useToast();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.review.list.useQuery(
    statusFilter ? { status: statusFilter } : undefined,
  );
  const { data: stats } = trpc.review.getStats.useQuery();

  const { data: leadsData } = trpc.lead.list.useQuery({
    page: 1,
    pageSize: 100,
    sortBy: "companyName",
    sortDir: "asc",
  });

  const createMutation = trpc.review.create.useMutation({
    onSuccess: () => {
      utils.review.list.invalidate();
      utils.review.getStats.invalidate();
      setCreateOpen(false);
      showToast({
        title: "Reviewverzoek opgeslagen",
        description: "De reviewaanvraag is aangemaakt.",
      });
    },
    onError: (error) =>
      showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const sendMutation = trpc.review.send.useMutation({
    onSuccess: () => {
      utils.review.list.invalidate();
      utils.review.getStats.invalidate();
      showToast({
        title: "Review verzonden",
        description: "De reviewuitnodiging is verstuurd.",
      });
    },
    onError: (error) =>
      showToast({ title: "Verzenden mislukt", description: error.message, variant: "error" }),
  });

  const deleteMutation = trpc.review.delete.useMutation({
    onSuccess: () => {
      utils.review.list.invalidate();
      utils.review.getStats.invalidate();
      setDeleteTarget(null);
      showToast({
        title: "Reviewverzoek verwijderd",
        description: "De aanvraag is verwijderd.",
      });
    },
    onError: (error) =>
      showToast({ title: "Verwijderen mislukt", description: error.message, variant: "error" }),
  });

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const reviewUrl = form.get("reviewUrl") as string;
    createMutation.mutate({
      clientName: form.get("clientName") as string,
      clientEmail: form.get("clientEmail") as string,
      platform,
      reviewUrl: reviewUrl || undefined,
      leadId: createLeadId && createLeadId !== "__none" ? createLeadId : undefined,
    });
  }

  const filterTabs: Array<{ key: ReviewStatus | undefined; label: string; count: number | undefined }> =
    [
      { key: undefined, label: "Alle", count: stats?.total },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { key: "PENDING", label: "In Afwachting", count: (stats as any)?.pending },
      { key: "SENT", label: "Verstuurd", count: stats?.sent },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { key: "OPENED", label: "Geopend", count: (stats as any)?.opened },
      { key: "REVIEWED", label: "Beoordeeld", count: stats?.reviewed },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { key: "FEEDBACK", label: "Feedback", count: (stats as any)?.feedback },
    ];

  const statItems: StatItem[] = [
    { label: "Totaal", value: stats?.total ?? 0, icon: <BarChart3 /> },
    { label: "Verstuurd", value: stats?.sent ?? 0, icon: <MailCheck /> },
    {
      label: "Beoordeeld",
      value: stats?.reviewed ?? 0,
      icon: <CheckCircle2 />,
      tone: "positive",
    },
    {
      label: "Gem. Score",
      value:
        stats?.averageRating !== null && stats?.averageRating !== undefined
          ? `${stats.averageRating}/5`
          : "—",
      icon: <Star />,
    },
  ];

  const reviews = (data?.reviews ?? []) as Review[];

  const columns = useMemo<DataTableColumn<Review>[]>(
    () => [
      {
        id: "client",
        header: "Klant",
        cell: (r) => (
          <div>
            <p className="font-semibold">{r.clientName}</p>
            <p className="text-xs text-muted-foreground">{r.clientEmail}</p>
            {r.feedback ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                Interne feedback: {r.feedback}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: "platform",
        header: "Platform",
        hideBelow: "lg",
        cell: (r) => {
          const info = PLATFORM_CONFIG[r.platform ?? "google"] ?? PLATFORM_CONFIG.google;
          const Icon = info.icon;
          return (
            <Badge variant="outline" className="gap-1">
              <Icon className="h-3 w-3" />
              {info.label}
            </Badge>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        cell: (r) => {
          const info = getStatusInfo(r.status);
          return <Badge variant={info.variant}>{info.label}</Badge>;
        },
      },
      {
        id: "sent",
        header: "Verstuurd",
        hideBelow: "lg",
        cell: (r) => <span className="text-sm">{formatDate(r.sentAt)}</span>,
      },
      {
        id: "reviewed",
        header: "Beoordeeld",
        hideBelow: "lg",
        cell: (r) => <span className="text-sm">{formatDate(r.reviewedAt)}</span>,
      },
      {
        id: "rating",
        header: "Beoordeling",
        cell: (r) => renderStars(r.rating),
      },
      {
        id: "lead",
        header: "Lead",
        hideBelow: "lg",
        cell: (r) =>
          r.lead ? (
            <Link href={`/leads/${r.lead.id}`} className="text-sm text-primary hover:underline">
              {r.lead.companyName}
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      },
      {
        id: "actions",
        header: "",
        stopPropagation: true,
        cell: (r) => (
          <div className="flex items-center gap-0.5">
            {r.status === "PENDING" ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => sendMutation.mutate({ id: r.id })}
                disabled={sendMutation.isPending}
                title="Versturen"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            {r.status === "SENT" || r.status === "OPENED" || r.status === "FEEDBACK" ? (
              <Link href={`/review/${r.id}`} target="_blank" title="Publieke pagina">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setQrTarget({ id: r.id, name: r.clientName })}
              title="QR code"
            >
              <QrCode className="h-3.5 w-3.5" />
            </Button>
            {r.status === "REVIEWED" && r.reviewUrl ? (
              <a href={r.reviewUrl} target="_blank" rel="noopener noreferrer" title="Bekijk review">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteTarget({ id: r.id, name: r.clientName })}
              title="Verwijderen"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [sendMutation],
  );

  const renderMobileCard = (r: Review) => {
    const statusInfo = getStatusInfo(r.status);
    const platformInfo = PLATFORM_CONFIG[r.platform ?? "google"] ?? PLATFORM_CONFIG.google;
    return (
      <div className="rounded-xl border p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{r.clientName}</p>
            <p className="truncate text-xs text-muted-foreground">{r.clientEmail}</p>
          </div>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{platformInfo.label}</Badge>
          {renderStars(r.rating)}
        </div>
        {r.feedback ? (
          <div className="mt-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Interne feedback</p>
            <p className="mt-0.5">{r.feedback}</p>
          </div>
        ) : null}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQrTarget({ id: r.id, name: r.clientName })}
          >
            <QrCode className="mr-1 h-3.5 w-3.5" /> QR
          </Button>
          {r.status === "PENDING" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendMutation.mutate({ id: r.id })}
              disabled={sendMutation.isPending}
            >
              <Send className="mr-1 h-3.5 w-3.5" /> Verstuur
            </Button>
          ) : null}
          {r.status === "SENT" || r.status === "OPENED" || r.status === "FEEDBACK" ? (
            <Link href={`/review/${r.id}`} target="_blank">
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div className="app-page-heading">
          <h1 className="app-page-title">Reviews</h1>
          <p className="app-page-subtitle">Beheer review-aanvragen en beoordelingen</p>
        </div>
        <div className="app-page-actions">
          <Link href="/settings/reviews">
            <Button variant="outline" size="sm">
              <Settings2 className="mr-2 h-4 w-4" />
              Embed & Instellingen
            </Button>
          </Link>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Review Aanvragen
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max flex-wrap gap-1.5">
          {filterTabs.map((tab) => (
            <Button
              key={tab.label}
              variant={statusFilter === tab.key ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(tab.key)}
            >
              {tab.label}
              {tab.count !== undefined ? (
                <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1 text-xs">
                  {tab.count}
                </Badge>
              ) : null}
            </Button>
          ))}
        </div>
      </div>

      <StatsCards items={statItems} columns={4} loading={!stats} />

      <DataTable<Review>
        data={reviews}
        columns={columns}
        getRowId={(r) => r.id}
        loading={isLoading}
        renderMobileCard={renderMobileCard}
        empty={
          <EmptyState
            icon={<Star />}
            title="Geen reviews gevonden"
            description="Vraag een review aan om te beginnen."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Review Aanvragen
              </Button>
            }
          />
        }
      />

      {/* Create dialog */}
      <CreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Review Aanvragen"
        description="Verstuur een review-aanvraag naar een klant."
        hideFooter
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="create-clientName">Klantnaam *</Label>
            <Input
              id="create-clientName"
              name="clientName"
              required
              placeholder="Naam van de klant"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-clientEmail">E-mail *</Label>
            <Input
              id="create-clientEmail"
              name="clientEmail"
              type="email"
              required
              placeholder="klant@voorbeeld.be"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Platform</Label>
            <Select
              value={platform}
              onValueChange={(v) => setPlatform(v as "google" | "trustpilot" | "facebook")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google">
                  <span className="flex items-center gap-2">
                    <Star className="h-3.5 w-3.5 text-amber-500" />
                    Google
                  </span>
                </SelectItem>
                <SelectItem value="trustpilot">
                  <span className="flex items-center gap-2">
                    <Star className="h-3.5 w-3.5 text-emerald-500" />
                    Trustpilot
                  </span>
                </SelectItem>
                <SelectItem value="facebook">
                  <span className="flex items-center gap-2">
                    <ThumbsUp className="h-3.5 w-3.5 text-blue-500" />
                    Facebook
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-reviewUrl">Review URL (optioneel)</Label>
            <Input
              id="create-reviewUrl"
              name="reviewUrl"
              type="url"
              placeholder="https://g.page/r/abc/review"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Gekoppelde lead (optioneel)</Label>
            <Select value={createLeadId} onValueChange={setCreateLeadId}>
              <SelectTrigger>
                <SelectValue placeholder="Kies een lead..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Geen lead</SelectItem>
                {leadsData?.items?.map(
                  (lead: NonNullable<typeof leadsData>["items"][number]) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.companyName}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Annuleren
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Bezig..." : "Aanvraag Aanmaken"}
            </Button>
          </div>
        </form>
      </CreateModal>

      {/* QR Dialog (specialized content) */}
      <Dialog open={Boolean(qrTarget)} onOpenChange={(open) => !open && setQrTarget(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Review QR code</DialogTitle>
            <DialogDescription>
              Deel deze QR met {qrTarget?.name} om rechtstreeks naar de publieke reviewpagina te
              gaan.
            </DialogDescription>
          </DialogHeader>
          {qrTarget ? (
            <ReviewQrCodeCard
              title={`QR voor ${qrTarget.name}`}
              description="Handig voor aftercare op locatie, facturen, printmateriaal of wanneer je een reviewverzoek niet via e-mail wilt sturen."
              url={buildUrl(`/review/${qrTarget.id}`)}
              filename={`review-${qrTarget.id}`}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <CreateModal
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Review aanvraag verwijderen"
        description={
          deleteTarget
            ? `Weet je zeker dat je de aanvraag van ${deleteTarget.name} wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`
            : ""
        }
        submitLabel="Verwijderen"
        submitVariant="destructive"
        pending={deleteMutation.isPending}
        onSubmit={() => {
          if (deleteTarget) deleteMutation.mutate({ id: deleteTarget.id });
        }}
      >
        <p className="text-sm text-muted-foreground">Verwijderde aanvragen zijn niet terug te halen.</p>
      </CreateModal>
    </div>
  );
}
