"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Globe2,
  Loader2,
  Play,
  Video,
  X,
} from "lucide-react";
import { formatTimeInZone, toBookingIso } from "@/lib/booking-timezone";

// ─── Types ────────────────────────────────────────────────────────────────────

type DaySchedule = { enabled: boolean; start: string; end: string };
type WeeklyHours = Record<number, DaySchedule>;
type ThemeMode = "light" | "dark";
type TimeMode = "12" | "24";
type PublicQuestion = {
  id: string;
  label: string;
  type: "text" | "textarea" | "email" | "phone" | "select" | "checkbox";
  required: boolean;
  options?: unknown;
};
type PublicEventType = {
  slug: string;
  name: string;
  description?: string | null;
  duration: number;
  slotMinutes: number;
  color: string;
  location?: string | null;
  timezone: string;
  privacyText?: string | null;
  requireConsent: boolean;
  questions: PublicQuestion[];
};
type AvailabilitySlot = {
  time: string;
  displayTime?: string;
  displayDate?: string;
  start: string;
  end: string;
  available: boolean;
  hostUserId: string | null;
};
type DisplaySlot = { key: string; label: string; start: string; hostTime: string; displayDate?: string };
type SuggestedSlot = { date: string; time: string; start: string };
type BookingStep = null | "time" | "form" | "confirm";
type DateStatus = "available" | "partial" | "full" | "none";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_WEEKLY_HOURS: WeeklyHours = {
  0: { enabled: false, start: "09:00", end: "17:00" },
  1: { enabled: true, start: "09:00", end: "17:00" },
  2: { enabled: true, start: "09:00", end: "17:00" },
  3: { enabled: true, start: "09:00", end: "17:00" },
  4: { enabled: true, start: "09:00", end: "17:00" },
  5: { enabled: true, start: "09:00", end: "17:00" },
  6: { enabled: false, start: "09:00", end: "17:00" },
};

const MONTH_FORMATTER = new Intl.DateTimeFormat("nl-BE", { month: "long", year: "numeric" });
const DAY_LABELS = ["ZO", "MA", "DI", "WO", "DO", "VR", "ZA"];
const DAY_NAMES = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
const MONTH_NAMES = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

const STATUS_DOT: Record<DateStatus, string | null> = {
  available: "#22c55e",
  partial: "#f97316",
  full: "#ef4444",
  none: null,
};

// ─── Utility functions ────────────────────────────────────────────────────────

function parseWeeklyHours(raw: string | null, startTime: string, endTime: string, availableDays: number[]): WeeklyHours {
  const fallback: WeeklyHours = {
    0: { enabled: availableDays.includes(0), start: startTime, end: endTime },
    1: { enabled: availableDays.includes(1), start: startTime, end: endTime },
    2: { enabled: availableDays.includes(2), start: startTime, end: endTime },
    3: { enabled: availableDays.includes(3), start: startTime, end: endTime },
    4: { enabled: availableDays.includes(4), start: startTime, end: endTime },
    5: { enabled: availableDays.includes(5), start: startTime, end: endTime },
    6: { enabled: availableDays.includes(6), start: startTime, end: endTime },
  };
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<DaySchedule>>;
    const next: WeeklyHours = { ...fallback };
    for (const [key, value] of Object.entries(parsed || {})) {
      const day = Number(key);
      if (Number.isNaN(day) || day < 0 || day > 6) continue;
      next[day] = {
        enabled: value.enabled ?? next[day].enabled,
        start: value.start || next[day].start,
        end: value.end || next[day].end,
      };
    }
    return next;
  } catch {
    return fallback;
  }
}

