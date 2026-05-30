"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@digitify/ui";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutList,
  PenSquare,
} from "lucide-react";
import {
  formatDateKeyInZone,
  formatTimeInZone,
  formatTimezoneLabel,
  toBookingIso,
  zonedDateTimeToUtc,
} from "@/lib/booking-timezone";
import {
  OUTBOUND_EMAIL_TYPE_OPTIONS,
  OUTBOUND_SOURCE_MODULE_OPTIONS,
  getOutboundEmailTypeLabel,
  getOutboundSourceModuleLabel,
} from "@/lib/outbound-source";
import {
  OUTBOUND_STATUS_LABELS,
  OUTBOUND_STATUS_VARIANTS,
  getOutboundStatusForDisplay,
  getOutboundStatusLabel,
} from "@/lib/contact-status";

const AGENDA_TIMEZONE = "Europe/Brussels";

type AgendaView = "day" | "week" | "month";

type AgendaItem = {
  id: string;
  subject: string;
  status: string;
  type: string;
  scheduledFor: Date | string;
  sequenceStep: number | null;
  sourceModule: string;
  lead: { id: string; companyName: string } | null;
  toEmail: string;
  sequence: { id: string; name: string } | null;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

function startOfMonth(date: Date) {
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
}

function endOfMonth(date: Date) {
  return startOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function createMonthGrid(month: Date) {
  const first = startOfMonth(month);
  const offset = (first.getDay() + 6) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function getRangeForView(anchor: Date, view: AgendaView) {
  if (view === "day") {
    const key = formatDateKeyInZone(anchor, AGENDA_TIMEZONE);
    return {
      rangeStart: zonedDateTimeToUtc(key, "00:00", AGENDA_TIMEZONE),
      rangeEnd: zonedDateTimeToUtc(key, "23:59", AGENDA_TIMEZONE),
      label: anchor.toLocaleDateString("nl-BE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    };
  }
  if (view === "week") {
    const weekStart = startOfWeek(anchor);
    const weekEnd = addDays(weekStart, 6);
    const startKey = formatDateKeyInZone(weekStart, AGENDA_TIMEZONE);
    const endKey = formatDateKeyInZone(weekEnd, AGENDA_TIMEZONE);
    return {
      rangeStart: zonedDateTimeToUtc(startKey, "00:00", AGENDA_TIMEZONE),
      rangeEnd: zonedDateTimeToUtc(endKey, "23:59", AGENDA_TIMEZONE),
      label: `${weekStart.toLocaleDateString("nl-BE", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" })}`,
    };
  }
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const startKey = formatDateKeyInZone(monthStart, AGENDA_TIMEZONE);
  const endKey = formatDateKeyInZone(monthEnd, AGENDA_TIMEZONE);
  return {
    rangeStart: zonedDateTimeToUtc(startKey, "00:00", AGENDA_TIMEZONE),
    rangeEnd: zonedDateTimeToUtc(endKey, "23:59", AGENDA_TIMEZONE),
    label: anchor.toLocaleDateString("nl-BE", { month: "long", year: "numeric" }),
  };
}

function shiftAnchor(anchor: Date, view: AgendaView, direction: -1 | 1) {
  if (view === "day") return addDays(anchor, direction);
  if (view === "week") return addDays(anchor, direction * 7);
  return startOfDay(new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1));
}

function groupByDateKey(items: AgendaItem[]) {
  const map = new Map<string, AgendaItem[]>();
  for (const item of items) {
    if (!item.scheduledFor) continue;
    const key = formatDateKeyInZone(new Date(item.scheduledFor), AGENDA_TIMEZONE);
    const bucket = map.get(key) ?? [];
    bucket.push(item);
    map.set(key, bucket);
  }
  for (const bucket of map.values()) {
    bucket.sort(
      (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
    );
  }
  return map;
}

function AgendaEventCard({
  item,
  onReschedule,
}: {
  item: AgendaItem;
  onReschedule: (item: AgendaItem) => void;
}) {
  const when = new Date(item.scheduledFor);
  const displayStatus = getOutboundStatusForDisplay(item.status);

  return (
    <div className="rounded-lg border border-border/70 bg-background/90 p-2.5 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{item.subject}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {item.lead?.companyName ?? item.toEmail}
            {item.sequenceStep ? ` · stap ${item.sequenceStep}` : ""}
          </p>
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          {formatTimeInZone(when, AGENDA_TIMEZONE)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant={OUTBOUND_STATUS_VARIANTS[displayStatus] || "secondary"} className="text-[10px]">
          {getOutboundStatusLabel(item.status, item.scheduledFor)}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {getOutboundSourceModuleLabel(item.sourceModule)}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {getOutboundEmailTypeLabel(item.type)}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onReschedule(item)}>
          <Clock className="mr-1 h-3 w-3" />
          Verplaats
        </Button>
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Link href={`/contacts/drafts/${item.id}`}>
            <PenSquare className="mr-1 h-3 w-3" />
            Open
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function OutboundAgendaPanel() {
  const [view, setView] = useState<AgendaView>("week");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [sourceFilter, setSourceFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [rescheduleTarget, setRescheduleTarget] = useState<AgendaItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("09:00");

  const utils = trpc.useUtils();
  const range = useMemo(() => getRangeForView(anchor, view), [anchor, view]);

  const { data, isLoading } = trpc.contact.listAgenda.useQuery({
    rangeStart: range.rangeStart.toISOString(),
    rangeEnd: range.rangeEnd.toISOString(),
    type: typeFilter ? (typeFilter as "LEAD_CONTACT") : undefined,
    sourceModule: sourceFilter ? (sourceFilter as "campaign") : undefined,
    status: statusFilter || undefined,
  });

  const updateScheduledFor = trpc.contact.updateScheduledFor.useMutation({
    onSuccess: () => {
      utils.contact.listAgenda.invalidate();
      utils.contact.listDrafts.invalidate();
      setRescheduleTarget(null);
    },
  });

  const items = (data?.items ?? []) as AgendaItem[];
  const byDate = useMemo(() => groupByDateKey(items), [items]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [anchor]);

  const monthGrid = useMemo(() => createMonthGrid(anchor), [anchor]);
  const todayKey = formatDateKeyInZone(new Date(), AGENDA_TIMEZONE);

  function openReschedule(item: AgendaItem) {
    const when = new Date(item.scheduledFor);
    setRescheduleTarget(item);
    setRescheduleDate(formatDateKeyInZone(when, AGENDA_TIMEZONE));
    setRescheduleTime(formatTimeInZone(when, AGENDA_TIMEZONE));
  }

  function saveReschedule() {
    if (!rescheduleTarget || !rescheduleDate || !rescheduleTime) return;
    updateScheduledFor.mutate({
      id: rescheduleTarget.id,
      scheduledFor: toBookingIso(rescheduleDate, rescheduleTime, AGENDA_TIMEZONE),
    });
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/70 p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold">Agenda</p>
            <p className="text-xs text-muted-foreground">
              Geplande verzendmomenten ({formatTimezoneLabel(AGENDA_TIMEZONE)}). Concept eerst, daarna
              goedkeuren, dan verzenden.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["day", "week", "month"] as const).map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant={view === mode ? "default" : "outline"}
                onClick={() => setView(mode)}
              >
                {mode === "day" ? "Dag" : mode === "week" ? "Week" : "Maand"}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setAnchor((d) => shiftAnchor(d, view, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="min-w-[10rem] justify-center" onClick={() => setAnchor(startOfDay(new Date()))}>
              Vandaag
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setAnchor((d) => shiftAnchor(d, view, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm font-medium capitalize">{range.label}</p>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Select value={sourceFilter || "all"} onValueChange={(v) => setSourceFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="h-9">
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
          <Select value={typeFilter || "all"} onValueChange={(v) => setTypeFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="h-9">
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
          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle statussen</SelectItem>
              <SelectItem value="DRAFT">{OUTBOUND_STATUS_LABELS.DRAFT}</SelectItem>
              <SelectItem value="PENDING_APPROVAL">{OUTBOUND_STATUS_LABELS.PENDING_APPROVAL}</SelectItem>
              <SelectItem value="APPROVED">{OUTBOUND_STATUS_LABELS.APPROVED}</SelectItem>
              <SelectItem value="SENT">{OUTBOUND_STATUS_LABELS.SENT}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 border-dashed p-10 text-center">
          <CalendarDays className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Geen geplande mails in deze periode</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Campagnes en andere flows slaan verzendtijden op als concept. Na goedkeuring kun je via SMTP
            verzenden op of na het geplande moment.
          </p>
        </Card>
      ) : view === "day" ? (
        <Card className="p-4">
          <div className="space-y-2">
            {(byDate.get(formatDateKeyInZone(anchor, AGENDA_TIMEZONE)) ?? []).map((item) => (
              <AgendaEventCard key={item.id} item={item} onReschedule={openReschedule} />
            ))}
          </div>
        </Card>
      ) : view === "week" ? (
        <div className="grid gap-3 lg:grid-cols-7">
          {weekDays.map((day) => {
            const key = formatDateKeyInZone(day, AGENDA_TIMEZONE);
            const dayItems = byDate.get(key) ?? [];
            return (
              <Card key={key} className={`min-h-[140px] p-2 ${key === todayKey ? "border-primary/40 bg-primary/5" : ""}`}>
                <p className="mb-2 text-xs font-semibold capitalize text-muted-foreground">
                  {day.toLocaleDateString("nl-BE", { weekday: "short", day: "numeric" })}
                </p>
                <div className="space-y-2">
                  {dayItems.map((item) => (
                    <AgendaEventCard key={item.id} item={item} onReschedule={openReschedule} />
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-3">
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {["ma", "di", "wo", "do", "vr", "za", "zo"].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthGrid.map((day) => {
              const key = formatDateKeyInZone(day, AGENDA_TIMEZONE);
              const inMonth = day.getMonth() === anchor.getMonth();
              const dayItems = byDate.get(key) ?? [];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setAnchor(day);
                    setView("day");
                  }}
                  className={`min-h-[72px] rounded-lg border p-1 text-left transition hover:border-primary/40 ${
                    key === todayKey ? "border-primary/50 bg-primary/5" : "border-border/60"
                  } ${inMonth ? "" : "opacity-40"}`}
                >
                  <span className="text-xs font-medium">{day.getDate()}</span>
                  {dayItems.length > 0 ? (
                    <div className="mt-1 space-y-0.5">
                      {dayItems.slice(0, 2).map((item) => (
                        <p key={item.id} className="truncate rounded bg-muted/80 px-1 text-[9px]">
                          {formatTimeInZone(new Date(item.scheduledFor), AGENDA_TIMEZONE)} {item.subject}
                        </p>
                      ))}
                      {dayItems.length > 2 ? (
                        <p className="text-[9px] text-muted-foreground">+{dayItems.length - 2}</p>
                      ) : null}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="border-dashed p-3">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <LayoutList className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {items.length} geplande mail(s) in deze periode. Status{" "}
            <strong>{OUTBOUND_STATUS_LABELS.APPROVED}</strong> betekent klaar om te verzenden — gebruik
            Verzenden in het overzicht; goedkeuren alleen zet de status, geen SMTP.
          </p>
        </div>
      </Card>

      <Dialog open={Boolean(rescheduleTarget)} onOpenChange={(open) => !open && setRescheduleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verzendmoment aanpassen</DialogTitle>
          </DialogHeader>
          {rescheduleTarget ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{rescheduleTarget.subject}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="agenda-date">Datum</Label>
                  <Input
                    id="agenda-date"
                    type="date"
                    value={rescheduleDate}
                    onChange={(event) => setRescheduleDate(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="agenda-time">Tijd ({formatTimezoneLabel(AGENDA_TIMEZONE)})</Label>
                  <Input
                    id="agenda-time"
                    type="time"
                    value={rescheduleTime}
                    onChange={(event) => setRescheduleTime(event.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleTarget(null)}>
              Annuleren
            </Button>
            <Button onClick={saveReschedule} disabled={updateScheduledFor.isPending}>
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
