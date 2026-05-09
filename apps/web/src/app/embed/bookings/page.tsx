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
  MapPin,
  MoonStar,
  Play,
  SunMedium,
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
type BookingStep = 1 | 2;
type EmbedRuntimeOverrides = {
  tenant?: string;
  eventTypeSlug?: string;
  title?: string;
  description?: string;
  brandName?: string;
  meetingName?: string;
  location?: string;
  service?: string;
  submitText?: string;
};

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
  const paramTenant = params.get("tenant") || "";
  const paramEventTypeSlug = params.get("eventType") || params.get("type") || "";
  const [runtimeOverrides, setRuntimeOverrides] = useState<EmbedRuntimeOverrides>({});
  const tenant = runtimeOverrides.tenant || paramTenant;
  const eventTypeSlug = runtimeOverrides.eventTypeSlug || paramEventTypeSlug;
  const [step, setStep] = useState<BookingStep>(1);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

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

  const effectiveDuration = eventType?.duration || duration;
  const effectiveSlotMinutes = eventType?.slotMinutes || slotMinutes;
  const effectiveColor = eventType?.color || color;
  const effectiveMeetingName = eventType?.name || runtimeOverrides.meetingName || meetingName || runtimeOverrides.title || title;
  const effectiveDescription = eventType?.description || runtimeOverrides.description || description;
  const effectiveLocation = eventType?.location || runtimeOverrides.location || meetingLocation;
  const effectiveBrandName = runtimeOverrides.brandName || brandName;
  const effectiveServiceName = runtimeOverrides.service || serviceName;
  const effectiveSubmitText = runtimeOverrides.submitText || submitText;

  const selectedSlots = useMemo(() => {
    const remoteSlots = availability[selectedDate]?.filter((slot) => slot.available).map((slot) => slot.time) || [];
    return remoteSlots.length ? remoteSlots : buildSlotsForDate(selectedDate, weeklyHours, effectiveDuration, effectiveSlotMinutes);
  }, [availability, selectedDate, weeklyHours, effectiveDuration, effectiveSlotMinutes]);

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) setVisitorTimezone(detected);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const raw = event.data as { type?: string; payload?: unknown } | null;
      if (!raw || raw.type !== "digitify-booking-config") return;
      const payload = (raw.payload || {}) as Record<string, unknown>;
      setRuntimeOverrides((current) => ({
        ...current,
        tenant: typeof payload.tenant === "string" ? payload.tenant : current.tenant,
        eventTypeSlug: typeof payload.eventType === "string" ? payload.eventType : current.eventTypeSlug,
        title: typeof payload.title === "string" ? payload.title : current.title,
        description: typeof payload.description === "string" ? payload.description : current.description,
        brandName: typeof payload.brandName === "string" ? payload.brandName : current.brandName,
        meetingName: typeof payload.meetingName === "string" ? payload.meetingName : current.meetingName,
        location: typeof payload.location === "string" ? payload.location : current.location,
        service: typeof payload.service === "string" ? payload.service : current.service,
        submitText: typeof payload.submitText === "string" ? payload.submitText : current.submitText,
      }));
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
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
    fetch(url)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.days) {
          setAvailability(Object.fromEntries(data.days.map((day: { date: string; slots: AvailabilitySlot[] }) => [day.date, day.slots])));
        }
      })
      .catch(() => null);
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
    window.parent?.postMessage(
      {
        type: "digitify-booking-state",
        payload: {
          step,
          selectedDate,
          selectedTime,
          timezone: visitorTimezone,
          tenant,
          eventType: eventType?.slug || eventTypeSlug || null,
        },
      },
      "*",
    );
  }, [step, selectedDate, selectedTime, visitorTimezone, tenant, eventType?.slug, eventTypeSlug]);

  const monthDays = useMemo(() => createMonthGrid(currentMonth), [currentMonth]);
  const selectedDateObject = selectedDate ? parseDateKey(selectedDate) : null;
  const selectedDayLabel = selectedDateObject
    ? `${DAY_LABELS[(selectedDateObject.getDay() + 6) % 7]} ${selectedDateObject.getDate()}`
    : "Kies een dag";
  const isReadyForForm = Boolean(selectedDate && selectedTime);
  const themeMode = theme as ThemeMode;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedDate || !selectedTime) return;

    setLoading(true);
    setStatus(null);

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
      const nextStatus = {
        type: "success",
        message: "Uw afspraak is aangevraagd. U ontvangt snel een bevestiging per e-mail.",
      } as const;
      setStatus(nextStatus);
      setResultModal(nextStatus);
      setStep(1);
      setDetailsModalOpen(false);
      window.parent?.postMessage(
        {
          type: "digitify-booking-submit",
          payload: { success: true, bookingId: data.bookingId || null, selectedDate, selectedTime },
        },
        "*",
      );
      return;
    }

    const nextStatus = {
      type: "error",
      message: data.error || "Boeking aanvragen mislukt.",
    } as const;
    setStatus(nextStatus);
    setResultModal(nextStatus);
    window.parent?.postMessage(
      {
        type: "digitify-booking-submit",
        payload: { success: false, error: nextStatus.message, selectedDate, selectedTime },
      },
      "*",
    );
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
        <div className="grid lg:grid-cols-[240px_minmax(0,1fr)_300px]">
          <aside className={`flex flex-col gap-4 border-b p-4 sm:p-4 lg:border-b-0 lg:border-r ${themeClasses.panelBorder}`}>
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full border shadow-sm"
              style={{
                backgroundColor: effectiveColor,
                borderColor: themeMode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.08)",
              }}
            >
              <Play className="h-6 w-6 fill-current text-white" />
            </div>
            <div>
              <p className={`text-sm font-semibold ${themeClasses.muted}`}>{effectiveBrandName}</p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                {effectiveMeetingName}
                <span className={themeClasses.muted}> / {effectiveDuration} min</span>
              </h1>
              <p className={`mt-3 max-w-sm text-sm leading-6 ${themeClasses.muted}`}>{effectiveDescription}</p>
              {effectiveServiceName ? (
                <p className={`mt-2 text-xs font-medium ${themeClasses.muted}`}>Service: {effectiveServiceName}</p>
              ) : null}
            </div>

            <div className="space-y-3 pt-1 text-sm">
              <div className="flex items-center gap-3">
                <Clock3 className="h-4 w-4 shrink-0" />
                <span>{effectiveDuration}m</span>
              </div>
              <div className="flex items-center gap-3">
                <Video className="h-4 w-4 shrink-0" />
                <span>{effectiveLocation}</span>
              </div>
              <div className="flex items-center gap-3">
                <Globe2 className="h-4 w-4 shrink-0" />
                <span>{visitorTimezone}</span>
              </div>
            </div>

            <div className={`mt-auto rounded-[20px] border p-4 ${themeClasses.card}`}>
              <p className="text-sm font-medium uppercase tracking-[0.22em]" style={{ color: effectiveColor }}>
                Samenvatting
              </p>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className={themeClasses.muted}>Stap 1</p>
                  <p className="mt-1 font-medium">
                    {selectedDate ? formatLongDate(selectedDate) : "Kies een datum"}
                  </p>
                </div>
                <div>
                  <p className={themeClasses.muted}>Stap 2</p>
                  <p className="mt-1 font-medium">
                    {selectedTime ? formatTimeDisplay(selectedTime, timeMode) : "Kies een tijdslot"}
                  </p>
                </div>
                <div>
                  <p className={themeClasses.muted}>Stap 3</p>
                  <p className="mt-1 font-medium">
                    {isReadyForForm ? "Gegevens invullen en versturen" : "Na tijdslotkeuze kunt u verder"}
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <section className={`border-b p-4 sm:p-5 lg:border-b-0 lg:border-r ${themeClasses.panelBorder}`}>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{formatMonthTitle(currentMonth)}</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentMonth((current) => addMonths(current, -1))}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${themeClasses.slot}`}
                  aria-label="Vorige maand"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentMonth((current) => addMonths(current, 1))}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${themeClasses.slot}`}
                  aria-label="Volgende maand"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-7 gap-y-3 text-center text-sm font-semibold tracking-wide">
              {DAY_LABELS.slice(1).concat(DAY_LABELS.slice(0, 1)).map((label) => (
                <div key={label} className={themeClasses.muted}>
                  {label}
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-7 gap-2">
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
                    onClick={() => {
                      if (!isAvailable) return;
                      setSelectedDate(dateKey);
                      setCurrentMonth(getMonthStart(day));
                    }}
                    disabled={!isAvailable}
                    className={`relative flex aspect-square min-h-[48px] items-center justify-center rounded-[16px] border text-base font-semibold transition sm:min-h-[64px] sm:text-xl ${
                      isAvailable ? "" : "cursor-not-allowed opacity-50"
                    } ${
                      isSelected
                        ? "border-transparent text-slate-950 shadow-[0_18px_40px_rgba(245,176,76,0.26)]"
                        : inCurrentMonth
                          ? themeClasses.slot
                          : `${themeClasses.slot} opacity-55`
                    }`}
                    style={{
                      backgroundColor: isSelected ? effectiveColor : undefined,
                    }}
                  >
                    <span>{day.getDate()}</span>
                    {isToday && !isSelected ? (
                      <span
                        className="absolute bottom-3 h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: effectiveColor }}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{selectedDayLabel.toLowerCase()}</h2>
                <p className={`mt-2 text-sm ${themeClasses.muted}`}>
                  {selectedDate ? formatLongDate(selectedDate) : "Kies eerst een datum"}
                </p>
              </div>
              <div className={`inline-flex rounded-[16px] p-1 ${themeClasses.softStrong}`}>
                <button
                  type="button"
                  onClick={() => setTimeMode("12")}
                  className={`rounded-[14px] px-3 py-1.5 text-sm transition ${
                    timeMode === "12" ? (themeMode === "dark" ? "bg-black text-white" : "bg-white text-slate-950 shadow-sm") : themeClasses.muted
                  }`}
                >
                  12 uur
                </button>
                <button
                  type="button"
                  onClick={() => setTimeMode("24")}
                  className={`rounded-[14px] px-3 py-1.5 text-sm transition ${
                    timeMode === "24" ? (themeMode === "dark" ? "bg-black text-white" : "bg-white text-slate-950 shadow-sm") : themeClasses.muted
                  }`}
                >
                  24u
                </button>
              </div>
            </div>

            <div className="mt-5">
              {selectedSlots.length ? (
                <div className="grid max-h-[220px] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
                  {selectedSlots.map((slot) => {
                    const active = selectedTime === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedTime(slot)}
                        className={`flex h-10 items-center justify-center rounded-[12px] border px-2 text-sm font-semibold transition-all duration-200 ${
                          active ? "border-transparent text-slate-950 shadow-[0_14px_30px_rgba(245,176,76,0.22)]" : themeClasses.slot
                        }`}
                        style={{ backgroundColor: active ? effectiveColor : undefined }}
                      >
                        {formatTimeDisplay(slot, timeMode)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className={`rounded-[28px] border px-6 py-8 ${themeClasses.card}`}>
                  <p className="text-lg font-medium">Geen beschikbare slots op deze dag</p>
                  <p className={`mt-2 text-sm leading-6 ${themeClasses.muted}`}>
                    Kies een andere dag in de kalender. Alleen dagen met effectieve beschikbaarheid zijn selecteerbaar.
                  </p>
                </div>
              )}
            </div>

            <div className={`mt-4 rounded-[20px] border p-4 ${themeClasses.card}`}>
              <div className="flex items-center gap-3">
                {themeMode === "dark" ? <MoonStar className="h-5 w-5" /> : <SunMedium className="h-5 w-5" />}
                <div>
                  <p className="font-medium">Boekingsflow</p>
                  <p className={`text-sm ${themeClasses.muted}`}>
                    Datum kiezen, tijd selecteren en dan pas uw gegevens bevestigen.
                  </p>
                </div>
              </div>
            </div>

            {isReadyForForm ? (
              <div className={`mt-4 rounded-[20px] border p-4 ${themeClasses.card}`}>
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Geselecteerd moment</p>
                    <p className={`text-sm ${themeClasses.muted}`}>
                      {formatLongDate(selectedDate)} om {formatTimeDisplay(selectedTime, timeMode)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStep(2);
                      setDetailsModalOpen(true);
                    }}
                    className="h-11 rounded-full px-5 text-sm font-semibold text-slate-950 transition-all duration-200 hover:scale-[1.01]"
                    style={{ backgroundColor: effectiveColor }}
                  >
                    Ga verder met gegevens
                  </button>
                  <span className={`text-xs ${themeClasses.muted}`}>Boeking blijft in afwachting tot interne goedkeuring.</span>
                </div>
              </div>
            ) : null}

            <div className={`mt-6 text-sm ${themeClasses.muted}`}>
              Na verzending blijft de afspraak eerst in aanvraag. U ontvangt een e-mail zodra uw booking is goedgekeurd.
            </div>
          </section>
        </div>
        {detailsModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <form
              onSubmit={handleSubmit}
              className={`w-full max-w-lg rounded-[20px] border p-5 shadow-2xl transition-all duration-200 ${themeClasses.card}`}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold">Stap 2: uw gegevens</p>
                  <p className={`text-sm ${themeClasses.muted}`}>
                    {formatLongDate(selectedDate)} om {formatTimeDisplay(selectedTime, timeMode)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailsModalOpen(false)}
                  className={`rounded-full border px-3 py-1 text-xs ${themeClasses.slot}`}
                >
                  Sluiten
                </button>
              </div>
              <div className="space-y-4">
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
                    <input
                      value={visitorTimezone}
                      onChange={(event) => setVisitorTimezone(event.target.value)}
                      className={`h-12 w-full rounded-2xl border px-4 text-sm outline-none transition focus:border-slate-400 ${themeClasses.input}`}
                    />
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

              <button
                type="submit"
                disabled={loading}
                className="mt-5 h-12 w-full rounded-full px-5 text-sm font-semibold text-slate-950 transition-all duration-200 disabled:opacity-50"
                style={{ backgroundColor: effectiveColor }}
              >
                {loading ? "Bezig..." : effectiveSubmitText}
              </button>
              <p className={`mt-3 text-xs ${themeClasses.muted}`}>
                Stap 3: na verzending krijgt u direct success/fout feedback en nadien een e-mail zodra de afspraak is goedgekeurd.
              </p>
            </form>
          </div>
        ) : null}
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
                  <p className={`text-sm ${themeClasses.muted}`}>
                    {resultModal.type === "success"
                      ? "Uw booking staat nu in afwachting. U krijgt een e-mail zodra we deze goedkeuren."
                      : resultModal.message}
                  </p>
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
    <div className="min-h-screen bg-[#f3f1ee] p-4">
      <div className="mx-auto max-w-[1600px] overflow-hidden rounded-[32px] border border-black/8 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.12)]">
        <div className="grid min-h-[880px] animate-pulse lg:grid-cols-[320px_minmax(0,1fr)_360px]">
          <div className="border-b border-black/8 p-8 lg:border-b-0 lg:border-r" />
          <div className="border-b border-black/8 p-8 lg:border-b-0 lg:border-r" />
          <div className="p-8" />
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