function clampSlotMinutes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 30;
  return Math.max(5, Math.min(value, 240));
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map((item) => Number(item));
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12, 0, 0, 0);
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatLongDate(value: string) {
  const date = parseDateKey(value);
  return `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

function formatMonthTitle(date: Date) {
  const formatted = MONTH_FORMATTER.format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatTimeDisplay(time: string, mode: TimeMode) {
  const [hours, minutes] = time.split(":").map((value) => Number(value));
  if (mode === "24") return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  const suffix = hours >= 12 ? "PM" : "AM";
  const normalized = hours % 12 || 12;
  return `${normalized}:${String(minutes).padStart(2, "0")} ${suffix}`;
}


function buildSlotsForDate(dateValue: string, weeklyHours: WeeklyHours, duration: number, slotMinutes: number) {
  if (!dateValue) return [];
  const date = parseDateKey(dateValue);
  const schedule = weeklyHours[date.getDay()] || DEFAULT_WEEKLY_HOURS[date.getDay()];
  if (!schedule?.enabled) return [];
  const [startHour, startMinute] = schedule.start.split(":").map((value) => Number(value));
  const [endHour, endMinute] = schedule.end.split(":").map((value) => Number(value));
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  const interval = clampSlotMinutes(slotMinutes);
  const slots: string[] = [];
  for (let minutes = startMinutes; minutes + duration <= endMinutes; minutes += interval) {
    const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mins = String(minutes % 60).padStart(2, "0");
    slots.push(`${hours}:${mins}`);
  }
  return slots;
}

function getFirstAvailableDate(baseDate: Date, weeklyHours: WeeklyHours, duration: number, slotMinutes: number) {
  const candidate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 12, 0, 0, 0);
  for (let index = 0; index < 120; index += 1) {
    const current = new Date(candidate);
    current.setDate(candidate.getDate() + index);
    const dateKey = formatDateKey(current);
    if (buildSlotsForDate(dateKey, weeklyHours, duration, slotMinutes).length > 0) return dateKey;
  }
  return formatDateKey(candidate);
}

function createMonthGrid(month: Date) {
  const firstDay = getMonthStart(month);
  const offset = (firstDay.getDay() + 6) % 7;
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

// ─── Main embed component ─────────────────────────────────────────────────────

function BookingEmbedContent() {
  const params = useSearchParams();
  const color = params.get("color") || "#f5b04c";
  const theme = params.get("theme") === "dark" ? "dark" : "light";
  const title = params.get("title") || "Plan een afspraak";
  const description = params.get("description") || "Kies een moment dat past. We bevestigen uw afspraak meteen.";
  const submitText = params.get("submitText") || "Afspraak bevestigen";
  const duration = Math.max(15, Number(params.get("duration") || "60"));
  const slotMinutes = clampSlotMinutes(Number(params.get("slotMinutes") || "30"));
  const startTime = params.get("startTime") || "09:00";
  const endTime = params.get("endTime") || "17:00";
  const availableDays = (params.get("availableDays") || "1,2,3,4,5")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => !Number.isNaN(value));
  const weeklyHours = useMemo(
    () => parseWeeklyHours(params.get("weeklyHours"), startTime, endTime, availableDays),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.get("weeklyHours"), startTime, endTime, availableDays.join(",")]
  );
  const brandName = params.get("brandName") || "Digitify";
  const meetingName = params.get("meetingName") || title;
  const meetingLocation = params.get("location") || "Google Meet";
  const serviceName = params.get("service") || "";
  const timezone = params.get("timezone") || "Europe/Brussels";
  const defaultTimeMode = params.get("timeMode") === "12" ? "12" : "24";
  const tenant = params.get("tenant") || "";
  const eventTypeSlug = params.get("eventType") || params.get("type") || "";

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => formatDateKey(today), [today]);
  const initialDate = useMemo(
    () => getFirstAvailableDate(today, weeklyHours, duration, slotMinutes),
    [today, weeklyHours, duration, slotMinutes]
  );

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeStep, setActiveStep] = useState<BookingStep>(null);
  const [currentMonth, setCurrentMonth] = useState(getMonthStart(parseDateKey(initialDate)));
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedTime, setSelectedTime] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [timeMode, setTimeMode] = useState<TimeMode>(defaultTimeMode);
  const [visitorTimezone, setVisitorTimezone] = useState(timezone);
  const [eventType, setEventType] = useState<PublicEventType | null>(null);
  const [availability, setAvailability] = useState<Record<string, AvailabilitySlot[]>>({});
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [resultModal, setResultModal] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityMonthKey, setAvailabilityMonthKey] = useState<string | null>(null);
  const [hostTimeZone, setHostTimeZone] = useState(timezone);
  const [selectedSlotStart, setSelectedSlotStart] = useState("");
  const [suggestedSlots, setSuggestedSlots] = useState<SuggestedSlot[]>([]);

  const effectiveDuration = eventType?.duration || duration;
  const effectiveSlotMinutes = eventType?.slotMinutes || slotMinutes;
  const effectiveColor = eventType?.color || color;
  const effectiveMeetingName = eventType?.name || meetingName;
  const effectiveDescription = eventType?.description || description;
  const effectiveLocation = eventType?.location || meetingLocation;
  const slotTimeZone = hostTimeZone || eventType?.timezone || timezone;
  const showHostTimeHint = slotTimeZone !== visitorTimezone;

  const selectedSlots = useMemo((): DisplaySlot[] => {
    const mapSlot = (slot: AvailabilitySlot): DisplaySlot => {
      const start = slot.start;
      const label =
        slot.displayTime ||
        formatTimeInZone(new Date(start), visitorTimezone);
      const displayDate = slot.displayDate;
      return {
        key: start,
        label,
        start,
        hostTime: slot.time,
        displayDate,
      };
    };
    if (tenant) {
      const remoteData = availability[selectedDate];
      if (!remoteData) return [];
      return remoteData.map(mapSlot);
    }
    const remoteData = availability[selectedDate];
    if (remoteData !== undefined) {
      return remoteData.map(mapSlot);
    }
    return buildSlotsForDate(selectedDate, weeklyHours, effectiveDuration, effectiveSlotMinutes).map((time) => ({
      key: toBookingIso(selectedDate, time, slotTimeZone),
      label: time,
      start: toBookingIso(selectedDate, time, slotTimeZone),
      hostTime: time,
    }));
  }, [tenant, availability, selectedDate, weeklyHours, effectiveDuration, effectiveSlotMinutes, visitorTimezone, slotTimeZone]);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) setVisitorTimezone(detected);
  }, []);

  useEffect(() => {
    if (!tenant) return;
    const url = new URL("/api/public/bookings/event-type", window.location.origin);
    url.searchParams.set("tenant", tenant);
    if (eventTypeSlug) url.searchParams.set("eventType", eventTypeSlug);
    fetch(url)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (data) setEventType(data); })
      .catch(() => null);
  }, [tenant, eventTypeSlug]);

  useEffect(() => {
    if (!tenant) return;
    const toDate = addMonths(currentMonth, 1);
    toDate.setDate(0);
    const url = new URL("/api/public/bookings/availability", window.location.origin);
    url.searchParams.set("tenant", tenant);
    if (eventType?.slug || eventTypeSlug) url.searchParams.set("eventType", eventType?.slug || eventTypeSlug);
    url.searchParams.set("from", formatDateKey(currentMonth));
    url.searchParams.set("to", formatDateKey(toDate));
    url.searchParams.set("displayTimezone", visitorTimezone);
    const monthKey = formatDateKey(currentMonth);
    setLoadingAvailability(true);
    setAvailabilityMonthKey(null);
    fetch(url)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.days) {
          if (data.hostTimeZone) setHostTimeZone(data.hostTimeZone);
          else if (data.timezone) setHostTimeZone(data.timezone);
          setAvailability((prev) => ({
            ...prev,
            ...Object.fromEntries(data.days.map((day: { date: string; slots: AvailabilitySlot[] }) => [day.date, day.slots])),
          }));
          setAvailabilityMonthKey(monthKey);
        }
      })
      .catch(() => null)
      .finally(() => setLoadingAvailability(false));
  }, [tenant, eventType?.slug, eventTypeSlug, currentMonth, visitorTimezone]);

  // Auto-select first available slot when date changes
  useEffect(() => {
    if (!selectedSlots.length) {
      setSelectedTime("");
      setSelectedSlotStart("");
      return;
    }
    const active = selectedSlots.find((slot) => slot.key === selectedSlotStart || slot.hostTime === selectedTime);
    if (!active) {
      const first = selectedSlots[0];
      setSelectedTime(first.hostTime);
      setSelectedSlotStart(first.start);
    }
  }, [selectedSlots, selectedTime, selectedSlotStart]);

  // ── Date status classification ─────────────────────────────────────────────

  function getDateStatus(dateKey: string): DateStatus {
    if (dateKey < todayKey) return "none";
    const dateMonthKey = formatDateKey(getMonthStart(parseDateKey(dateKey)));
    if (tenant) {
      if (loadingAvailability && availabilityMonthKey !== dateMonthKey) return "none";
      if (availabilityMonthKey !== dateMonthKey) return "none";
      const remoteData = availability[dateKey];
      if (remoteData === undefined) return "none";
      if (remoteData.length === 0) {
        const schedule = weeklyHours[parseDateKey(dateKey).getDay()];
        return schedule?.enabled ? "full" : "none";
      }
      return "available";
    }
    const remoteData = availability[dateKey];
    if (remoteData !== undefined) {
      if (remoteData.length === 0) return "full";
      return "available";
    }
    const localSlots = buildSlotsForDate(dateKey, weeklyHours, effectiveDuration, effectiveSlotMinutes);
    return localSlots.length > 0 ? "available" : "none";
  }

  // ── Submission ─────────────────────────────────────────────────────────────

  async function submitBooking() {
    if (!selectedDate || !selectedTime) return;
    setLoading(true);
    setStatus(null);
    setSuggestedSlots([]);
    try {
      const response = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          clientEmail,
          date: selectedSlotStart || toBookingIso(selectedDate, selectedTime, slotTimeZone),
          localDate: selectedDate,
          localTime: selectedTime,
          duration: effectiveDuration,
          notes,
          service: serviceName || undefined,
          eventType: eventType?.slug || eventTypeSlug || undefined,
          timezone: visitorTimezone,
          answers: Object.entries(questionAnswers).map(([questionId, value]) => ({ questionId, value })),
          consentAccepted,
          website,
          tenant: tenant || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      setLoading(false);
      if (response.ok) {
        setClientName("");
        setClientEmail("");
        setNotes("");
        setWebsite("");
        const autoConfirmed = Boolean(data.autoConfirmed);
        const nextStatus = {
          type: "success",
          message: autoConfirmed
            ? "Uw afspraak is bevestigd! U ontvangt een bevestigingsmail met de kalenderuitnodiging."
            : "Uw afspraak is aangevraagd. U ontvangt snel een bevestiging per e-mail.",
        } as const;
        setStatus(nextStatus);
        setResultModal(nextStatus);
        setActiveStep(null);
        return;
      }
      if (response.status === 429) {
        setStatus({ type: "error", message: data.error || "Te veel aanvragen. Wacht even en probeer opnieuw." });
        return;
      }
      if (data.suggestedSlots?.length) {
        setSuggestedSlots(data.suggestedSlots as SuggestedSlot[]);
        const first = data.suggestedSlots[0] as SuggestedSlot;
        if (first?.start) {
          setSelectedSlotStart(first.start);
          setSelectedDate(first.date);
          setSelectedTime(first.time);
          setCurrentMonth(getMonthStart(parseDateKey(first.date)));
        }
      }
      setStatus({ type: "error", message: data.error || "Boeking aanvragen mislukt." });
      if (tenant) {
        const toDate = addMonths(currentMonth, 1);
        toDate.setDate(0);
        const refreshUrl = new URL("/api/public/bookings/availability", window.location.origin);
        refreshUrl.searchParams.set("tenant", tenant);
        if (eventType?.slug || eventTypeSlug) refreshUrl.searchParams.set("eventType", eventType?.slug || eventTypeSlug);
        refreshUrl.searchParams.set("from", formatDateKey(currentMonth));
        refreshUrl.searchParams.set("to", formatDateKey(toDate));
        refreshUrl.searchParams.set("displayTimezone", visitorTimezone);
        fetch(refreshUrl)
          .then((response) => (response.ok ? response.json() : null))
          .then((payload) => {
            if (!payload?.days) return;
            setAvailability((prev) => ({
              ...prev,
              ...Object.fromEntries(payload.days.map((day: { date: string; slots: AvailabilitySlot[] }) => [day.date, day.slots])),
            }));
          })
          .catch(() => null);
      }
    } catch {
      setLoading(false);
      setStatus({ type: "error", message: "Verbindingsfout. Controleer uw internetverbinding en probeer opnieuw." });
    }
  }

  function handleGoToConfirm() {
    setFormError(null);
    if (!clientName.trim()) { setFormError("Vul uw naam in."); return; }
    if (!clientEmail.trim() || !clientEmail.includes("@")) { setFormError("Vul een geldig e-mailadres in."); return; }
    const missingRequired = eventType?.questions.filter((q) => q.required && !questionAnswers[q.id]?.trim());
    if (missingRequired?.length) { setFormError(`Vul '${missingRequired[0].label}' in.`); return; }
    if (eventType?.requireConsent && !consentAccepted) { setFormError("Accepteer de privacyverklaring om door te gaan."); return; }
    setActiveStep("confirm");
  }

  // ── Calendar keyboard nav ──────────────────────────────────────────────────

  function handleCalendarKeyDown(event: React.KeyboardEvent, currentDate: Date) {
    let delta = 0;
    if (event.key === "ArrowRight") delta = 1;
    else if (event.key === "ArrowLeft") delta = -1;
    else if (event.key === "ArrowDown") delta = 7;
    else if (event.key === "ArrowUp") delta = -7;
    else return;
    event.preventDefault();
    const next = new Date(currentDate);
    next.setDate(currentDate.getDate() + delta);
    setCurrentMonth(getMonthStart(next));
    const nextKey = formatDateKey(next);
    const st = getDateStatus(nextKey);
    if (st === "available" || st === "partial") setSelectedDate(nextKey);
    const btn = document.querySelector(`[data-datekey="${nextKey}"]`) as HTMLButtonElement | null;
    btn?.focus();
  }

  // ── Theme ──────────────────────────────────────────────────────────────────

  const themeMode = theme as ThemeMode;
  const dark = themeMode === "dark";

  const tc = {
    page: dark ? "min-h-screen bg-[#121212] p-2 text-white sm:p-3" : "min-h-screen bg-[#f3f1ee] p-2 text-slate-950 sm:p-3",
    shell: dark
      ? "mx-auto max-w-[980px] overflow-hidden rounded-[24px] border border-white/8 bg-[#171717] shadow-[0_24px_80px_rgba(0,0,0,0.38)]"
      : "mx-auto max-w-[980px] overflow-hidden rounded-[24px] border border-black/8 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)]",
    panelBorder: dark ? "border-white/8" : "border-black/8",
    muted: dark ? "text-white/55" : "text-slate-500",
    soft: dark ? "bg-white/5" : "bg-slate-50",
    softStrong: dark ? "bg-white/10" : "bg-slate-200",
    slot: dark ? "border-white/12 bg-[#101010] text-white hover:border-white/25" : "border-slate-200 bg-white text-slate-900 hover:border-slate-300",
    input: dark ? "border-white/10 bg-white/5 text-white placeholder:text-white/40" : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400",
    card: dark ? "border-white/10 bg-white/4" : "border-slate-200 bg-white",
    overlay: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[3px]",
    modal: dark
      ? "w-full rounded-[24px] border border-white/10 bg-[#1c1c1c] shadow-[0_32px_80px_rgba(0,0,0,0.5)]"
      : "w-full rounded-[24px] border border-black/8 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.18)]",
  };

  const monthDays = useMemo(() => createMonthGrid(currentMonth), [currentMonth]);
  const selectedDateObject = selectedDate ? parseDateKey(selectedDate) : null;
  const selectedDateStatus = selectedDate ? getDateStatus(selectedDate) : "none";
  const canPlanSelected = selectedDate && (selectedDateStatus === "available" || selectedDateStatus === "partial");

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={tc.page} style={{ colorScheme: themeMode }}>
      <div className={tc.shell}>
        <div className={`grid lg:grid-cols-[272px_minmax(0,1fr)]`}>

          {/* ── Left sidebar ─────────────────────────────────────────────── */}
          <aside className={`flex flex-col gap-5 border-b p-5 sm:p-6 lg:border-b-0 lg:border-r ${tc.panelBorder}`}>
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm"
                style={{ backgroundColor: effectiveColor }}
              >
                <Play className="h-4 w-4 fill-current text-white" />
              </div>
              <p className={`text-sm font-semibold ${tc.muted}`}>{brandName}</p>
            </div>

            {/* Title + description */}
            <div>
              <h1 className="text-xl font-semibold tracking-tight leading-snug">{effectiveMeetingName}</h1>
              <p className={`mt-1.5 text-sm leading-relaxed ${tc.muted}`}>{effectiveDescription}</p>
            </div>

            {/* Info pills */}
            <div className={`space-y-2 rounded-2xl border p-3.5 text-sm ${tc.card}`}>
              <div className="flex items-center gap-2.5">
                <Clock3 className="h-3.5 w-3.5 shrink-0" style={{ color: effectiveColor }} />
                <span>{effectiveDuration} minuten</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Video className="h-3.5 w-3.5 shrink-0" style={{ color: effectiveColor }} />
                <span>{effectiveLocation}</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <Globe2 className="h-3.5 w-3.5 shrink-0" style={{ color: effectiveColor }} />
                  <select
                    value={visitorTimezone}
                    onChange={(event) => setVisitorTimezone(event.target.value)}
                    className={`max-w-full truncate rounded-lg border bg-transparent px-2 py-1 text-xs ${tc.input}`}
                    aria-label="Tijdzone voor weergave"
                  >
                    {[
                      "Europe/Brussels",
                      "Europe/Amsterdam",
                      "Europe/Paris",
                      "Europe/London",
                      "America/New_York",
                      "America/Los_Angeles",
                      "Asia/Dubai",
                      "Asia/Singapore",
                    ].map((zone) => (
                      <option key={zone} value={zone}>
                        {zone.replace("_", " ")}
                      </option>
                    ))}
                    {!["Europe/Brussels", "Europe/Amsterdam", "Europe/Paris", "Europe/London", "America/New_York", "America/Los_Angeles", "Asia/Dubai", "Asia/Singapore"].includes(visitorTimezone) ? (
                      <option value={visitorTimezone}>{visitorTimezone}</option>
                    ) : null}
                  </select>
                </div>
                {showHostTimeHint ? (
                  <p className={`text-[11px] leading-snug ${tc.muted}`}>
                    Agenda van host: {slotTimeZone.replace("_", " ")}. Google-blokken worden in die zone gecontroleerd.
                  </p>
                ) : null}
              </div>
            </div>

            {/* Legend */}
            <div className={`space-y-1.5 rounded-2xl border p-3 text-xs ${tc.card}`}>
              <p className={`mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${tc.muted}`}>Legenda</p>
              {[
                { color: STATUS_DOT.available!, label: "Beschikbaar" },
                { color: STATUS_DOT.partial!, label: "Gedeeltelijk vol" },
                { color: STATUS_DOT.full!, label: "Volledig vol" },
              ].map(({ color: c, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c }} />
                  <span className={tc.muted}>{label}</span>
                </div>
              ))}
            </div>

            {/* CTA area */}
            <div className="mt-auto space-y-2.5">
              {selectedDate ? (
                <div
                  className="rounded-2xl border p-3.5"
                  style={{ borderColor: effectiveColor + "44", backgroundColor: effectiveColor + "0d" }}
                >
                  <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${tc.muted}`}>Geselecteerd</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" style={{ color: effectiveColor }} />
                    <p className="text-sm font-semibold capitalize">{formatLongDate(selectedDate)}</p>
                  </div>
                </div>
              ) : (
                <p className={`text-sm ${tc.muted}`}>Kies een datum in de kalender.</p>
              )}

              <button
                type="button"
                disabled={!canPlanSelected}
                onClick={() => setActiveStep("time")}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition disabled:opacity-35"
                style={{
                  backgroundColor: canPlanSelected ? effectiveColor : undefined,
                  color: canPlanSelected ? "#1e1e1e" : undefined,
                  border: canPlanSelected ? "none" : `1.5px solid ${dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"}`,
                }}
              >
                <CalendarDays className="h-4 w-4" />
                Afspraak plannen
              </button>
            </div>
          </aside>

          {/* ── Calendar ─────────────────────────────────────────────────── */}
          <section className="p-5 sm:p-7">
            {/* Month navigation */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">{formatMonthTitle(currentMonth)}</h2>
                {loadingAvailability ? <Loader2 className="h-4 w-4 animate-spin opacity-40" /> : null}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentMonth((m) => addMonths(m, -1))}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${tc.slot}`}
                  aria-label="Vorige maand"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${tc.slot}`}
                  aria-label="Volgende maand"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Day headers */}
            <div className="mt-5 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-widest">
              {["MA", "DI", "WO", "DO", "VR", "ZA", "ZO"].map((label) => (
                <div key={label} className={tc.muted}>{label}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="mt-2 grid grid-cols-7 gap-1.5">
              {monthDays.map((day) => {
                const dateKey = formatDateKey(day);
                const inCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const dateStatus = getDateStatus(dateKey);
                const isClickable = dateStatus === "available" || dateStatus === "partial";
                const isSelected = selectedDateObject ? isSameDay(day, selectedDateObject) : false;
                const isToday = isSameDay(day, today);
                const dotColor = isSelected ? null : STATUS_DOT[dateStatus];

                return (
                  <button
                    key={dateKey}
                    type="button"
                    data-datekey={dateKey}
                    role="gridcell"
                    aria-selected={isSelected}
                    aria-label={`${DAY_NAMES[day.getDay()]} ${day.getDate()} ${MONTH_NAMES[day.getMonth()]}${isSelected ? ", geselecteerd" : ""}${isToday ? ", vandaag" : ""}${!isClickable ? ", niet beschikbaar" : ""}`}
                    disabled={!isClickable}
                    onClick={() => {
                      if (!isClickable) return;
                      setSelectedDate(dateKey);
                      setCurrentMonth(getMonthStart(day));
                    }}
                    onKeyDown={(e) => handleCalendarKeyDown(e, day)}
                    className={`relative flex flex-col items-center justify-center gap-0.5 rounded-[12px] border py-3 text-sm font-semibold transition sm:py-4 ${
                      !isClickable
                        ? `cursor-not-allowed ${inCurrentMonth ? "opacity-30" : "opacity-15"}`
                        : "cursor-pointer"
                    } ${
                      isSelected
                        ? "border-transparent text-slate-950"
                        : inCurrentMonth
                          ? tc.slot
                          : `${tc.slot} opacity-40`
                    }`}
                    style={{
                      backgroundColor: isSelected ? effectiveColor : undefined,
                      boxShadow: isSelected ? `0 6px 20px ${effectiveColor}55` : undefined,
                    }}
                  >
                    <span className={isToday && !isSelected ? "underline underline-offset-2" : ""}>{day.getDate()}</span>
                    <span
                      className="h-1.5 w-1.5 rounded-full transition-colors"
                      style={{
                        backgroundColor: dotColor ?? (isToday && !isSelected ? effectiveColor + "88" : "transparent"),
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* ── Modal: Step 1 — Time picker ─────────────────────────────────────── */}
      {activeStep === "time" && (
        <div className={tc.overlay} onClick={() => setActiveStep(null)}>
          <div className={`${tc.modal} max-w-sm p-5`} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${tc.muted}`}>Stap 1 van 3 — Tijdslot</p>
                <h3 className="mt-0.5 text-base font-semibold capitalize">{formatLongDate(selectedDate)}</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className={`inline-flex shrink-0 rounded-xl p-0.5 ${tc.softStrong}`}>
                  {(["12", "24"] as TimeMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTimeMode(m)}
                      className={`rounded-[10px] px-2.5 py-1 text-xs font-medium transition ${
                        timeMode === m
                          ? dark ? "bg-black text-white shadow-sm" : "bg-white text-slate-950 shadow-sm"
                          : tc.muted
                      }`}
                    >
                      {m}u
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveStep(null)}
                  className={`flex h-7 w-7 items-center justify-center rounded-full transition ${tc.soft} ${tc.muted}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Slots */}
            <div className="mt-4 max-h-[300px] overflow-y-auto pr-0.5">
              {selectedSlots.length ? (
                <div className="grid grid-cols-3 gap-2">
                  {selectedSlots.map((slot) => {
                    const active = selectedSlotStart === slot.start;
                    return (
                      <button
                        key={slot.key}
                        type="button"
                        onClick={() => {
                          setSelectedSlotStart(slot.start);
                          setSelectedTime(slot.hostTime);
                          if (slot.displayDate) setSelectedDate(slot.displayDate);
                        }}
                        className={`flex h-10 items-center justify-center rounded-[12px] border text-sm font-semibold transition ${
                          active ? "border-transparent" : tc.slot
                        }`}
                        style={{
                          backgroundColor: active ? effectiveColor : undefined,
                          color: active ? "#1e1e1e" : undefined,
                          boxShadow: active ? `0 4px 12px ${effectiveColor}55` : undefined,
                        }}
                      >
                        {formatTimeDisplay(slot.label, timeMode)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className={`rounded-2xl border px-4 py-8 text-center ${tc.card}`}>
                  <CalendarDays className={`mx-auto mb-2 h-7 w-7 ${tc.muted}`} />
                  <p className="text-sm font-medium">Geen tijdsloten beschikbaar</p>
                  <p className={`mt-1 text-xs ${tc.muted}`}>Kies een andere dag in de kalender.</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setActiveStep(null)}
                className={`flex h-10 flex-1 items-center justify-center rounded-full border text-sm font-medium transition ${tc.slot}`}
              >
                Annuleren
              </button>
              <button
                type="button"
                disabled={!selectedSlotStart && !selectedTime}
                onClick={() => { setStatus(null); setActiveStep("form"); }}
                className="flex h-10 flex-1 items-center justify-center rounded-full text-sm font-semibold transition disabled:opacity-40"
                style={{ backgroundColor: effectiveColor, color: "#1e1e1e" }}
              >
                Volgende →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Step 2 — Form ─────────────────────────────────────────────── */}
      {activeStep === "form" && (
        <div className={tc.overlay}>
          <div className={`${tc.modal} max-w-md`} style={{ maxHeight: "92vh", overflowY: "auto" }}>
            <div className="p-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${tc.muted}`}>Stap 2 van 3 — Uw gegevens</p>
                  <h3 className="mt-0.5 text-base font-semibold">Vul uw gegevens in</h3>
                  <p className={`mt-0.5 text-sm capitalize ${tc.muted}`}>
                    {formatLongDate(selectedDate)} om {formatTimeDisplay(selectedTime, timeMode)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveStep("time")}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition ${tc.soft} ${tc.muted}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Form fields */}
              <div className="mt-5 space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Naam *</label>
                  <input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Jan Janssen"
                    className={`h-11 w-full rounded-2xl border px-4 text-sm outline-none transition focus:ring-2 ${tc.input}`}
                    style={{ focusRingColor: effectiveColor } as React.CSSProperties}
                    onFocus={(e) => (e.target.style.borderColor = effectiveColor)}
                    onBlur={(e) => (e.target.style.borderColor = "")}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">E-mail *</label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="jan@bedrijf.be"
                    className={`h-11 w-full rounded-2xl border px-4 text-sm outline-none transition ${tc.input}`}
                    onFocus={(e) => (e.target.style.borderColor = effectiveColor)}
                    onBlur={(e) => (e.target.style.borderColor = "")}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Opmerking</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Vertel kort wat u graag wil bespreken."
                    className={`w-full rounded-2xl border px-4 py-2.5 text-sm outline-none transition ${tc.input}`}
                    onFocus={(e) => (e.target.style.borderColor = effectiveColor)}
                    onBlur={(e) => (e.target.style.borderColor = "")}
                  />
                </div>

                {/* Tijdzone (read-only) */}
                <div className={`flex h-10 items-center gap-2.5 rounded-2xl border px-4 text-sm ${dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"}`}>
                  <Globe2 className={`h-3.5 w-3.5 shrink-0 ${tc.muted}`} />
                  <span className={`truncate text-sm ${tc.muted}`}>{visitorTimezone}</span>
                </div>

                {/* Custom questions */}
                {eventType?.questions.map((q) => (
                  <div key={q.id} className="space-y-1.5">
                    <label className="text-sm font-medium">{q.label}{q.required ? " *" : ""}</label>
                    {q.type === "textarea" ? (
                      <textarea
                        required={q.required}
                        rows={3}
                        value={questionAnswers[q.id] || ""}
                        onChange={(e) => setQuestionAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        className={`w-full rounded-2xl border px-4 py-2.5 text-sm outline-none transition ${tc.input}`}
                        onFocus={(e) => (e.target.style.borderColor = effectiveColor)}
                        onBlur={(e) => (e.target.style.borderColor = "")}
                      />
                    ) : q.type === "checkbox" ? (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={questionAnswers[q.id] === "yes"}
                          onChange={(e) => setQuestionAnswers((prev) => ({ ...prev, [q.id]: e.target.checked ? "yes" : "" }))}
                          className="h-4 w-4 rounded"
                        />
                        <span className={tc.muted}>{q.label}</span>
                      </label>
                    ) : (
                      <input
                        required={q.required}
                        type={q.type === "phone" ? "tel" : q.type}
                        value={questionAnswers[q.id] || ""}
                        onChange={(e) => setQuestionAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        className={`h-11 w-full rounded-2xl border px-4 text-sm outline-none transition ${tc.input}`}
                        onFocus={(e) => (e.target.style.borderColor = effectiveColor)}
                        onBlur={(e) => (e.target.style.borderColor = "")}
                      />
                    )}
                  </div>
                ))}

                {/* Privacy consent */}
                {eventType?.privacyText ? (
                  <label className={`flex gap-3 rounded-2xl border p-3 text-sm ${tc.card}`}>
                    <input
                      type="checkbox"
                      required={eventType.requireConsent}
                      checked={consentAccepted}
                      onChange={(e) => setConsentAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded"
                    />
                    <span className={tc.muted}>{eventType.privacyText}</span>
                  </label>
                ) : null}

                {/* Honeypot */}
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="hidden"
                  name="website"
                />

                {/* Form error */}
                {formError && (
                  <div className={`rounded-2xl px-4 py-3 text-sm ${dark ? "bg-red-500/15 text-red-300" : "bg-red-50 text-red-700"}`}>
                    {formError}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveStep("time")}
                  className={`flex h-11 flex-1 items-center justify-center rounded-full border text-sm font-medium transition ${tc.slot}`}
                >
                  ← Terug
                </button>
                <button
                  type="button"
                  onClick={handleGoToConfirm}
                  className="flex h-11 flex-1 items-center justify-center rounded-full text-sm font-semibold transition"
                  style={{ backgroundColor: effectiveColor, color: "#1e1e1e" }}
                >
                  Controleren →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Step 3 — Confirmation ─────────────────────────────────────── */}
      {activeStep === "confirm" && (
        <div className={tc.overlay}>
          <div className={`${tc.modal} max-w-sm p-5`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${tc.muted}`}>Stap 3 van 3 — Bevestigen</p>
                <h3 className="mt-0.5 text-base font-semibold">Overzicht boeking</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveStep("form")}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition ${tc.soft} ${tc.muted}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Summary */}
            <div className={`mt-4 space-y-3 rounded-2xl border p-4 text-sm ${tc.soft}`}>
              <div className="flex items-center gap-2.5">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" style={{ color: effectiveColor }} />
                <span className="font-semibold capitalize">{formatLongDate(selectedDate)}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock3 className="h-3.5 w-3.5 shrink-0" style={{ color: effectiveColor }} />
                <span>{formatTimeDisplay(selectedTime, timeMode)} &middot; {effectiveDuration} min</span>
              </div>
              <div className={`h-px ${dark ? "bg-white/10" : "bg-slate-200"}`} />
              <div className="flex items-center gap-2.5">
                <Video className="h-3.5 w-3.5 shrink-0" style={{ color: effectiveColor }} />
                <span>{effectiveLocation}</span>
              </div>
              <div className={`h-px ${dark ? "bg-white/10" : "bg-slate-200"}`} />
              <div>
                <p className="font-semibold">{clientName}</p>
                <p className={`text-xs ${tc.muted}`}>{clientEmail}</p>
              </div>
              {notes.trim() ? <p className={`text-xs ${tc.muted}`}>{notes}</p> : null}
            </div>

            {/* Error + suggestions */}
            {status?.type === "error" && (
              <div className={`mt-3 rounded-2xl px-4 py-3 text-sm ${dark ? "bg-red-500/15 text-red-300" : "bg-red-50 text-red-700"}`}>
                {status.message}
                {suggestedSlots.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="font-semibold">Andere beschikbare momenten:</p>
                    {suggestedSlots.map((slot) => (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => {
                          setSelectedSlotStart(slot.start);
                          setSelectedDate(slot.date);
                          setSelectedTime(slot.time);
                          setCurrentMonth(getMonthStart(parseDateKey(slot.date)));
                          setStatus(null);
                          setSuggestedSlots([]);
                          setActiveStep("time");
                        }}
                        className="block text-left underline underline-offset-2"
                        style={{ color: effectiveColor }}
                      >
                        {formatLongDate(slot.date)} om {formatTimeDisplay(slot.time, timeMode)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => { setStatus(null); setActiveStep("form"); }}
                className={`flex h-11 flex-1 items-center justify-center rounded-full border text-sm font-medium transition ${tc.slot}`}
              >
                Wijzigen
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={submitBooking}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold transition disabled:opacity-50"
                style={{ backgroundColor: effectiveColor, color: "#1e1e1e" }}
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Bezig...</> : submitText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success modal ─────────────────────────────────────────────────────── */}
      {resultModal?.type === "success" && (
        <div className={tc.overlay}>
          <div className={`${tc.modal} max-w-sm p-6 text-center`}>
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: effectiveColor + "22" }}
            >
              <CheckCircle2 className="h-7 w-7" style={{ color: effectiveColor }} />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Aanvraag verstuurd!</h3>
            <p className={`mt-2 text-sm ${tc.muted}`}>{resultModal.message}</p>
            <button
              type="button"
              onClick={() => setResultModal(null)}
              className="mt-5 flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold transition"
              style={{ backgroundColor: effectiveColor, color: "#1e1e1e" }}
            >
              Sluiten
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton fallback ────────────────────────────────────────────────────────

function BookingEmbedFallback() {
  return (
    <div className="min-h-screen bg-[#f3f1ee] p-2 sm:p-3">
      <div className="mx-auto max-w-[980px] overflow-hidden rounded-[24px] border border-black/8 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
        <div className="grid animate-pulse lg:grid-cols-[272px_minmax(0,1fr)]">
          <div className="border-b border-black/8 p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-100" />
              <div className="h-4 w-20 rounded-lg bg-slate-100" />
            </div>
            <div className="mt-5 h-6 w-3/4 rounded-lg bg-slate-100" />
            <div className="mt-2 h-4 w-full rounded bg-slate-100" />
            <div className="mt-1 h-4 w-2/3 rounded bg-slate-100" />
            <div className="mt-5 rounded-2xl border p-3.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="mb-2 flex items-center gap-2.5">
                  <div className="h-3.5 w-3.5 rounded bg-slate-100" />
                  <div className="h-3.5 w-24 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
          <div className="p-5 sm:p-7">
            <div className="flex items-center justify-between">
              <div className="h-6 w-32 rounded-lg bg-slate-100" />
              <div className="flex gap-1.5">
                <div className="h-8 w-8 rounded-full bg-slate-100" />
                <div className="h-8 w-8 rounded-full bg-slate-100" />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-7 gap-1.5">
              {Array.from({ length: 42 }).map((_, i) => (
                <div key={i} className="rounded-[12px] bg-slate-100 py-3 sm:py-4" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookingEmbedPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <BookingEmbedFallback />;
  return (
    <Suspense fallback={<BookingEmbedFallback />}>
      <BookingEmbedContent />
    </Suspense>
  );
}
