"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";

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
type AvailabilitySlot = { time: string; start: string; end: string; available: boolean; hostUserId: string | null };
type SuggestedSlot = { date: string; time: string; start: string };

const DEFAULT_WEEKLY_HOURS: WeeklyHours = {
  0: { enabled: false, start: "09:00", end: "17:00" },
  1: { enabled: true, start: "09:00", end: "17:00" },
  2: { enabled: true, start: "09:00", end: "17:00" },
  3: { enabled: true, start: "09:00", end: "17:00" },
  4: { enabled: true, start: "09:00", end: "17:00" },
  5: { enabled: true, start: "09:00", end: "17:00" },
  6: { enabled: false, start: "09:00", end: "17:00" },
};

const MONTH_FORMATTER = new Intl.DateTimeFormat("nl-BE", {
  month: "long",
  year: "numeric",
});

const DAY_LABELS = ["ZO", "MA", "DI", "WO", "DO", "VR", "ZA"];
const DAY_NAMES = [
  "zondag",
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
];
const MONTH_NAMES = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

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
  if (mode === "24") {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  const suffix = hours >= 12 ? "PM" : "AM";
  const normalized = hours % 12 || 12;
  return `${normalized}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function toIsoDateTime(date: string, time: string) {
  return new Date(`${date}T${time}`).toISOString();
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
    if (buildSlotsForDate(dateKey, weeklyHours, duration, slotMinutes).length > 0) {
      return dateKey;
    }
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

function BookingEmbedContent() {
  const params = useSearchParams();
  const color = params.get("color") || "#f5b04c";
  const theme = params.get("theme") === "dark" ? "dark" : "light";
  const title = params.get("title") || "Plan een afspraak";
  const description =
    params.get("description") ||
    "Kies een moment dat past. We bevestigen uw afspraak meteen in dezelfde flow.";
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
    [params, startTime, endTime, availableDays]
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

  const [currentMonth, setCurrentMonth] = useState(getMonthStart(parseDateKey(initialDate)));
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedTime, setSelectedTime] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [timeMode, setTimeMode] = useState<TimeMode>(defaultTimeMode);
  const [visitorTimezone, setVisitorTimezone] = useState(timezone);
  const [eventType, setEventType] = useState<PublicEventType | null>(null);
  const [availability, setAvailability] = useState<Record<string, AvailabilitySlot[]>>({});
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [resultModal, setResultModal] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [suggestedSlots, setSuggestedSlots] = useState<SuggestedSlot[]>([]);
  const formRef = useRef<HTMLDivElement>(null);

  const effectiveDuration = eventType?.duration || duration;
  const effectiveSlotMinutes = eventType?.slotMinutes || slotMinutes;
  const effectiveColor = eventType?.color || color;
  const effectiveMeetingName = eventType?.name || meetingName;
  const effectiveDescription = eventType?.description || description;
  const effectiveLocation = eventType?.location || meetingLocation;

  const selectedSlots = useMemo(() => {
    const remoteSlots = availability[selectedDate]?.filter((slot) => slot.available).map((slot) => slot.time) || [];
    return remoteSlots.length ? remoteSlots : buildSlotsForDate(selectedDate, weeklyHours, effectiveDuration, effectiveSlotMinutes);
  }, [availability, selectedDate, weeklyHours, effectiveDuration, effectiveSlotMinutes]);

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
      .then((data) => {
        if (data) setEventType(data);
      })
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
    url.searchParams.set("timezone", visitorTimezone);
    setLoadingAvailability(true);
    fetch(url)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.days) {
          setAvailability(Object.fromEntries(data.days.map((day: { date: string; slots: AvailabilitySlot[] }) => [day.date, day.slots])));
        }
      })
      .catch(() => null)
      .finally(() => setLoadingAvailability(false));
  }, [tenant, eventType?.slug, eventTypeSlug, currentMonth, visitorTimezone]);

  useEffect(() => {
    if (!selectedSlots.length) {
      setSelectedTime("");
      return;
    }
    if (!selectedSlots.includes(selectedTime)) {
      setSelectedTime(selectedSlots[0] || "");
    }
  }, [selectedSlots, selectedTime]);

  useEffect(() => {
    if (selectedDate && selectedTime && formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedDate, selectedTime]);

  const monthDays = useMemo(() => createMonthGrid(currentMonth), [currentMonth]);
  const selectedDateObject = selectedDate ? parseDateKey(selectedDate) : null;
  const selectedDayLabel = selectedDateObject
    ? `${DAY_LABELS[(selectedDateObject.getDay() + 6) % 7]} ${selectedDateObject.getDate()}`
    : "Kies een dag";
  const isReadyForForm = Boolean(selectedDate && selectedTime);
  const themeMode = theme as ThemeMode;

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
    const nextKey = formatDateKey(next);
    // Navigate month if needed
    setCurrentMonth(getMonthStart(next));
    // Only select if available
    const nextDayOfWeek = next.getDay();
    const schedule = weeklyHours[nextDayOfWeek];
    if (schedule?.enabled) {
      setSelectedDate(nextKey);
    }
    // Focus the next button
    const btn = document.querySelector(`[data-datekey="${nextKey}"]`) as HTMLButtonElement | null;
    btn?.focus();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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
          date: toIsoDateTime(selectedDate, selectedTime),
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
        return;
      }

      // Rate limit
      if (response.status === 429) {
        setStatus({ type: "error", message: data.error || "Te veel aanvragen. Wacht even en probeer opnieuw." });
        setResultModal(null);
        return;
      }

      // Conflict with suggested slots
      if (data.suggestedSlots?.length) {
        setSuggestedSlots(data.suggestedSlots as SuggestedSlot[]);
      }

      setStatus({ type: "error", message: data.error || "Boeking aanvragen mislukt." });
      setResultModal(null);
    } catch {
      setLoading(false);
      setStatus({
        type: "error",
        message: "Verbindingsfout. Controleer uw internetverbinding en probeer opnieuw.",
      });
      setResultModal(null);
    }
  }

  const themeClasses = {
    page:
      themeMode === "dark"
        ? "min-h-screen bg-[#121212] p-2 text-white sm:p-3"
        : "min-h-screen bg-[#f3f1ee] p-2 text-slate-950 sm:p-3",
    shell:
      themeMode === "dark"
        ? "mx-auto max-w-[1180px] overflow-hidden rounded-[24px] border border-white/8 bg-[#171717] shadow-[0_24px_80px_rgba(0,0,0,0.38)]"
        : "mx-auto max-w-[1180px] overflow-hidden rounded-[24px] border border-black/8 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)]",
    panelBorder:
      themeMode === "dark" ? "border-white/8" : "border-black/8",
    muted:
      themeMode === "dark" ? "text-white/60" : "text-slate-500",
    soft:
      themeMode === "dark" ? "bg-white/5" : "bg-slate-100",
    softStrong:
      themeMode === "dark" ? "bg-white/10" : "bg-slate-200",
    slot:
      themeMode === "dark"
        ? "border-white/12 bg-[#101010] text-white hover:border-white/25"
        : "border-slate-200 bg-white text-slate-900 hover:border-slate-300",
    input:
      themeMode === "dark"
        ? "border-white/10 bg-white/5 text-white placeholder:text-white/40"
        : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400",
    card:
      themeMode === "dark" ? "border-white/10 bg-white/4" : "border-slate-200 bg-white",
  };

  return (
    <div className={themeClasses.page} style={{ colorScheme: themeMode }}>
      <div className={themeClasses.shell}>
        <div className="grid lg:grid-cols-[260px_minmax(0,1fr)_310px]">
          <aside className={`flex flex-col gap-5 border-b p-5 sm:p-6 lg:border-b-0 lg:border-r ${themeClasses.panelBorder}`}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm"
                style={{ backgroundColor: effectiveColor }}
              >
                <Play className="h-5 w-5 fill-current text-white" />
              </div>
              <p className={`text-sm font-semibold ${themeClasses.muted}`}>{brandName}</p>
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.65rem]">
                {effectiveMeetingName}
              </h1>
              <p className={`mt-2 text-sm leading-6 ${themeClasses.muted}`}>{effectiveDescription}</p>
            </div>

            <div className={`space-y-2.5 rounded-2xl border p-3.5 text-sm ${themeClasses.card}`}>
              <div className="flex items-center gap-2.5">
                <Clock3 className="h-4 w-4 shrink-0" style={{ color: effectiveColor }} />
                <span>{effectiveDuration} minuten</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Video className="h-4 w-4 shrink-0" style={{ color: effectiveColor }} />
                <span>{effectiveLocation}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Globe2 className="h-4 w-4 shrink-0" style={{ color: effectiveColor }} />
                <span className="truncate" title={visitorTimezone}>{visitorTimezone}</span>
              </div>
            </div>

            <div className="mt-auto space-y-2">
              <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${themeClasses.muted}`}>
                Voortgang
              </p>
              {[
                {
                  step: 1,
                  label: "Datum",
                  value: selectedDate ? formatLongDate(selectedDate) : null,
                  placeholder: "Kies een dag",
                  done: Boolean(selectedDate),
                },
                {
                  step: 2,
                  label: "Tijdslot",
                  value: selectedTime ? formatTimeDisplay(selectedTime, timeMode) : null,
                  placeholder: "Kies een tijdslot",
                  done: Boolean(selectedTime),
                },
                {
                  step: 3,
                  label: "Gegevens",
                  value: isReadyForForm ? "Formulier invullen" : null,
                  placeholder: "Na tijdkeuze",
                  done: false,
                },
              ].map(({ step, label, value, placeholder, done }) => (
                <div
                  key={step}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all ${done || (step === 3 && isReadyForForm) ? "" : `opacity-60 ${themeClasses.card}`}`}
                  style={done || (step === 3 && isReadyForForm) ? { borderColor: effectiveColor + "55", backgroundColor: effectiveColor + "10" } : {}}
                >
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: done ? effectiveColor : "transparent",
                      color: done ? "#fff" : undefined,
                      borderWidth: done ? 0 : 1.5,
                      borderColor: done ? undefined : "currentColor",
                    }}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" /> : step}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs ${themeClasses.muted}`}>{label}</p>
                    <p className="truncate text-sm font-medium">{value ?? placeholder}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <section className={`border-b p-5 sm:p-6 lg:border-b-0 lg:border-r ${themeClasses.panelBorder}`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-semibold tracking-tight sm:text-[1.65rem]">{formatMonthTitle(currentMonth)}</h2>
                {loadingAvailability ? (
                  <Loader2 className="h-4 w-4 animate-spin opacity-50" />
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentMonth((current) => addMonths(current, -1))}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${themeClasses.slot}`}
                  aria-label="Vorige maand"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentMonth((current) => addMonths(current, 1))}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${themeClasses.slot}`}
                  aria-label="Volgende maand"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div role="row" className="mt-5 grid grid-cols-7 gap-y-2 text-center text-xs font-semibold tracking-wider uppercase">
              {DAY_LABELS.slice(1).concat(DAY_LABELS.slice(0, 1)).map((label) => (
                <div key={label} role="columnheader" aria-label={label} className={themeClasses.muted}>
                  {label}
                </div>
              ))}
            </div>

            <div role="grid" aria-label="Kalender" className="mt-3 grid grid-cols-7 gap-1.5">
              {monthDays.map((day) => {
                const dateKey = formatDateKey(day);
                const inCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const isPast = dateKey < todayKey;
                const remoteSlots = availability[dateKey]?.filter((slot) => slot.available).map((slot) => slot.time) || [];
                const slots = remoteSlots.length ? remoteSlots : buildSlotsForDate(dateKey, weeklyHours, effectiveDuration, effectiveSlotMinutes);
                const isAvailable = !isPast && slots.length > 0;
                const isSelected = selectedDateObject ? isSameDay(day, selectedDateObject) : false;
                const isToday = isSameDay(day, today);

                return (
                  <button
                    key={dateKey}
                    type="button"
                    data-datekey={dateKey}
                    role="gridcell"
                    aria-selected={isSelected}
                    aria-label={`${DAY_NAMES[day.getDay()]} ${day.getDate()} ${MONTH_NAMES[day.getMonth()]} ${day.getFullYear()}${isSelected ? ", geselecteerd" : ""}${isToday ? ", vandaag" : ""}${!isAvailable ? ", niet beschikbaar" : ""}`}
                    onClick={() => {
                      if (!isAvailable) return;
                      setSelectedDate(dateKey);
                      setCurrentMonth(getMonthStart(day));
                    }}
                    onKeyDown={(event) => handleCalendarKeyDown(event, day)}
                    disabled={!isAvailable}
                    className={`relative flex flex-col items-center justify-center gap-0.5 rounded-[14px] border py-2 text-sm font-semibold transition sm:py-3 ${
                      isAvailable ? "cursor-pointer" : "cursor-not-allowed opacity-35"
                    } ${
                      isSelected
                        ? "border-transparent text-slate-950"
                        : inCurrentMonth
                          ? themeClasses.slot
                          : `${themeClasses.slot} opacity-40`
                    }`}
                    style={{
                      backgroundColor: isSelected ? effectiveColor : undefined,
                      boxShadow: isSelected ? `0 8px 24px ${effectiveColor}44` : undefined,
                      touchAction: "manipulation",
                    }}
                  >
                    <span>{day.getDate()}</span>
                    {isToday && !isSelected ? (
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: effectiveColor }}
                      />
                    ) : isAvailable && !isSelected && inCurrentMonth ? (
                      <span className="h-1.5 w-1.5 rounded-full opacity-40" style={{ backgroundColor: effectiveColor }} />
                    ) : (
                      <span className="h-1.5 w-1.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-[1.65rem]">{selectedDayLabel.toLowerCase()}</h2>
                <p className={`mt-1.5 text-sm ${themeClasses.muted}`}>
                  {selectedDate ? formatLongDate(selectedDate) : "Kies eerst een datum in de kalender"}
                </p>
              </div>
              <div className={`inline-flex shrink-0 rounded-[14px] p-1 ${themeClasses.softStrong}`}>
                <button
                  type="button"
                  onClick={() => setTimeMode("12")}
                  className={`rounded-[12px] px-3 py-1.5 text-xs font-medium transition ${
                    timeMode === "12" ? (themeMode === "dark" ? "bg-black text-white" : "bg-white text-slate-950 shadow-sm") : themeClasses.muted
                  }`}
                >
                  12u
                </button>
                <button
                  type="button"
                  onClick={() => setTimeMode("24")}
                  className={`rounded-[12px] px-3 py-1.5 text-xs font-medium transition ${
                    timeMode === "24" ? (themeMode === "dark" ? "bg-black text-white" : "bg-white text-slate-950 shadow-sm") : themeClasses.muted
                  }`}
                >
                  24u
                </button>
              </div>
            </div>

            <div>
              {selectedSlots.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {selectedSlots.map((slot) => {
                    const active = selectedTime === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        aria-pressed={active}
                        aria-label={`Tijdslot ${formatTimeDisplay(slot, timeMode)}`}
                        onClick={() => setSelectedTime(slot)}
                        className={`flex h-11 items-center justify-center rounded-[14px] border px-3 text-sm font-semibold transition ${
                          active ? "border-transparent text-slate-950" : themeClasses.slot
                        }`}
                        style={{
                          backgroundColor: active ? effectiveColor : undefined,
                          boxShadow: active ? `0 8px 20px ${effectiveColor}44` : undefined,
                          touchAction: "manipulation",
                        }}
                      >
                        {formatTimeDisplay(slot, timeMode)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className={`rounded-[20px] border px-5 py-6 text-center ${themeClasses.card}`}>
                  <CalendarDays className={`mx-auto mb-3 h-8 w-8 ${themeClasses.muted}`} />
                  <p className="font-medium">Geen tijdsloten beschikbaar</p>
                  <p className={`mt-1 text-sm ${themeClasses.muted}`}>
                    Selecteer een dag met een gekleurde stip in de kalender.
                  </p>
                </div>
              )}
            </div>

            <div ref={formRef}>
            {isReadyForForm ? (
              <form onSubmit={handleSubmit} className={`rounded-[20px] border p-4 ${themeClasses.card}`}>
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Geselecteerd moment</p>
                    <p className={`text-sm ${themeClasses.muted}`}>
                      {formatLongDate(selectedDate)} om {formatTimeDisplay(selectedTime, timeMode)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Naam</label>
                    <input
                      required
                      value={clientName}
                      onChange={(event) => setClientName(event.target.value)}
                      className={`h-12 w-full rounded-2xl border px-4 text-sm outline-none transition focus:border-slate-400 ${themeClasses.input}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">E-mail</label>
                    <input
                      required
                      type="email"
                      value={clientEmail}
                      onChange={(event) => setClientEmail(event.target.value)}
                      className={`h-12 w-full rounded-2xl border px-4 text-sm outline-none transition focus:border-slate-400 ${themeClasses.input}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Opmerking</label>
                    <textarea
                      rows={4}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Vertel kort wat u graag wil bespreken."
                      className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:border-slate-400 ${themeClasses.input}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tijdzone</label>
                    <div className={`flex h-12 items-center gap-2 rounded-2xl border px-4 text-sm ${themeClasses.input}`}>
                      <Globe2 className="h-4 w-4 shrink-0 opacity-50" />
                      <span className="truncate opacity-70">{visitorTimezone}</span>
                    </div>
                  </div>
                  {eventType?.questions.map((question) => (
                    <div key={question.id} className="space-y-2">
                      <label className="text-sm font-medium">
                        {question.label}{question.required ? " *" : ""}
                      </label>
                      {question.type === "textarea" ? (
                        <textarea
                          required={question.required}
                          rows={3}
                          value={questionAnswers[question.id] || ""}
                          onChange={(event) => setQuestionAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                          className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:border-slate-400 ${themeClasses.input}`}
                        />
                      ) : (
                        <input
                          required={question.required}
                          type={question.type === "checkbox" ? "checkbox" : question.type === "phone" ? "tel" : question.type}
                          checked={question.type === "checkbox" ? questionAnswers[question.id] === "yes" : undefined}
                          value={question.type === "checkbox" ? "yes" : questionAnswers[question.id] || ""}
                          onChange={(event) =>
                            setQuestionAnswers((current) => ({
                              ...current,
                              [question.id]: question.type === "checkbox" ? (event.target.checked ? "yes" : "") : event.target.value,
                            }))
                          }
                          className={question.type === "checkbox" ? "h-5 w-5" : `h-12 w-full rounded-2xl border px-4 text-sm outline-none transition focus:border-slate-400 ${themeClasses.input}`}
                        />
                      )}
                    </div>
                  ))}
                  {eventType?.privacyText ? (
                    <label className={`flex gap-3 rounded-2xl border p-3 text-sm ${themeClasses.card}`}>
                      <input
                        type="checkbox"
                        required={eventType.requireConsent}
                        checked={consentAccepted}
                        onChange={(event) => setConsentAccepted(event.target.checked)}
                        className="mt-1 h-4 w-4"
                      />
                      <span className={themeClasses.muted}>{eventType.privacyText}</span>
                    </label>
                  ) : null}
                </div>

                <input
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  className="hidden"
                  name="website"
                />

                <div role="alert" aria-live="polite">
                  {status ? (
                    <div
                      className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                        status.type === "success"
                          ? themeMode === "dark"
                            ? "bg-emerald-500/15 text-emerald-200"
                            : "bg-emerald-50 text-emerald-700"
                          : themeMode === "dark"
                            ? "bg-red-500/15 text-red-200"
                            : "bg-red-50 text-red-700"
                      }`}
                    >
                      {status.message}
                    </div>
                  ) : null}
                </div>

                {suggestedSlots.length > 0 && status?.type === "error" ? (
                  <div className={`mt-3 rounded-2xl border p-4 ${themeClasses.card}`}>
                    <p className={`mb-2.5 text-xs font-semibold uppercase tracking-wider ${themeClasses.muted}`}>
                      Volgende beschikbare momenten
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {suggestedSlots.map((slot) => (
                        <button
                          key={slot.start}
                          type="button"
                          onClick={() => {
                            setSelectedDate(slot.date);
                            setSelectedTime(slot.time);
                            setCurrentMonth(getMonthStart(parseDateKey(slot.date)));
                            setStatus(null);
                            setSuggestedSlots([]);
                          }}
                          className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
                          style={{ borderColor: effectiveColor + "88", color: effectiveColor }}
                        >
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatLongDate(slot.date)} om {formatTimeDisplay(slot.time, timeMode)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-slate-950 transition disabled:opacity-50"
                  style={{ backgroundColor: effectiveColor }}
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /><span>Bezig...</span></>
                  ) : (
                    submitText
                  )}
                </button>
              </form>
            ) : (
              <div className={`rounded-[20px] border px-5 py-5 ${themeClasses.card}`}>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: effectiveColor + "22" }}
                  >
                    <CalendarDays className="h-4 w-4" style={{ color: effectiveColor }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Kies eerst een datum en tijdslot</p>
                    <p className={`text-xs ${themeClasses.muted}`}>Het formulier verschijnt hier daarna automatisch.</p>
                  </div>
                </div>
              </div>
            )}
            </div>
          </section>
        </div>
        {resultModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <div className={`w-full max-w-md rounded-[20px] border p-5 shadow-2xl ${themeClasses.card}`}>
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full ${
                    resultModal.type === "success"
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-red-500/15 text-red-500"
                  }`}
                >
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-base font-semibold">
                    {resultModal.type === "success" ? "Aanvraag verstuurd" : "Verzenden mislukt"}
                  </p>
                  <p className={`text-sm ${themeClasses.muted}`}>{resultModal.message}</p>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setResultModal(null)}
                  className="h-10 rounded-full px-4 text-sm font-semibold text-slate-950"
                  style={{ backgroundColor: effectiveColor }}
                >
                  Sluiten
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BookingEmbedFallback() {
  return (
    <div className="min-h-screen bg-[#f3f1ee] p-2 sm:p-3">
      <div className="mx-auto max-w-[1180px] overflow-hidden rounded-[24px] border border-black/8 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
        <div className="grid animate-pulse lg:grid-cols-[260px_minmax(0,1fr)_310px]">
          <div className="border-b border-black/8 p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-slate-100" />
              <div className="h-4 w-20 rounded-lg bg-slate-100" />
            </div>
            <div className="mt-5 h-7 w-3/4 rounded-lg bg-slate-100" />
            <div className="mt-3 h-4 w-full rounded bg-slate-100" />
            <div className="mt-1 h-4 w-2/3 rounded bg-slate-100" />
            <div className="mt-5 rounded-2xl border p-3.5">
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="h-4 w-4 rounded bg-slate-100" />
                    <div className="h-4 w-24 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="border-b border-black/8 p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between">
              <div className="h-7 w-32 rounded-lg bg-slate-100" />
              <div className="flex gap-2">
                <div className="h-9 w-9 rounded-full bg-slate-100" />
                <div className="h-9 w-9 rounded-full bg-slate-100" />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-7 gap-1.5">
              {Array.from({ length: 42 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-[14px] bg-slate-100" />
              ))}
            </div>
          </div>
          <div className="p-5">
            <div className="h-7 w-20 rounded-lg bg-slate-100" />
            <div className="mt-5 grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-11 rounded-[14px] bg-slate-100" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookingEmbedPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <BookingEmbedFallback />;

  return (
    <Suspense fallback={<BookingEmbedFallback />}>
      <BookingEmbedContent />
    </Suspense>
  );
}
