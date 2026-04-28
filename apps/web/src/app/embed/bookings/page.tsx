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

  const selectedSlots = useMemo(
    () => buildSlotsForDate(selectedDate, weeklyHours, duration, slotMinutes),
    [selectedDate, weeklyHours, duration, slotMinutes]
  );

  useEffect(() => {
    if (!selectedSlots.length) {
      setSelectedTime("");
      return;
    }
    if (!selectedSlots.includes(selectedTime)) {
      setSelectedTime(selectedSlots[0] || "");
    }
  }, [selectedSlots, selectedTime]);

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
        duration,
        notes,
        service: serviceName || undefined,
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
      setStatus({
        type: "success",
        message: "Uw afspraak is aangevraagd. U ontvangt snel een bevestiging per e-mail.",
      });
      return;
    }

    setStatus({
      type: "error",
      message: data.error || "Boeking aanvragen mislukt.",
    });
  }

  const themeClasses = {
    page:
      themeMode === "dark"
        ? "min-h-screen bg-[#121212] p-4 text-white"
        : "min-h-screen bg-[#f3f1ee] p-4 text-slate-950",
    shell:
      themeMode === "dark"
        ? "mx-auto min-h-[880px] max-w-[1600px] overflow-hidden rounded-[32px] border border-white/8 bg-[#171717] shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
        : "mx-auto min-h-[880px] max-w-[1600px] overflow-hidden rounded-[32px] border border-black/8 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.12)]",
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

  if (status?.type === "success" && selectedDateObject) {
    return (
      <div className={themeClasses.page} style={{ colorScheme: themeMode }}>
        <div className={`${themeClasses.shell} flex items-center justify-center px-6 py-10`}>
          <div
            className={`w-full max-w-2xl rounded-[32px] border p-8 text-center sm:p-12 ${themeClasses.card}`}
          >
            <div
              className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full text-slate-950"
              style={{ backgroundColor: color }}
            >
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className={`text-sm font-medium uppercase tracking-[0.28em] ${themeClasses.muted}`}>Boeking ontvangen</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">Bedankt voor uw aanvraag</h1>
            <p className={`mx-auto mt-4 max-w-xl text-base leading-7 ${themeClasses.muted}`}>{status.message}</p>
            <div className={`mx-auto mt-8 grid max-w-xl gap-3 rounded-[28px] border p-5 text-left ${themeClasses.card}`}>
              <div className="flex items-center justify-between gap-3">
                <span className={themeClasses.muted}>Afspraak</span>
                <span className="font-medium">{meetingName}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className={themeClasses.muted}>Moment</span>
                <span className="font-medium">
                  {formatLongDate(selectedDate)} om {formatTimeDisplay(selectedTime, timeMode)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className={themeClasses.muted}>Duur</span>
                <span className="font-medium">{duration} min</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className={themeClasses.muted}>Tijdzone</span>
                <span className="font-medium">{timezone}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={themeClasses.page} style={{ colorScheme: themeMode }}>
      <div className={themeClasses.shell}>
        <div className="grid min-h-[880px] lg:grid-cols-[320px_minmax(0,1fr)_360px]">
          <aside className={`flex flex-col gap-6 border-b p-6 sm:p-8 lg:border-b-0 lg:border-r ${themeClasses.panelBorder}`}>
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full border shadow-sm"
              style={{
                backgroundColor: color,
                borderColor: themeMode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.08)",
              }}
            >
              <Play className="h-8 w-8 fill-current text-white" />
            </div>
            <div>
              <p className={`text-lg font-semibold ${themeClasses.muted}`}>{brandName}</p>
              <h1 className="mt-5 text-[clamp(2.2rem,4vw,3.6rem)] font-semibold tracking-tight">
                {meetingName}
                <span className={themeClasses.muted}> / {duration} min</span>
              </h1>
              <p className={`mt-5 max-w-sm text-base leading-7 ${themeClasses.muted}`}>{description}</p>
              {serviceName ? (
                <p className={`mt-2 text-xs font-medium ${themeClasses.muted}`}>Service: {serviceName}</p>
              ) : null}
            </div>

            <div className="space-y-5 pt-2 text-lg">
              <div className="flex items-center gap-4">
                <Clock3 className="h-6 w-6 shrink-0" />
                <span>{duration}m</span>
              </div>
              <div className="flex items-center gap-4">
                <Video className="h-6 w-6 shrink-0" />
                <span>{meetingLocation}</span>
              </div>
              <div className="flex items-center gap-4">
                <Globe2 className="h-6 w-6 shrink-0" />
                <span>{timezone}</span>
              </div>
            </div>

            <div className={`mt-auto rounded-[28px] border p-5 ${themeClasses.card}`}>
              <p className="text-sm font-medium uppercase tracking-[0.22em]" style={{ color }}>
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
                    {isReadyForForm ? "Vul uw gegevens in" : "Na tijdslotkeuze verschijnt het formulier"}
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <section className={`border-b p-6 sm:p-8 lg:border-b-0 lg:border-r ${themeClasses.panelBorder}`}>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{formatMonthTitle(currentMonth)}</h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentMonth((current) => addMonths(current, -1))}
                  className={`flex h-12 w-12 items-center justify-center rounded-full border transition ${themeClasses.slot}`}
                  aria-label="Vorige maand"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentMonth((current) => addMonths(current, 1))}
                  className={`flex h-12 w-12 items-center justify-center rounded-full border transition ${themeClasses.slot}`}
                  aria-label="Volgende maand"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-7 gap-y-4 text-center text-xl font-medium tracking-wide sm:text-2xl">
              {DAY_LABELS.slice(1).concat(DAY_LABELS.slice(0, 1)).map((label) => (
                <div key={label} className={themeClasses.muted}>
                  {label}
                </div>
              ))}
            </div>

            <div className="mt-8 grid grid-cols-7 gap-x-3 gap-y-5">
              {monthDays.map((day) => {
                const dateKey = formatDateKey(day);
                const inCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const isPast = dateKey < todayKey;
                const slots = buildSlotsForDate(dateKey, weeklyHours, duration, slotMinutes);
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
                    className={`relative flex aspect-square min-h-[68px] items-center justify-center rounded-[24px] border text-2xl font-medium transition sm:min-h-[94px] sm:text-[2rem] ${
                      isAvailable ? "" : "cursor-not-allowed opacity-50"
                    } ${
                      isSelected
                        ? "border-transparent text-slate-950 shadow-[0_18px_40px_rgba(245,176,76,0.26)]"
                        : inCurrentMonth
                          ? themeClasses.slot
                          : `${themeClasses.slot} opacity-55`
                    }`}
                    style={{
                      backgroundColor: isSelected ? color : undefined,
                    }}
                  >
                    <span>{day.getDate()}</span>
                    {isToday && !isSelected ? (
                      <span
                        className="absolute bottom-3 h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{selectedDayLabel.toLowerCase()}</h2>
                <p className={`mt-2 text-sm ${themeClasses.muted}`}>
                  {selectedDate ? formatLongDate(selectedDate) : "Kies eerst een datum"}
                </p>
              </div>
              <div className={`inline-flex rounded-[20px] p-1 ${themeClasses.softStrong}`}>
                <button
                  type="button"
                  onClick={() => setTimeMode("12")}
                  className={`rounded-[18px] px-5 py-2 text-lg transition ${
                    timeMode === "12" ? (themeMode === "dark" ? "bg-black text-white" : "bg-white text-slate-950 shadow-sm") : themeClasses.muted
                  }`}
                >
                  12 uur
                </button>
                <button
                  type="button"
                  onClick={() => setTimeMode("24")}
                  className={`rounded-[18px] px-5 py-2 text-lg transition ${
                    timeMode === "24" ? (themeMode === "dark" ? "bg-black text-white" : "bg-white text-slate-950 shadow-sm") : themeClasses.muted
                  }`}
                >
                  24u
                </button>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {selectedSlots.length ? (
                selectedSlots.map((slot) => {
                  const active = selectedTime === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      className={`flex w-full items-center justify-center gap-4 rounded-[22px] border px-6 py-6 text-3xl font-medium transition ${
                        active ? "border-transparent text-slate-950 shadow-[0_18px_40px_rgba(245,176,76,0.22)]" : themeClasses.slot
                      }`}
                      style={{ backgroundColor: active ? color : undefined }}
                    >
                      <span className={`h-4 w-4 rounded-full ${active ? "bg-slate-950" : ""}`} style={!active ? { backgroundColor: "#22c55e" } : undefined} />
                      {formatTimeDisplay(slot, timeMode)}
                    </button>
                  );
                })
              ) : (
                <div className={`rounded-[28px] border px-6 py-8 ${themeClasses.card}`}>
                  <p className="text-lg font-medium">Geen beschikbare slots op deze dag</p>
                  <p className={`mt-2 text-sm leading-6 ${themeClasses.muted}`}>
                    Kies een andere dag in de kalender. Alleen dagen met effectieve beschikbaarheid zijn selecteerbaar.
                  </p>
                </div>
              )}
            </div>

            <div className={`mt-6 rounded-[28px] border p-5 ${themeClasses.card}`}>
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
              <form onSubmit={handleSubmit} className={`mt-6 rounded-[28px] border p-5 ${themeClasses.card}`}>
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
                  className="mt-5 h-12 w-full rounded-full px-5 text-sm font-semibold text-slate-950 transition disabled:opacity-50"
                  style={{ backgroundColor: color }}
                >
                  {loading ? "Bezig..." : submitText}
                </button>
              </form>
            ) : null}

            <div className={`mt-6 text-sm ${themeClasses.muted}`}>
              Door te boeken gaat u akkoord dat we een bevestiging sturen voor dit gekozen moment.
            </div>
          </section>
        </div>
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
  return (
    <Suspense fallback={<BookingEmbedFallback />}>
      <BookingEmbedContent />
    </Suspense>
  );
}
