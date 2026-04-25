"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Card, CardContent, Badge, Button, Skeleton,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
  Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@digitify/ui";
import {
  Star, Plus, Send, ExternalLink, Trash2, ThumbsUp,
  BarChart3, MailCheck, CheckCircle2, Settings2, QrCode,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/feedback/toast-provider";
import { buildUrl } from "@/lib/config";
import { ReviewQrCodeCard } from "@/components/reviews/qr-code-card";

const STATUS_MAP: Record<string, { label: string; variant: "warning" | "info" | "secondary" | "success" }> = {
  PENDING: { label: "In Afwachting", variant: "warning" },
  SENT: { label: "Verstuurd", variant: "info" },
  OPENED: { label: "Geopend", variant: "secondary" },
  REVIEWED: { label: "Beoordeeld", variant: "success" },
  FEEDBACK: { label: "Interne Feedback", variant: "secondary" },
};

type ReviewStatus = keyof typeof STATUS_MAP;

const PLATFORM_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  google: { label: "Google", icon: Star, color: "bg-amber-50 text-amber-700 border-amber-200" },
  trustpilot: { label: "Trustpilot", icon: Star, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  facebook: { label: "Facebook", icon: ThumbsUp, color: "bg-blue-50 text-blue-700 border-blue-200" },
};

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ReviewsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [qrTarget, setQrTarget] = useState<{ id: string; name: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | undefined>(undefined);
  const [platform, setPlatform] = useState<"google" | "trustpilot" | "facebook">("google");
  const [createLeadId, setCreateLeadId] = useState("__none");
  const [successMessage, setSuccessMessage] = useState("");
  const { showToast } = useToast();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.review.list.useQuery(
    statusFilter ? { status: statusFilter as "PENDING" | "SENT" | "OPENED" | "REVIEWED" | "FEEDBACK" } : undefined
  );
  const { data: stats } = trpc.review.getStats.useQuery();

  // Fetch leads for linking
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
      showToast({ title: "Reviewverzoek opgeslagen", description: "De reviewaanvraag is aangemaakt." });
    },
    onError: (error) => showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });
  const sendMutation = trpc.review.send.useMutation({
    onSuccess: () => {
      utils.review.list.invalidate();
      utils.review.getStats.invalidate();
      setSuccessMessage("Review verzoek succesvol verzonden!");
      setTimeout(() => setSuccessMessage(""), 4000);
      showToast({ title: "Review verzonden", description: "De reviewuitnodiging is verstuurd." });
    },
    onError: (error) => {
      setSuccessMessage("");
      showToast({ title: "Verzenden mislukt", description: error.message, variant: "error" });
    },
  });
  const deleteMutation = trpc.review.delete.useMutation({
    onSuccess: () => {
      utils.review.list.invalidate();
      utils.review.getStats.invalidate();
      setDeleteOpen(false);
      setDeleteTarget(null);
      showToast({ title: "Reviewverzoek verwijderd", description: "De aanvraag is verwijderd." });
    },
    onError: (error) => showToast({ title: "Verwijderen mislukt", description: error.message, variant: "error" }),
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

  function openDelete(id: string, name: string) {
    setDeleteTarget({ id, name });
    setDeleteOpen(true);
  }

  function openQr(id: string, name: string) {
    setQrTarget({ id, name });
  }

  function renderStars(rating: number | null) {
    if (!rating) return <span className="text-xs text-muted-foreground">-</span>;
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

  const filterTabs: Array<{ key: ReviewStatus | undefined; label: string; count: number | undefined }> = [
    { key: undefined, label: "Alle", count: stats?.total },
    { key: "PENDING", label: "In Afwachting", count: (stats as any)?.pending },
    { key: "SENT", label: "Verstuurd", count: stats?.sent },
    { key: "OPENED", label: "Geopend", count: (stats as any)?.opened },
    { key: "REVIEWED", label: "Beoordeeld", count: stats?.reviewed },
    { key: "FEEDBACK", label: "Feedback", count: (stats as any)?.feedback },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Reviews</h1>
          <p className="text-sm text-muted-foreground">
            Beheer review-aanvragen en beoordelingen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/settings/reviews">
            <Button variant="outline">
              <Settings2 className="mr-2 h-4 w-4" />
              Embed & Instellingen
            </Button>
          </Link>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Review Aanvragen
          </Button>
        </div>
      </div>

      {/* Success Toast */}
      {successMessage && (
        <Card className="border-emerald-500/20 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{successMessage}</p>
          </div>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Totaal Verzoeken</p>
              <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <MailCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Verstuurd</p>
              <p className="text-2xl font-bold">{stats?.sent ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Beoordeeld</p>
              <p className="text-2xl font-bold">{stats?.reviewed ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Star className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gem. Score</p>
              <p className="text-2xl font-bold">
                {stats?.averageRating !== null && stats?.averageRating !== undefined
                  ? `${stats.averageRating}/5`
                  : "-"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {filterTabs.map((tab) => (
          <Button
            key={tab.label}
            variant={statusFilter === tab.key ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(tab.key)}
          >
            {tab.label}
            {tab.count !== undefined && (
              <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1 text-xs">
                {tab.count}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data?.reviews.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Star className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium">Geen reviews gevonden</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Vraag een review aan om te beginnen.
              </p>
            </div>
          ) : (
            <>
            <div className="grid gap-3 p-4 md:hidden">
              {data.reviews.map((review: NonNullable<typeof data>["reviews"][number]) => {
                const statusInfo = STATUS_MAP[review.status] ?? STATUS_MAP.PENDING;
                const platformInfo = PLATFORM_CONFIG[review.platform ?? "google"] ?? PLATFORM_CONFIG.google;
                const publicReviewUrl = `/review/${review.id}`;
                return (
                  <div key={review.id} className="rounded-2xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{review.clientName}</p>
                        <p className="text-xs text-muted-foreground">{review.clientEmail}</p>
                      </div>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{platformInfo.label}</Badge>
                      {renderStars(review.rating)}
                    </div>
                    {review.feedback ? (
                      <div className="mt-3 rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground">Interne feedback</p>
                        <p className="mt-1">{review.feedback}</p>
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => openQr(review.id, review.clientName)}>
                        <QrCode className="mr-2 h-3.5 w-3.5" />
                        QR code
                      </Button>
                      {review.status === "PENDING" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sendMutation.mutate({ id: review.id })}
                          disabled={sendMutation.isPending}
                        >
                          <Send className="mr-2 h-3.5 w-3.5" />
                          Verstuur
                        </Button>
                      )}
                      {(review.status === "SENT" || review.status === "OPENED" || review.status === "FEEDBACK") && (
                        <Link href={publicReviewUrl} target="_blank">
                          <Button variant="outline" size="sm">
                            <ExternalLink className="mr-2 h-3.5 w-3.5" />
                            Publieke pagina
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Klant</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verstuurd</TableHead>
                  <TableHead>Beoordeeld</TableHead>
                  <TableHead>Beoordeling</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead className="w-[180px]">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.reviews.map((review: NonNullable<typeof data>["reviews"][number]) => {
                  const statusInfo = STATUS_MAP[review.status] ?? STATUS_MAP.PENDING;
                  const platformInfo = PLATFORM_CONFIG[review.platform ?? "google"] ?? PLATFORM_CONFIG.google;
                  const PlatformIcon = platformInfo.icon;
                  const publicReviewUrl = `/review/${review.id}`;
                  return (
                    <TableRow key={review.id}>
                      <TableCell>
                        <div>
                          <p className="font-semibold">{review.clientName}</p>
                          <p className="text-xs text-muted-foreground">{review.clientEmail}</p>
                          {review.feedback ? (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              Interne feedback: {review.feedback}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <PlatformIcon className="h-3 w-3" />
                          {platformInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant}>
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(review.sentAt)}</TableCell>
                      <TableCell className="text-sm">{formatDate(review.reviewedAt)}</TableCell>
                      <TableCell>{renderStars(review.rating)}</TableCell>
                      <TableCell className="text-sm">
                        {review.lead ? (
                          <Link
                            href={`/leads/${review.lead.id}`}
                            className="text-primary hover:underline"
                          >
                            {review.lead.companyName}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {review.status === "PENDING" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                              onClick={() => sendMutation.mutate({ id: review.id })}
                              disabled={sendMutation.isPending}
                            >
                              <Send className="mr-1 h-3.5 w-3.5" />
                              Verstuur
                            </Button>
                          )}
                          {(review.status === "SENT" || review.status === "OPENED" || review.status === "FEEDBACK") && (
                            <Link href={publicReviewUrl} target="_blank">
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                                Publieke pagina
                              </Button>
                            </Link>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => openQr(review.id, review.clientName)}
                          >
                            <QrCode className="mr-1 h-3.5 w-3.5" />
                            QR
                          </Button>
                          {review.status === "REVIEWED" && review.reviewUrl && (
                            <a
                              href={review.reviewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                                Bekijk Review
                              </Button>
                            </a>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                            onClick={() => openDelete(review.id, review.clientName)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Aanvragen</DialogTitle>
            <DialogDescription>Verstuur een review-aanvraag naar een klant.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-clientName">Klantnaam *</Label>
              <Input id="create-clientName" name="clientName" required placeholder="Naam van de klant" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-clientEmail">E-mail *</Label>
              <Input
                id="create-clientEmail"
                name="clientEmail"
                type="email"
                required
                placeholder="klant@voorbeeld.be"
              />
            </div>
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label htmlFor="create-reviewUrl">Review URL (optioneel)</Label>
              <Input
                id="create-reviewUrl"
                name="reviewUrl"
                type="url"
                placeholder="https://g.page/r/abc/review"
              />
            </div>
            <div className="space-y-2">
              <Label>Gekoppelde lead (optioneel)</Label>
              <Select value={createLeadId} onValueChange={setCreateLeadId}>
                <SelectTrigger>
                  <SelectValue placeholder="Kies een lead..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Geen lead</SelectItem>
                  {leadsData?.items?.map((lead: NonNullable<typeof leadsData>["items"][number]) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Bezig..." : "Aanvraag Aanmaken"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(qrTarget)} onOpenChange={(open) => !open && setQrTarget(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Review QR code</DialogTitle>
            <DialogDescription>
              Deel deze QR met {qrTarget?.name} om rechtstreeks naar de publieke reviewpagina te gaan.
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Aanvraag Verwijderen</DialogTitle>
            <DialogDescription>
              Weet je zeker dat je de review-aanvraag van <strong>{deleteTarget?.name}</strong> wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Annuleren
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Verwijderen..." : "Verwijderen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
