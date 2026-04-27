"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import {
  Card, CardContent, CardHeader, CardTitle, Badge, Button, Skeleton,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
  Input, Label, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  CreateModal, EmptyState,
} from "@digitify/ui";
import {
  Calendar, Plus, Clock, CheckCircle2, XCircle, Trash2, Pencil,
  CalendarCheck, CalendarX, BarChart3, Settings2, ArrowRight, Sparkles, CalendarClock, Activity,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/feedback/toast-provider";

const STATUS_MAP: Record<string, { label: string; variant: "warning" | "info" | "default" | "success" | "destructive" | "secondary" }> = {
  PENDING: { label: "In Afwachting", variant: "warning" },
  SCHEDULED: { label: "Gepland", variant: "info" },
  CONFIRMED: { label: "Bevestigd", variant: "default" },
  COMPLETED: { label: "Voltooid", variant: "success" },
  CANCELLED: { label: "Geannuleerd", variant: "destructive" },
  REJECTED: { label: "Afgewezen", variant: "destructive" },
  NO_SHOW: { label: "Niet Verschenen", variant: "secondary" },
};

type BookingStatus = keyof typeof STATUS_MAP;

const DURATION_OPTIONS = [
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
  { value: "90", label: "90 min" },
  { value: "120", label: "120 min" },
];

function formatDateNice(d: Date | string) {
  const date = new Date(d);
  const days = ["zo", "ma", "di", "wo", "do", "vr", "za"];
  const months = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${dayName} ${day} ${month} ${year} om ${hours}:${minutes}`;
}

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export default function BookingsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{
    id: string; clientName: string; clientEmail: string; date: string; time: string; duration: number; notes: string;
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState<BookingStatus | undefined>(undefined);
  const [createDuration, setCreateDuration] = useState("60");
  const [editDuration, setEditDuration] = useState("60");
  const [createLeadId, setCreateLeadId] = useState("__none");
  const { showToast } = useToast();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.booking.list.useQuery(
    statusFilter ? { status: statusFilter as "PENDING" | "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "REJECTED" | "NO_SHOW" } : undefined
  );
  const { data: stats } = trpc.booking.getStats.useQuery();
  const { data: unifiedReminders } = trpc.dashboard.getUnifiedReminders.useQuery(undefined, {
    staleTime: 60_000,
  });
  const { data: recentActivity } = trpc.dashboard.getRecentActivity.useQuery(undefined, {
    staleTime: 30_000,
  });

  const createMutation = trpc.booking.create.useMutation({
    onSuccess: () => {
      utils.booking.list.invalidate();
      utils.booking.getStats.invalidate();
      setCreateOpen(false);
      showToast({ title: "Boeking opgeslagen", description: "De boeking is succesvol toegevoegd." });
    },
    onError: (error) => showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });
  const updateMutation = trpc.booking.update.useMutation({
    onSuccess: () => {
      utils.booking.list.invalidate();
      utils.booking.getStats.invalidate();
      setEditOpen(false);
      showToast({ title: "Boeking bijgewerkt", description: "De boeking is succesvol aangepast." });
    },
    onError: (error) => showToast({ title: "Bijwerken mislukt", description: error.message, variant: "error" }),
  });
  const deleteMutation = trpc.booking.delete.useMutation({
    onSuccess: () => {
      utils.booking.list.invalidate();
      utils.booking.getStats.invalidate();
      setDeleteOpen(false);
      setDeleteTarget(null);
      showToast({ title: "Boeking verwijderd", description: "De boeking is verwijderd." });
    },
    onError: (error) => showToast({ title: "Verwijderen mislukt", description: error.message, variant: "error" }),
  });

  // Fetch leads for linking
  const { data: leadsData } = trpc.lead.list.useQuery({
    page: 1,
    pageSize: 100,
    sortBy: "companyName",
    sortDir: "asc",
  });

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const dateStr = form.get("date") as string;
    const timeStr = form.get("time") as string;
    const date = new Date(`${dateStr}T${timeStr}`);
    createMutation.mutate({
      clientName: form.get("clientName") as string,
      clientEmail: (form.get("clientEmail") as string) || undefined,
      date: date.toISOString(),
      duration: parseInt(createDuration) || 60,
      notes: (form.get("notes") as string) || undefined,
      leadId: createLeadId && createLeadId !== "__none" ? createLeadId : undefined,
    });
  }

  function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editTarget) return;
    const form = new FormData(e.currentTarget);
    const dateStr = form.get("date") as string;
    const timeStr = form.get("time") as string;
    const date = new Date(`${dateStr}T${timeStr}`);

    updateMutation.mutate({
      id: editTarget.id,
      clientName: form.get("clientName") as string,
      clientEmail: (form.get("clientEmail") as string) || undefined,
      date: date.toISOString(),
      duration: parseInt(editDuration) || 60,
      notes: (form.get("notes") as string) || undefined,
    });
  }

  function openEdit(booking: NonNullable<typeof data>["bookings"][number]) {
    const d = new Date(booking.date);
    setEditTarget({
      id: booking.id,
      clientName: booking.clientName,
      clientEmail: booking.clientEmail || "",
      date: d.toISOString().split("T")[0] || "",
      time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      duration: booking.duration,
      notes: booking.notes || "",
    });
    setEditDuration(String(booking.duration));
    setEditOpen(true);
  }

  function openDelete(id: string, name: string) {
    setDeleteTarget({ id, name });
    setDeleteOpen(true);
  }

  // Sort bookings: upcoming first (closest date on top for SCHEDULED)
  const sortedBookings = data?.bookings
    ? [...data.bookings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];

  const filterTabs: Array<{ key: BookingStatus | undefined; label: string; count: number | undefined }> = [
    { key: undefined, label: "Alle", count: stats?.total },
    { key: "PENDING", label: "In Afwachting", count: (stats as any)?.pending },
    { key: "SCHEDULED", label: "Gepland", count: stats?.scheduled },
    { key: "CONFIRMED", label: "Bevestigd", count: (stats as any)?.confirmed },
    { key: "COMPLETED", label: "Voltooid", count: stats?.completed },
    { key: "CANCELLED", label: "Geannuleerd", count: stats?.cancelled },
    { key: "REJECTED", label: "Afgewezen", count: (stats as any)?.rejected },
    { key: "NO_SHOW", label: "Niet Verschenen", count: (stats as any)?.noShow },
  ];
  const now = new Date();
  const upcomingBookingsCount = sortedBookings.filter((booking) => new Date(booking.date) >= now).length;
  const nextBooking = sortedBookings.find((booking) => new Date(booking.date) >= now);
  const todayBookings = sortedBookings.filter((booking) => isSameCalendarDay(new Date(booking.date), now));
  const pendingBookings = sortedBookings.filter((booking) => booking.status === "PENDING");
  const confirmedBookings = sortedBookings.filter((booking) => booking.status === "CONFIRMED");
  const attentionBookings = sortedBookings.filter((booking) =>
    booking.status === "PENDING" ||
    booking.status === "REJECTED" ||
    booking.status === "NO_SHOW"
  );
  const bookingReminderItems = (unifiedReminders?.items || []).filter((item) => item.type === "booking_action");
  const bookingActivities = (recentActivity || []).filter((item) => {
    const metadata = (item.metadata ?? {}) as Record<string, unknown>;
    return typeof metadata.bookingId === "string";
  }).slice(0, 5);

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div className="app-page-heading">
          <h1 className="app-page-title">Boekingen</h1>
          <p className="app-page-subtitle">
            Beheer je planning, opvolging en publieke bookingflow vanuit een centrale werkqueue.
          </p>
        </div>
        <div className="app-page-actions">
          <Link href="/settings/bookings#google-agenda">
            <Button variant="outline" size="sm">
              <Calendar className="mr-2 h-4 w-4" />
              Google Agenda koppelen
            </Button>
          </Link>
          <Link href="/settings/bookings">
            <Button variant="outline" size="sm">
              <Settings2 className="mr-2 h-4 w-4" />
              Embed & Instellingen
            </Button>
          </Link>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nieuwe Boeking
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max gap-2">
          {filterTabs.map((tab) => (
            <Button
              key={tab.label}
              variant={statusFilter === tab.key ? "default" : "outline"}
              size="sm"
              className="whitespace-nowrap"
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
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Totaal Boekingen</p>
              <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gepland</p>
              <p className="text-2xl font-bold">{stats?.scheduled ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <CalendarCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Voltooid</p>
              <p className="text-2xl font-bold">{stats?.completed ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
              <CalendarX className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Geannuleerd</p>
              <p className="text-2xl font-bold">{stats?.cancelled ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
        <Card className="border-border/60 bg-gradient-to-br from-background via-background to-muted/30 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Focus Vandaag</p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight">
                  {todayBookings.length
                    ? `${todayBookings.length} afspraak${todayBookings.length !== 1 ? "en" : ""} vandaag`
                    : "Geen afspraken vandaag"}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {nextBooking
                    ? `De eerstvolgende afspraak is ${nextBooking.clientName} op ${formatDateNice(nextBooking.date)}.`
                    : "Er staat momenteel geen volgende afspraak in de pipeline."}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <CalendarClock className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border bg-background/90 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Wacht op reactie</p>
                <p className="mt-2 text-2xl font-semibold">{pendingBookings.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Nieuwe aanvragen die nog bevestigd of afgewezen moeten worden.</p>
              </div>
              <div className="rounded-2xl border bg-background/90 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Bevestigd</p>
                <p className="mt-2 text-2xl font-semibold">{confirmedBookings.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Afspraken die inhoudelijk klaar zijn en enkel nog moeten doorgaan.</p>
              </div>
              <div className="rounded-2xl border bg-background/90 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Actie nodig</p>
                <p className="mt-2 text-2xl font-semibold">{attentionBookings.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Pending, afgewezen of no-show afspraken die opvolging vragen.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Snelle Acties</p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight">Werk sneller vanuit boekingen</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Open direct de volgende stap zonder eerst door instellingen of de hele tabel te gaan.
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
                <Sparkles className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-5 grid gap-2">
              <Button variant={statusFilter === "PENDING" ? "default" : "outline"} className="justify-between" onClick={() => setStatusFilter("PENDING")}>
                Nieuwe aanvragen bekijken
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant={statusFilter === "CONFIRMED" ? "default" : "outline"} className="justify-between" onClick={() => setStatusFilter("CONFIRMED")}>
                Bevestigde afspraken openen
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="justify-between" asChild>
                <Link href="/settings/bookings">
                  Bookingflow aanpassen
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" className="justify-between" asChild>
                <Link href="/settings/bookings#google-agenda">
                  Google Agenda setup beheren
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Card className="border-emerald-200 bg-emerald-50/80 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Volgende afspraak</p>
            <p className="mt-2 text-sm font-medium">
              {nextBooking
                ? `${nextBooking.clientName} op ${formatDateNice(nextBooking.date)}`
                : "Er staat momenteel geen nieuwe afspraak in de toekomst."}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {upcomingBookingsCount} toekomstige boeking{upcomingBookingsCount !== 1 ? "en" : ""} in totaal.
            </p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/80 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Werkqueue</p>
            <p className="mt-2 text-sm font-medium">
              {stats?.pending ?? 0} in afwachting · {stats?.scheduled ?? 0} gepland · {stats?.confirmed ?? 0} bevestigd
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Gebruik dit als snelle operationele check voor planning en opvolging.
            </p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/80 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gerelateerd</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/settings/bookings">Boeking instellingen</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/embed/bookings">Open booking embed</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/leads">Leads openen</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Booking reminders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {bookingReminderItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Geen booking-reminders op dit moment. Nieuwe aanvragen en bijna-startende afspraken verschijnen hier automatisch.
              </p>
            ) : (
              bookingReminderItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                  </div>
                  <Button size="sm" variant="outline">Open</Button>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Recente booking activiteit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {bookingActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nog geen recente bookingactiviteit gevonden.</p>
            ) : (
              bookingActivities.map((activity) => (
                <div key={activity.id} className="rounded-xl border p-3">
                  <p className="text-sm font-medium">{activity.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {activity.user?.name ? `${activity.user.name} · ` : ""}
                    {formatDateNice(activity.createdAt)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
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
          ) : !sortedBookings.length ? (
            <EmptyState
              icon={<Calendar />}
              title="Geen boekingen gevonden"
              description="Maak een nieuwe boeking aan om te beginnen."
            />
          ) : (
            <>
            <div className="grid gap-3 p-4 xl:hidden">
              {sortedBookings.map((booking) => {
                const statusInfo = STATUS_MAP[booking.status] ?? { label: booking.status, variant: "secondary" as const };
                const bookingDate = new Date(booking.date);
                const isNextBooking = nextBooking?.id === booking.id;
                const isToday = isSameCalendarDay(bookingDate, now);
                return (
                  <div
                    key={booking.id}
                    className={cn(
                      "rounded-2xl border p-4",
                      isNextBooking && "border-primary/40 bg-primary/5",
                      isToday && !isNextBooking && "border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/10"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{booking.clientName}</p>
                          {isNextBooking ? <Badge variant="info">Volgende</Badge> : null}
                          {isToday ? <Badge variant="warning">Vandaag</Badge> : null}
                        </div>
                        {booking.clientEmail ? <p className="text-xs text-muted-foreground">{booking.clientEmail}</p> : null}
                      </div>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                      <p>{formatDateNice(booking.date)}</p>
                      <p>{booking.duration} min</p>
                      {booking.lead ? <p>{booking.lead.companyName}</p> : null}
                      {booking.notes ? <p className="line-clamp-2">{booking.notes}</p> : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(booking)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Bewerk
                      </Button>
                      {booking.status === "PENDING" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => updateMutation.mutate({ id: booking.id, status: "CONFIRMED" })}
                        >
                          <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                          Bevestig
                        </Button>
                      ) : null}
                      {(booking.status === "PENDING" || booking.status === "SCHEDULED") ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-blue-200 text-blue-700 hover:bg-blue-50"
                          onClick={() => updateMutation.mutate({ id: booking.id, status: "COMPLETED" })}
                        >
                          <CalendarCheck className="mr-2 h-3.5 w-3.5" />
                          Voltooi
                        </Button>
                      ) : null}
                      <Button variant="outline" size="sm" className="text-destructive" onClick={() => openDelete(booking.id, booking.clientName)}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Verwijder
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden xl:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Klant</TableHead>
                  <TableHead>Datum & Tijd</TableHead>
                  <TableHead>Duur</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Notities</TableHead>
                  <TableHead className="w-[180px]">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedBookings.map((booking) => {
                  const statusInfo = STATUS_MAP[booking.status] ?? { label: booking.status, variant: "secondary" as const };
                  const bookingDate = new Date(booking.date);
                  const isNextBooking = nextBooking?.id === booking.id;
                  const isToday = isSameCalendarDay(bookingDate, now);
                  return (
                    <TableRow
                      key={booking.id}
                      className={cn(
                        isNextBooking && "bg-primary/5",
                        isToday && !isNextBooking && "bg-amber-50/40 dark:bg-amber-950/10"
                      )}
                    >
                      <TableCell>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{booking.clientName}</p>
                            {isNextBooking ? <Badge variant="info">Volgende</Badge> : null}
                            {isToday ? <Badge variant="warning">Vandaag</Badge> : null}
                          </div>
                          {booking.clientEmail && (
                            <p className="text-xs text-muted-foreground">{booking.clientEmail}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDateNice(booking.date)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {booking.duration} min
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant}>
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {booking.lead ? (
                          <Link
                            href={`/leads/${booking.lead.id}`}
                            className="text-primary hover:underline"
                          >
                            {booking.lead.companyName}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {booking.notes ? (
                          <p className="truncate text-xs text-muted-foreground" title={booking.notes}>
                            {booking.notes}
                          </p>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => openEdit(booking)}
                            title="Bewerken"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {(booking.status === "PENDING" || booking.status === "SCHEDULED") && (
                            <>
                              {booking.status === "PENDING" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                                  onClick={() =>
                                    updateMutation.mutate({ id: booking.id, status: "CONFIRMED" })
                                  }
                                  title="Bevestigen"
                                >
                                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                  Bevestigen
                                </Button>
                              )}
                              {booking.status === "PENDING" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() =>
                                    updateMutation.mutate({ id: booking.id, status: "REJECTED" })
                                  }
                                  title="Afwijzen"
                                >
                                  <XCircle className="mr-1 h-3.5 w-3.5" />
                                  Afwijzen
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-green-700 hover:text-green-800 hover:bg-green-50"
                                onClick={() =>
                                  updateMutation.mutate({ id: booking.id, status: "COMPLETED" })
                                }
                                title="Voltooien"
                              >
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                Voltooien
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() =>
                                  updateMutation.mutate({ id: booking.id, status: "CANCELLED" })
                                }
                                title="Annuleren"
                              >
                                <XCircle className="mr-1 h-3.5 w-3.5" />
                                Annuleren
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                            onClick={() => openDelete(booking.id, booking.clientName)}
                            title="Verwijderen"
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
            <DialogTitle>Nieuwe Boeking</DialogTitle>
            <DialogDescription>Maak een nieuwe afspraak aan.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-clientName">Klantnaam *</Label>
              <Input id="create-clientName" name="clientName" required placeholder="Naam van de klant" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-clientEmail">E-mail</Label>
              <Input id="create-clientEmail" name="clientEmail" type="email" placeholder="klant@voorbeeld.be" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-date">Datum *</Label>
                <Input id="create-date" name="date" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-time">Tijd *</Label>
                <Input id="create-time" name="time" type="time" required defaultValue="10:00" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Duur</Label>
              <Select value={createDuration} onValueChange={setCreateDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="space-y-2">
              <Label htmlFor="create-notes">Notities</Label>
              <Textarea id="create-notes" name="notes" placeholder="Optionele notities..." rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Bezig..." : "Boeking Aanmaken"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Boeking Bewerken</DialogTitle>
            <DialogDescription>Pas de gegevens van de boeking aan.</DialogDescription>
          </DialogHeader>
          {editTarget && (
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-clientName">Klantnaam *</Label>
                <Input id="edit-clientName" name="clientName" required defaultValue={editTarget.clientName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-clientEmail">E-mail</Label>
                <Input id="edit-clientEmail" name="clientEmail" type="email" defaultValue={editTarget.clientEmail} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-date">Datum *</Label>
                  <Input id="edit-date" name="date" type="date" required defaultValue={editTarget.date} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-time">Tijd *</Label>
                  <Input id="edit-time" name="time" type="time" required defaultValue={editTarget.time} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Duur</Label>
                <Select value={editDuration} onValueChange={setEditDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notities</Label>
                <Textarea id="edit-notes" name="notes" defaultValue={editTarget.notes} rows={3} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Annuleren
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Opslaan..." : "Wijzigingen Opslaan"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <CreateModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Boeking verwijderen"
        description={
          deleteTarget
            ? `Weet je zeker dat je de boeking van ${deleteTarget.name} wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`
            : ""
        }
        submitLabel="Verwijderen"
        submitVariant="destructive"
        pending={deleteMutation.isPending}
        onSubmit={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
      >
        <p className="text-sm text-muted-foreground">
          Verwijderde boekingen zijn niet meer terug te halen.
        </p>
      </CreateModal>
    </div>
  );
}
