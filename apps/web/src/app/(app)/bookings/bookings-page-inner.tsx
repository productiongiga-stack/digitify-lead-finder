"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { cn, safeExternalUrl } from "@/lib/utils";
import { readSettingBoolean, readSettingString } from "@/lib/settings";
import { getAppUrl } from "@/lib/config";
import {
  Card, CardContent, CardHeader, CardTitle, Badge, Button, Skeleton,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
  Input, Label, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  CreateModal, EmptyState, Tabs, TabsContent, TabsList, TabsTrigger,
} from "@digitify/ui";
import {
  Calendar, Plus, Clock, CheckCircle2, XCircle, Trash2, Pencil,
  CalendarCheck, CalendarX, BarChart3, Settings2, ArrowRight, Sparkles, CalendarClock, Activity, Download,
  Search, Tags, X, Globe, ExternalLink,
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

function startOfDay(value: Date) {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(value: Date, days: number) {
  const copy = new Date(value);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatAgendaDayLabel(value: Date) {
  const today = startOfDay(new Date());
  const target = startOfDay(value);
  if (target.getTime() === today.getTime()) return "Vandaag";
  const tomorrow = addDays(today, 1);
  if (target.getTime() === tomorrow.getTime()) return "Morgen";
  return formatDateNice(value).split(" om ")[0] || formatDateNice(value);
}

function formatAgendaTime(value: Date, allDay?: boolean) {
  if (allDay) return "Hele dag";
  return value.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
}

type AgendaListItem =
  | {
      kind: "booking";
      id: string;
      title: string;
      start: Date;
      end: Date;
      booking: {
        id: string;
        clientName: string;
        clientEmail: string | null;
        status: string;
        duration: number;
        googleSyncState: string | null;
        eventType?: { name: string; color: string | null } | null;
      };
    }
  | {
      kind: "google";
      id: string;
      title: string;
      start: Date;
      end: Date;
      htmlLink: string | null;
      allDay: boolean;
    };

function getSyncBadge(state: string | null | undefined) {
  if (state === "SYNCED") return { label: "Synced", variant: "success" as const };
  if (state === "RETRYING") return { label: "Retrying", variant: "warning" as const };
  if (state === "ERROR") return { label: "Sync fout", variant: "destructive" as const };
  return { label: "Sync uit", variant: "secondary" as const };
}

function readStringProperty(source: unknown, key: string) {
  if (!source || typeof source !== "object") return "";
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function readNumberProperty(source: unknown, key: string) {
  if (!source || typeof source !== "object") return undefined;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getGoogleSyncState(source: unknown) {
  return readStringProperty(source, "googleSyncState") || undefined;
}

export function BookingsPageInner() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{
    id: string; clientName: string; clientEmail: string; date: string; time: string; duration: number; notes: string;
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState<BookingStatus | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("__all");
  const [createDuration, setCreateDuration] = useState("60");
  const [editDuration, setEditDuration] = useState("60");
  const [createLeadId, setCreateLeadId] = useState("__none");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);
  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null);
  const [confirmClientName, setConfirmClientName] = useState("");
  const [confirmClientEmail, setConfirmClientEmail] = useState("");
  const [confirmLocation, setConfirmLocation] = useState("");
  const [confirmNotes, setConfirmNotes] = useState("");
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [bookingsTab, setBookingsTab] = useState("list");
  const { showToast } = useToast();
  const utils = trpc.useUtils();

  const agendaRangeStart = useMemo(() => startOfDay(new Date()), []);
  const agendaRangeEnd = useMemo(() => {
    const end = addDays(agendaRangeStart, 14);
    end.setHours(23, 59, 59, 999);
    return end;
  }, [agendaRangeStart]);

  const { data: agendaData, isLoading: agendaLoading } = trpc.booking.getAgenda.useQuery(
    { from: agendaRangeStart.toISOString(), to: agendaRangeEnd.toISOString() },
    { enabled: bookingsTab === "agenda" }
  );

  const agendaByDay = useMemo(() => {
    if (!agendaData) return [] as Array<{ day: Date; items: AgendaListItem[] }>;
    const items: AgendaListItem[] = [];
    for (const booking of agendaData.bookings) {
      const start = new Date(booking.date);
      items.push({
        kind: "booking",
        id: booking.id,
        title: booking.clientName,
        start,
        end: new Date(start.getTime() + booking.duration * 60_000),
        booking: {
          id: booking.id,
          clientName: booking.clientName,
          clientEmail: booking.clientEmail,
          status: booking.status,
          duration: booking.duration,
          googleSyncState: booking.googleSyncState,
          eventType: booking.eventType,
        },
      });
    }
    for (const event of agendaData.externalGoogleEvents) {
      items.push({
        kind: "google",
        id: event.id,
        title: event.title,
        start: new Date(event.start),
        end: new Date(event.end),
        htmlLink: event.htmlLink,
        allDay: event.allDay,
      });
    }
    items.sort((left, right) => left.start.getTime() - right.start.getTime());
    const groups = new Map<string, AgendaListItem[]>();
    for (const item of items) {
      const key = startOfDay(item.start).toISOString();
      const dayItems = groups.get(key) || [];
      dayItems.push(item);
      groups.set(key, dayItems);
    }
    return Array.from(groups.entries()).map(([key, dayItems]) => ({
      day: new Date(key),
      items: dayItems,
    }));
  }, [agendaData]);

  const { data, isLoading } = trpc.booking.list.useQuery(
    {
      ...(statusFilter ? { status: statusFilter as "PENDING" | "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "REJECTED" | "NO_SHOW" } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(eventTypeFilter !== "__all" ? { eventTypeId: eventTypeFilter } : {}),
    }
  );
  const { data: stats } = trpc.booking.getStats.useQuery();
  const { data: settingsData } = trpc.settings.getBookingsPageSettings.useQuery(undefined, {
    staleTime: 5 * 60_000,
    refetchOnMount: false,
  });
  const { data: eventTypes } = trpc.booking.listEventTypes.useQuery();
  type EventType = NonNullable<NonNullable<typeof eventTypes>[number]>;
  const eventTypeItems = (eventTypes ?? []).filter((item): item is EventType => Boolean(item));
  const { data: unifiedReminders } = trpc.dashboard.getUnifiedReminders.useQuery(undefined, {
    staleTime: 60_000,
  });
  const { data: recentActivity } = trpc.dashboard.getRecentActivity.useQuery(undefined, {
    staleTime: 30_000,
  });

  const createMutation = trpc.booking.create.useMutation({
    onSuccess: (result) => {
      utils.booking.list.invalidate();
      utils.booking.getStats.invalidate();
      setCreateOpen(false);
      const sync = getSyncBadge(getGoogleSyncState(result));
      showToast({ title: "Boeking opgeslagen", description: sync.label === "Synced" ? "De boeking is succesvol toegevoegd." : `Boeking opgeslagen. Google sync: ${sync.label}.` });
    },
    onError: (error) => showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });
  const updateMutation = trpc.booking.update.useMutation({
    onSuccess: (result) => {
      utils.booking.list.invalidate();
      utils.booking.getStats.invalidate();
      setEditOpen(false);
      const sync = getSyncBadge(getGoogleSyncState(result));
      showToast({ title: "Boeking bijgewerkt", description: sync.label === "Synced" ? "De boeking is succesvol aangepast." : `Boeking aangepast. Google sync: ${sync.label}.` });
    },
    onError: (error) => showToast({ title: "Bijwerken mislukt", description: error.message, variant: "error" }),
  });
  const confirmMutation = trpc.booking.confirm.useMutation({
    onSuccess: (result) => {
      utils.booking.list.invalidate();
      utils.booking.getStats.invalidate();
      const sync = getSyncBadge(getGoogleSyncState(result));
      showToast({ title: "Boeking bevestigd", description: sync.label === "Synced" ? "De klant kreeg een bevestiging met kalenderbestand." : `Bevestigd. Google sync: ${sync.label}.` });
    },
    onError: (error) => showToast({ title: "Bevestigen mislukt", description: error.message, variant: "error" }),
  });
  const rejectMutation = trpc.booking.reject.useMutation({
    onSuccess: (result) => {
      utils.booking.list.invalidate();
      utils.booking.getStats.invalidate();
      const sync = getSyncBadge(getGoogleSyncState(result));
      showToast({ title: "Boeking afgewezen", description: `De klant kreeg een update. Google sync: ${sync.label}.` });
    },
    onError: (error) => showToast({ title: "Afwijzen mislukt", description: error.message, variant: "error" }),
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
  const settingsUpdateMutation = trpc.settings.update.useMutation({
    onSuccess: () => utils.settings.getBookingsPageSettings.invalidate(),
    onError: (error) => showToast({ title: "Compact modus opslaan mislukt", description: error.message, variant: "error" }),
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

  function openConfirmWizard(booking: NonNullable<typeof data>["bookings"][number]) {
    setConfirmTargetId(booking.id);
    setConfirmClientName(booking.clientName || "");
    setConfirmClientEmail(booking.clientEmail || "");
    setConfirmLocation(readStringProperty(booking, "location"));
    setConfirmNotes(booking.notes || "");
    setConfirmStep(1);
    setConfirmOpen(true);
  }

  async function submitConfirmWizard() {
    if (!confirmTargetId) return;
    setConfirmSubmitting(true);
    try {
      await updateMutation.mutateAsync({
        id: confirmTargetId,
        clientName: confirmClientName,
        clientEmail: confirmClientEmail || undefined,
        notes: confirmNotes || undefined,
        location: confirmLocation || undefined,
      });
      await confirmMutation.mutateAsync({ id: confirmTargetId });
      setConfirmOpen(false);
      setConfirmStep(1);
      setConfirmTargetId(null);
      showToast({ title: "Afspraak bevestigd", description: "De afspraak is bevestigd en verzonden." });
    } catch (error: any) {
      showToast({ title: "Bevestigen mislukt", description: error?.message || "Onbekende fout", variant: "error" });
    } finally {
      setConfirmSubmitting(false);
    }
  }

  // Sort bookings: upcoming first (closest date on top for SCHEDULED)
  const sortedBookings = data?.bookings
    ? [...data.bookings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];

  const pendingCount = readNumberProperty(stats, "pending") ?? 0;
  const confirmedCount = readNumberProperty(stats, "confirmed") ?? 0;
  const rejectedCount = readNumberProperty(stats, "rejected") ?? 0;
  const noShowCount = readNumberProperty(stats, "noShow") ?? 0;

  const filterTabs: Array<{ key: BookingStatus | undefined; label: string; count: number | undefined }> = [
    { key: undefined, label: "Alle", count: stats?.total },
    { key: "PENDING", label: "In Afwachting", count: pendingCount },
    { key: "SCHEDULED", label: "Gepland", count: stats?.scheduled },
    { key: "CONFIRMED", label: "Bevestigd", count: confirmedCount },
    { key: "COMPLETED", label: "Voltooid", count: stats?.completed },
    { key: "CANCELLED", label: "Geannuleerd", count: stats?.cancelled },
    { key: "REJECTED", label: "Afgewezen", count: rejectedCount },
    { key: "NO_SHOW", label: "Niet Verschenen", count: noShowCount },
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
  const compactFromSettings = readSettingBoolean(settingsData, "ui.bookings_compact", false);
  const effectiveCompactMode = compactMode || compactFromSettings;
  const publicTenantToken = readSettingString(settingsData, "chatbot.public_tenant_token", "");
  const bookingEmbedUrl = `${getAppUrl()}/embed/bookings${publicTenantToken ? `?tenant=${encodeURIComponent(publicTenantToken)}` : ""}`;

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const next = !effectiveCompactMode;
              setCompactMode(next);
              settingsUpdateMutation.mutate({ key: "ui.bookings_compact", value: String(next) });
            }}
          >
            {effectiveCompactMode ? "Compact: aan" : "Compact: uit"}
          </Button>
          <Link href="/bookings/analytics">
            <Button variant="outline" size="sm">
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </Button>
          </Link>
          <a href="/api/bookings/export" download>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </a>
          <Link href="/settings/bookings#google-agenda">
            <Button variant="outline" size="sm">
              <Calendar className="mr-2 h-4 w-4" />
              Google Agenda
            </Button>
          </Link>
          <Link href="/settings/bookings">
            <Button variant="outline" size="sm">
              <Settings2 className="mr-2 h-4 w-4" />
              Instellingen
            </Button>
          </Link>
          <Button size="sm" asChild>
            <a href={bookingEmbedUrl} target="_blank" rel="noopener noreferrer">
              <Plus className="mr-2 h-4 w-4" />
              Nieuwe Boeking
            </a>
          </Button>
        </div>
      </div>

      {/* Pending bookings alert */}
      {pendingCount > 0 ? (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {pendingCount} boeking{pendingCount !== 1 ? "en" : ""} wacht op bevestiging
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Controleer en bevestig of wijs af via de lijst hieronder.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-300 bg-white text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:bg-transparent dark:text-amber-300"
            onClick={() => setStatusFilter("PENDING")}
          >
            Bekijk
          </Button>
        </div>
      ) : null}

      {/* Shared filters rendered once, used by both List and Overview tabs */}
      <section className={cn("bookings-filters", effectiveCompactMode && "gap-2 p-3")} aria-label="Boekingen filteren">
        <div className="flex flex-wrap items-center justify-between gap-2 md:col-span-2 lg:col-span-4">
          <div>
            <p className="text-sm font-semibold tracking-tight text-foreground">Filteren</p>
            <p className="text-xs text-muted-foreground">Zoek en verfijn afspraken op periode, type en klant.</p>
          </div>
          {search.trim() || dateFrom || dateTo || eventTypeFilter !== "__all" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg border border-border/60 bg-background/80 px-3 text-xs text-muted-foreground hover:bg-background"
              onClick={() => {
                setSearch("");
                setDateFrom("");
                setDateTo("");
                setEventTypeFilter("__all");
              }}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Filters wissen
            </Button>
          ) : null}
        </div>
        <div className="bookings-filter-field">
          <span className="bookings-filter-label">
            <Search className="h-3.5 w-3.5" />
            Zoeken
          </span>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Klant, e-mail of notitie..."
            className="bookings-filter-control"
          />
        </div>
        <div className="bookings-filter-field">
          <span className="bookings-filter-label">
            <Calendar className="h-3.5 w-3.5" />
            Vanaf
          </span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="bookings-filter-control"
          />
        </div>
        <div className="bookings-filter-field">
          <span className="bookings-filter-label">
            <Calendar className="h-3.5 w-3.5" />
            Tot
          </span>
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="bookings-filter-control"
          />
        </div>
        <div className="bookings-filter-field">
          <span className="bookings-filter-label">
            <Tags className="h-3.5 w-3.5" />
            Bookingtype
          </span>
          <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
            <SelectTrigger className="bookings-filter-control w-full">
              <SelectValue placeholder="Alle types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Alle bookingtypes</SelectItem>
              {eventTypeItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max gap-2">
          {filterTabs.map((tab) => (
            <Button key={tab.label} variant={statusFilter === tab.key ? "default" : "outline"} size="sm" className="whitespace-nowrap" onClick={() => setStatusFilter(tab.key)}>
              {tab.label}
              {tab.count !== undefined && <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1 text-xs">{tab.count}</Badge>}
            </Button>
          ))}
        </div>
      </div>

      <Tabs value={bookingsTab} onValueChange={setBookingsTab} className="space-y-4">
        <TabsList className="bookings-view-tabs">
          <TabsTrigger value="list" className="bookings-view-tab-trigger">Lijst</TabsTrigger>
          <TabsTrigger value="agenda" className="bookings-view-tab-trigger">Agenda</TabsTrigger>
          <TabsTrigger value="overview" className="bookings-view-tab-trigger">Overzicht</TabsTrigger>
          <TabsTrigger value="automations" className="bookings-view-tab-trigger">Automations</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <Card className="app-surface">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-3 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : !sortedBookings.length ? (
                <EmptyState icon={<Calendar />} title="Geen boekingen gevonden" description="Maak een nieuwe boeking aan om te beginnen." />
              ) : (
                <div className={cn("grid gap-3", effectiveCompactMode ? "p-3" : "p-4")}>
                  {sortedBookings.map((booking) => {
                    const statusInfo = STATUS_MAP[booking.status] ?? { label: booking.status, variant: "secondary" as const };
                    const syncInfo = getSyncBadge(getGoogleSyncState(booking));
                    const bookingDate = new Date(booking.date);
                    return (
                      <div key={booking.id} className={cn("rounded-2xl border border-border/60 bg-background/45 shadow-sm", effectiveCompactMode ? "p-3" : "p-4")} role="article" aria-label={`Boeking ${booking.clientName}`}>
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">{booking.clientName}</p>
                              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                              <Badge variant={syncInfo.variant}>{syncInfo.label}</Badge>
                            </div>
                            {booking.clientEmail ? <p className="text-xs text-muted-foreground">{booking.clientEmail}</p> : null}
                          </div>
                          <p className="shrink-0 text-xs text-muted-foreground">{formatDateNice(bookingDate)}</p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" aria-label={`Bewerk boeking ${booking.clientName}`} onClick={() => openEdit(booking)}><Pencil className="mr-2 h-3.5 w-3.5" />Bewerk</Button>
                          {booking.status === "PENDING" ? <Button variant="outline" size="sm" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" aria-label={`Bevestig boeking ${booking.clientName}`} onClick={() => openConfirmWizard(booking)}><CheckCircle2 className="mr-2 h-3.5 w-3.5" />Bevestig</Button> : null}
                          {booking.status === "PENDING" ? <Button variant="outline" size="sm" className="border-red-200 text-red-700 hover:bg-red-50" aria-label={`Wijs boeking af voor ${booking.clientName}`} onClick={() => rejectMutation.mutate({ id: booking.id })}><XCircle className="mr-2 h-3.5 w-3.5" />Afwijzen</Button> : null}
                          {(booking.status === "PENDING" || booking.status === "SCHEDULED") ? <Button variant="outline" size="sm" className="border-blue-200 text-blue-700 hover:bg-blue-50" aria-label={`Markeer als voltooid: ${booking.clientName}`} onClick={() => updateMutation.mutate({ id: booking.id, status: "COMPLETED" })}><CalendarCheck className="mr-2 h-3.5 w-3.5" />Voltooi</Button> : null}
                          <Button variant="outline" size="sm" className="text-destructive" aria-label={`Verwijder boeking ${booking.clientName}`} onClick={() => openDelete(booking.id, booking.clientName)}><Trash2 className="mr-2 h-3.5 w-3.5" />Verwijder</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agenda" className="space-y-4">
          <Card className="app-surface">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Gecombineerde agenda</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Digitify-boekingen en overige afspraken uit je gekoppelde Google Agenda (14 dagen vooruit).
                  </p>
                </div>
                {agendaData?.googleEnabled ? (
                  <Badge variant="secondary" className="gap-1.5">
                    <Globe className="h-3.5 w-3.5" />
                    {agendaData.googleAccountEmail || "Google gekoppeld"}
                  </Badge>
                ) : (
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/settings/bookings#google-agenda">Google Agenda koppelen</Link>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {agendaLoading ? (
                <div className="space-y-3">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div>
              ) : !agendaByDay.length ? (
                <EmptyState
                  icon={<CalendarClock />}
                  title="Geen afspraken in deze periode"
                  description={
                    agendaData?.googleEnabled
                      ? "Er staan geen boekingen of externe Google-afspraken in de komende 14 dagen."
                      : "Koppel Google Agenda om externe afspraken naast je boekingen te tonen."
                  }
                />
              ) : (
                <div className="space-y-5">
                  {agendaByDay.map((group) => (
                    <section key={group.day.toISOString()} className="space-y-2">
                      <h3 className="text-sm font-semibold text-foreground">{formatAgendaDayLabel(group.day)}</h3>
                      <div className="space-y-2">
                        {group.items.map((item) => {
                          if (item.kind === "booking") {
                            const statusInfo = STATUS_MAP[item.booking.status] ?? { label: item.booking.status, variant: "secondary" as const };
                            const syncInfo = getSyncBadge(item.booking.googleSyncState);
                            return (
                              <div
                                key={`booking-${item.id}`}
                                className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium">{item.title}</p>
                                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                                    <Badge variant={syncInfo.variant}>{syncInfo.label}</Badge>
                                    <Badge variant="outline">Digitify</Badge>
                                  </div>
                                  {item.booking.eventType?.name ? (
                                    <p className="text-xs text-muted-foreground">{item.booking.eventType.name}</p>
                                  ) : null}
                                </div>
                                <p className="shrink-0 text-sm text-muted-foreground">
                                  {formatAgendaTime(item.start)} – {formatAgendaTime(item.end)}
                                </p>
                              </div>
                            );
                          }

                          const htmlLinkUrl = safeExternalUrl(item.htmlLink);

                          return (
                            <div
                              key={`google-${item.id}`}
                              className="flex flex-col gap-2 rounded-xl border border-dashed border-sky-300/70 bg-sky-50/50 p-3 dark:border-sky-800/60 dark:bg-sky-950/20 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium">{item.title}</p>
                                  <Badge variant="outline" className="gap-1 border-sky-300/80 text-sky-800 dark:text-sky-200">
                                    <Globe className="h-3 w-3" />
                                    Google Agenda
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-3">
                                <p className="text-sm text-muted-foreground">
                                  {formatAgendaTime(item.start, item.allDay)}
                                  {!item.allDay ? ` – ${formatAgendaTime(item.end)}` : ""}
                                </p>
                                {htmlLinkUrl ? (
                                  <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
                                    <a href={htmlLinkUrl} target="_blank" rel="noreferrer">
                                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                      Open
                                    </a>
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-3">
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
                          onClick={() => openConfirmWizard(booking)}
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
                                  onClick={() => openConfirmWizard(booking)}
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
                                  onClick={() => rejectMutation.mutate({ id: booking.id })}
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
        </TabsContent>

        <TabsContent value="automations" className="space-y-4">
          {/* Status metrics */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "In afwachting",
                value: pendingCount,
                cardClass: "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20",
                iconClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                icon: <Clock className="h-4 w-4" />,
                action: () => setStatusFilter("PENDING"),
              },
              {
                label: "Bevestigd",
                value: confirmedCount,
                cardClass: "border-blue-200 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20",
                iconClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
                icon: <CheckCircle2 className="h-4 w-4" />,
                action: () => setStatusFilter("CONFIRMED"),
              },
              {
                label: "Voltooid",
                value: stats?.completed ?? 0,
                cardClass: "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20",
                iconClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                icon: <CalendarCheck className="h-4 w-4" />,
                action: () => setStatusFilter("COMPLETED"),
              },
              {
                label: "Niet verschenen",
                value: noShowCount,
                cardClass: "border-red-200 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20",
                iconClass: "bg-red-500/15 text-red-600 dark:text-red-400",
                icon: <CalendarX className="h-4 w-4" />,
                action: () => setStatusFilter("NO_SHOW"),
              },
            ].map(({ label, value, cardClass, iconClass, icon, action }) => (
              <button
                key={label}
                type="button"
                onClick={action}
                className={cn("rounded-2xl border p-4 text-left transition hover:shadow-sm", cardClass)}
              >
                <div className={cn("mb-2 flex h-9 w-9 items-center justify-center rounded-xl", iconClass)}>
                  {icon}
                </div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
              </button>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {/* Active reminders */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  Aankomende reminders
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {bookingReminderItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">Geen reminders op dit moment.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Nieuwe aanvragen en bijna-startende afspraken verschijnen hier automatisch.</p>
                  </div>
                ) : (
                  bookingReminderItems.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                      </div>
                      <Button size="sm" variant="outline">Open</Button>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Recent activity */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-primary" />
                  Recente activiteit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {bookingActivities.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">Nog geen recente bookingactiviteit.</p>
                  </div>
                ) : (
                  bookingActivities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 rounded-xl border p-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Activity className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{activity.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {activity.user?.name ? `${activity.user.name} · ` : ""}
                          {formatDateNice(activity.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick links */}
          <Card className="border-border/60 shadow-sm">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <p className="text-sm font-medium text-muted-foreground">Snelle acties:</p>
              <Button asChild size="sm" variant="outline">
                <Link href="/settings/bookings">
                  <Settings2 className="mr-2 h-3.5 w-3.5" />
                  Bookingflow aanpassen
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/settings/bookings#google-agenda">
                  <Calendar className="mr-2 h-3.5 w-3.5" />
                  Google Agenda setup
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href="/embed/bookings" target="_blank" rel="noreferrer">
                  <ArrowRight className="mr-2 h-3.5 w-3.5" />
                  Embed bekijken
                </a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Afspraak bevestigen</DialogTitle>
            <DialogDescription>
              Werk in stappen: controleer eerst de gegevens en verzend daarna de bevestiging.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={confirmStep === 1 ? "default" : "secondary"}>1. Gegevens</Badge>
              <Badge variant={confirmStep === 2 ? "default" : "secondary"}>2. Controle & verzenden</Badge>
            </div>

            {confirmStep === 1 ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Naam</Label>
                  <Input value={confirmClientName} onChange={(event) => setConfirmClientName(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={confirmClientEmail} onChange={(event) => setConfirmClientEmail(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Locatie</Label>
                  <Input value={confirmLocation} onChange={(event) => setConfirmLocation(event.target.value)} placeholder="Google Meet / kantoor / ..." />
                </div>
                <div className="space-y-2">
                  <Label>Notities</Label>
                  <Textarea rows={3} value={confirmNotes} onChange={(event) => setConfirmNotes(event.target.value)} />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border p-3 text-sm">
                <p><span className="text-muted-foreground">Naam:</span> {confirmClientName || "-"}</p>
                <p><span className="text-muted-foreground">E-mail:</span> {confirmClientEmail || "-"}</p>
                <p><span className="text-muted-foreground">Locatie:</span> {confirmLocation || "-"}</p>
                <p className="mt-2"><span className="text-muted-foreground">Notities:</span> {confirmNotes || "-"}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Sluiten
            </Button>
            {confirmStep === 1 ? (
              <Button
                type="button"
                onClick={() => setConfirmStep(2)}
                disabled={!confirmClientName.trim()}
              >
                Verder
              </Button>
            ) : (
              <Button type="button" onClick={submitConfirmWizard} disabled={confirmSubmitting}>
                {confirmSubmitting ? "Verzenden..." : "Bevestigen en verzenden"}
              </Button>
            )}
          </DialogFooter>
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
        onSubmit={() => {
          if (deleteTarget) deleteMutation.mutate({ id: deleteTarget.id });
        }}
      >
        <p className="text-sm text-muted-foreground">
          Verwijderde boekingen zijn niet meer terug te halen.
        </p>
      </CreateModal>
    </div>
  );
}
