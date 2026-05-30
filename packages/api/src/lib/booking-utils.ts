import { createHash, randomBytes } from "node:crypto";
import { type PrismaClient } from "@digitify/db";
import { extractGoogleEventId } from "./google-calendar";
import { getSettingString, settingsRowsToMap } from "./settings";
import { loadWorkspaceSettingRows } from "./workspace-settings";

export const ACTIVE_BOOKING_STATUSES = ["PENDING", "SCHEDULED", "CONFIRMED"] as const;
export const DEFAULT_BOOKING_TIMEZONE = "Europe/Brussels";
export const DEFAULT_MINIMUM_NOTICE_HOURS = 4;
export const DEFAULT_MAXIMUM_HORIZON_DAYS = 60;

export type AvailabilitySlot = {
  /** Wall-clock time in host/business timezone (HH:mm). */
  time: string;
  /** Same instant formatted for visitor display timezone. */
  displayTime?: string;
  displayDate?: string;
  start: string;
  end: string;
  available: boolean;
  hostUserId: string | null;
};

export type AvailabilityDay = {
  date: string;
  available: boolean;
  slots: AvailabilitySlot[];
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return new Date(year || 1970, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

export function minutesToTime(minutes: number) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function timeToMinutes(value: string, fallback = 0) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback;
  return hours * 60 + minutes;
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function toLocalIso(dateKey: string, time: string, timeZone = DEFAULT_BOOKING_TIMEZONE) {
  return zonedDateTimeToUtc(dateKey, time, timeZone).toISOString();
}

function readZonedPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  const raw = parts.find((part) => part.type === type)?.value || "0";
  if (type === "hour" && raw === "24") return 0;
  return Number(raw);
}

/** Wall-clock date+time in `timeZone` → UTC instant (for booking slots & Google sync). */
export function zonedDateTimeToUtc(dateKey: string, time: string, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map((part) => Number(part));
  const [hour, minute] = time.split(":").map((part) => Number(part));
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
    return new Date(`${dateKey}T${time}:00`);
  }

  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const parts = formatter.formatToParts(new Date(utcMs));
    const gotMs = Date.UTC(
      readZonedPart(parts, "year"),
      readZonedPart(parts, "month") - 1,
      readZonedPart(parts, "day"),
      readZonedPart(parts, "hour"),
      readZonedPart(parts, "minute"),
      0,
    );
    const targetMs = Date.UTC(year, month - 1, day, hour, minute, 0);
    const delta = targetMs - gotMs;
    if (delta === 0) break;
    utcMs += delta;
  }

  return new Date(utcMs);
}

export function formatTimeInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = String(readZonedPart(parts, "hour")).padStart(2, "0");
  const minute = String(readZonedPart(parts, "minute")).padStart(2, "0");
  return `${hour}:${minute}`;
}

export function formatDateKeyInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = readZonedPart(parts, "year");
  const month = String(readZonedPart(parts, "month")).padStart(2, "0");
  const day = String(readZonedPart(parts, "day")).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const WEEKDAY_NAME_TO_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/** Weekday (0=Sun) for a calendar date in the business timezone. */
export function getWeekdayInZone(dateKey: string, timeZone: string) {
  const noon = zonedDateTimeToUtc(dateKey, "12:00", timeZone);
  const weekdayName =
    new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" })
      .formatToParts(noon)
      .find((part) => part.type === "weekday")?.value || "";
  return WEEKDAY_NAME_TO_INDEX[weekdayName] ?? parseDateKey(dateKey).getDay();
}

export function formatTimezoneLabel(timeZone: string, locale = "nl-BE") {
  try {
    const label = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "long" })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value;
    return label || timeZone.replace(/_/g, " ");
  } catch {
    return timeZone.replace(/_/g, " ");
  }
}

export async function syncHostTimezoneForWorkspace(
  db: PrismaClient,
  workspaceId: string,
  timezone: string,
) {
  const tz = timezone.trim() || DEFAULT_BOOKING_TIMEZONE;
  await db.bookingEventType.updateMany({
    where: { createdById: workspaceId },
    data: { timezone: tz },
  });
  return { timezone: tz };
}

function coerceSettingBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function pickTimeField(
  value: Record<string, unknown>,
  keys: string[],
  fallback: string,
) {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return fallback;
}

function parseWeeklyHoursFromSettings(
  raw: unknown,
  fallbackStart: string,
  fallbackEnd: string,
  fallbackDaysCsv: string,
) {
  const fallbackDays = fallbackDaysCsv
    .split(",")
    .map((day) => Number(day.trim()))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  const rules: Array<{ weekday: number; enabled: boolean; startTime: string; endTime: string }> = [];
  for (let weekday = 0; weekday <= 6; weekday += 1) {
    rules.push({
      weekday,
      enabled: fallbackDays.includes(weekday),
      startTime: fallbackStart,
      endTime: fallbackEnd,
    });
  }

  let parsed: Record<string, unknown> | null = null;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const value = JSON.parse(raw) as unknown;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        parsed = value as Record<string, unknown>;
      }
    } catch {
      parsed = null;
    }
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    parsed = raw as Record<string, unknown>;
  }

  if (parsed) {
    for (let weekday = 0; weekday <= 6; weekday += 1) {
      const dayValue = parsed[String(weekday)] ?? parsed[weekday];
      if (!dayValue || typeof dayValue !== "object" || Array.isArray(dayValue)) continue;
      const dayMap = dayValue as Record<string, unknown>;
      const base = rules[weekday];
      let startTime = pickTimeField(dayMap, ["start", "startTime"], base.startTime);
      let endTime = pickTimeField(dayMap, ["end", "endTime"], base.endTime);
      if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
        [startTime, endTime] = [base.startTime, base.endTime];
      }
      rules[weekday] = {
        weekday,
        enabled: coerceSettingBoolean(dayMap.enabled, base.enabled),
        startTime,
        endTime,
      };
    }
  }

  if (!rules.some((rule) => rule.enabled)) {
    for (const weekday of fallbackDays.length ? fallbackDays : [1, 2, 3, 4, 5]) {
      rules[weekday].enabled = true;
    }
  }

  return rules;
}

export async function loadEmbedAvailabilityRulesFromSettings(db: PrismaClient, workspaceId: string) {
  const settingsRows = await loadWorkspaceSettingRows(db, { workspaceId, memberId: workspaceId }, [
    "bookings.availability_start_time",
    "bookings.availability_end_time",
    "bookings.available_days",
    "bookings.weekly_hours",
  ]);
  const settings = settingsRowsToMap(settingsRows);
  return parseWeeklyHoursFromSettings(
    settings["bookings.weekly_hours"],
    getSettingString(settings, "bookings.availability_start_time", "09:00"),
    getSettingString(settings, "bookings.availability_end_time", "17:00"),
    getSettingString(settings, "bookings.available_days", "1,2,3,4,5"),
  );
}

/** Push embed settings (color, hours, timezone) into a booking event type for public embeds. */
export async function applyWorkspaceEmbedSettingsToEventType(
  db: PrismaClient,
  workspaceId: string,
  eventTypeId?: string,
) {
  const settingsRows = await loadWorkspaceSettingRows(db, { workspaceId, memberId: workspaceId }, [
    "bookings.embed_meeting_name",
    "bookings.embed_description",
    "bookings.embed_color",
    "bookings.embed_duration",
    "bookings.slot_minutes",
    "bookings.embed_location_label",
    "bookings.google_calendar_timezone",
    "bookings.weekly_hours",
    "bookings.availability_start_time",
    "bookings.availability_end_time",
    "bookings.available_days",
  ]);
  const settings = settingsRowsToMap(settingsRows);

  let target =
    eventTypeId
      ? await db.bookingEventType.findFirst({
          where: { id: eventTypeId, createdById: workspaceId },
          select: { id: true },
        })
      : null;

  if (!target) {
    target = await db.bookingEventType.findFirst({
      where: { createdById: workspaceId, isDefault: true },
      select: { id: true },
    });
  }

  if (!target) {
    const ensured = await ensureDefaultBookingEventType(db, workspaceId);
    if (!ensured) return null;
    target = { id: ensured.id };
  }

  const fallbackStart = getSettingString(settings, "bookings.availability_start_time", "09:00");
  const fallbackEnd = getSettingString(settings, "bookings.availability_end_time", "17:00");
  const availabilityRules = parseWeeklyHoursFromSettings(
    settings["bookings.weekly_hours"],
    fallbackStart,
    fallbackEnd,
    getSettingString(settings, "bookings.available_days", "1,2,3,4,5"),
  );

  await db.$transaction([
    db.bookingEventType.update({
      where: { id: target.id },
      data: {
        name: getSettingString(settings, "bookings.embed_meeting_name", "Kennismaking"),
        description: getSettingString(settings, "bookings.embed_description", "Vraag eenvoudig een afspraak aan."),
        color: getSettingString(settings, "bookings.embed_color", "#f9ae5a"),
        duration: Number(getSettingString(settings, "bookings.embed_duration", "60")) || 60,
        slotMinutes: Number(getSettingString(settings, "bookings.slot_minutes", "30")) || 30,
        location: getSettingString(settings, "bookings.embed_location_label", "Google Meet"),
        timezone: getSettingString(settings, "bookings.google_calendar_timezone", DEFAULT_BOOKING_TIMEZONE),
      },
    }),
    db.bookingAvailabilityRule.deleteMany({ where: { eventTypeId: target.id } }),
    db.bookingAvailabilityRule.createMany({
      data: availabilityRules.map((rule) => ({
        eventTypeId: target.id,
        weekday: rule.weekday,
        enabled: rule.enabled,
        startTime: rule.startTime,
        endTime: rule.endTime,
      })),
    }),
  ]);

  return target.id;
}

/** @deprecated Use applyWorkspaceEmbedSettingsToEventType */
export async function applyWorkspaceEmbedSettingsToDefaultEventType(
  db: PrismaClient,
  workspaceId: string,
) {
  return applyWorkspaceEmbedSettingsToEventType(db, workspaceId);
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60_000);
}

export function overlapsBusyWindow(
  start: Date,
  end: Date,
  windows: Array<{ start: Date; end: Date; allDay?: boolean }>,
  options?: { hostTimeZone?: string },
) {
  const hostTimeZone = options?.hostTimeZone?.trim() || DEFAULT_BOOKING_TIMEZONE;
  return windows.some((window) => {
    if (window.allDay) {
      const slotDay = formatDateKeyInZone(start, hostTimeZone);
      const busyStartDay = formatDateKeyInZone(window.start, hostTimeZone);
      const busyEndDay = formatDateKeyInZone(addMinutes(window.end, -1), hostTimeZone);
      return slotDay >= busyStartDay && slotDay <= busyEndDay;
    }
    return start < window.end && window.start < end;
  });
}

export function getBookingAvailabilityBounds(
  eventType: { minimumNoticeHours?: number | null; maximumHorizonDays?: number | null },
  now = new Date(),
) {
  const noticeHours = Math.max(
    0,
    Number.isFinite(eventType.minimumNoticeHours as number)
      ? (eventType.minimumNoticeHours as number)
      : DEFAULT_MINIMUM_NOTICE_HOURS,
  );
  let horizonDays = Number(eventType.maximumHorizonDays);
  if (!Number.isFinite(horizonDays) || horizonDays < 1) {
    horizonDays = DEFAULT_MAXIMUM_HORIZON_DAYS;
  }
  return {
    earliest: new Date(now.getTime() + noticeHours * 60 * 60_000),
    latest: new Date(now.getTime() + horizonDays * 24 * 60 * 60_000),
  };
}

export function eventTypeNeedsAvailabilityRuleSync(
  rules: Array<{ weekday: number; enabled: boolean; startTime: string; endTime: string }>,
  settingsRules: Array<{ weekday: number; enabled: boolean; startTime: string; endTime: string }>,
) {
  if (rules.length === 0) return true;
  if (!rules.some((rule) => rule.enabled)) return true;
  const byWeekday = new Map(rules.map((rule) => [rule.weekday, rule]));
  return settingsRules.some((expected) => {
    const current = byWeekday.get(expected.weekday);
    if (!current) return true;
    return (
      current.enabled !== expected.enabled ||
      current.startTime !== expected.startTime ||
      current.endTime !== expected.endTime
    );
  });
}

export function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "kennismaking";
}

export function removeLegacyGoogleEventId(notes: string | null | undefined) {
  return (notes || "").replace(/\n?\[\[GCAL_EVENT_ID=[^\]]+\]\]/g, "").trim() || null;
}

export function getStoredGoogleEventId(booking: { googleEventId?: string | null; notes?: string | null }) {
  return booking.googleEventId || extractGoogleEventId(booking.notes) || null;
}

export function createPublicToken() {
  return randomBytes(24).toString("base64url");
}

export function hashPublicToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function buildManageUrl(appUrl: string, token: string) {
  return `${appUrl.replace(/\/$/, "")}/bookings/manage/${encodeURIComponent(token)}`;
}

export async function hasBookingOverlap(
  db: PrismaClient,
  input: {
    ownerUserId: string;
    hostUserId?: string | null;
    start: Date;
    end: Date;
    ignoreBookingId?: string | null;
  }
) {
  const candidates = await db.booking.findMany({
    where: {
      createdById: input.ownerUserId,
      id: input.ignoreBookingId ? { not: input.ignoreBookingId } : undefined,
      status: { in: [...ACTIVE_BOOKING_STATUSES] },
      OR: input.hostUserId
        ? [{ hostUserId: input.hostUserId }, { hostUserId: null }]
        : undefined,
      date: { lt: input.end },
    },
    select: { id: true, date: true, duration: true },
    take: 200,
  });

  return candidates.some((booking) => {
    const existingStart = booking.date;
    const existingEnd = addMinutes(existingStart, booking.duration);
    return existingStart < input.end && input.start < existingEnd;
  });
}

/** @param workspaceId Workspace owner id (shared booking configuration). */
export async function ensureDefaultBookingEventType(db: PrismaClient, workspaceId: string) {
  // 1. Try to find the existing default event type
  const existing = await db.bookingEventType.findFirst({
    where: { createdById: workspaceId, isDefault: true },
    include: { availabilityRules: true, questions: { orderBy: { sortOrder: "asc" } } },
  });
  if (existing) return existing;

  const settingsRows = await loadWorkspaceSettingRows(db, { workspaceId, memberId: workspaceId }, [
    "bookings.embed_meeting_name",
    "bookings.embed_description",
    "bookings.embed_color",
    "bookings.embed_duration",
    "bookings.slot_minutes",
    "bookings.embed_location_label",
    "bookings.google_calendar_timezone",
    "bookings.weekly_hours",
    "bookings.availability_start_time",
    "bookings.availability_end_time",
    "bookings.available_days",
  ]);
  const settings = settingsRowsToMap(settingsRows);
  const name = getSettingString(settings, "bookings.embed_meeting_name", "Kennismaking");
  const targetSlug = normalizeSlug(name);
  const duration = Number(getSettingString(settings, "bookings.embed_duration", "60")) || 60;
  const slotMinutes = Number(getSettingString(settings, "bookings.slot_minutes", "30")) || 30;
  const start = getSettingString(settings, "bookings.availability_start_time", "09:00");
  const end = getSettingString(settings, "bookings.availability_end_time", "17:00");
  const days = getSettingString(settings, "bookings.available_days", "1,2,3,4,5")
    .split(",")
    .map((day) => Number(day.trim()))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

  // 2. Try to create the default event type
  try {
    const created = await db.bookingEventType.create({
      data: {
        createdById: workspaceId,
        slug: targetSlug,
        name,
        description: getSettingString(settings, "bookings.embed_description", "Vraag eenvoudig een afspraak aan."),
        duration,
        slotMinutes,
        color: getSettingString(settings, "bookings.embed_color", "#f9ae5a"),
        location: getSettingString(settings, "bookings.embed_location_label", "Google Meet"),
        timezone: getSettingString(settings, "bookings.google_calendar_timezone", DEFAULT_BOOKING_TIMEZONE),
        isDefault: true,
        hostUserIds: [workspaceId],
        availabilityRules: {
          create: Array.from({ length: 7 }, (_, weekday) => ({
            weekday,
            enabled: days.includes(weekday),
            startTime: start,
            endTime: end,
          })),
        },
      },
      include: { availabilityRules: true, questions: { orderBy: { sortOrder: "asc" } } },
    });
    return created;
  } catch {
    // Slug conflict (another event type with the same slug exists, not marked as default).
    // Find any active event type and mark it as the default.
    const fallback = await db.bookingEventType.findFirst({
      where: { createdById: workspaceId, isActive: true },
      include: { availabilityRules: true, questions: { orderBy: { sortOrder: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
    if (fallback) {
      await db.bookingEventType.update({
        where: { id: fallback.id },
        data: { isDefault: true },
      }).catch(() => null);
      return fallback;
    }
    return null;
  }
}

export function buildIcsAttachment(input: {
  bookingId: string;
  method: "REQUEST" | "CANCEL";
  sequence?: number;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string | null;
  organizerEmail?: string;
  attendeeEmail?: string | null;
}) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const format = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Digitify//Bookings//NL",
    `METHOD:${input.method}`,
    "BEGIN:VEVENT",
    `UID:${input.bookingId}@digitify-bookings`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${format(input.start)}`,
    `DTEND:${format(input.end)}`,
    `SEQUENCE:${input.sequence ?? 0}`,
    `STATUS:${input.method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    `SUMMARY:${escapeIcs(input.summary)}`,
    input.description ? `DESCRIPTION:${escapeIcs(input.description)}` : "",
    input.location ? `LOCATION:${escapeIcs(input.location)}` : "",
    input.organizerEmail ? `ORGANIZER:mailto:${input.organizerEmail}` : "",
    input.attendeeEmail ? `ATTENDEE;RSVP=TRUE:mailto:${input.attendeeEmail}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return {
    filename: `booking-${input.bookingId}.ics`,
    contentType: "text/calendar; charset=utf-8; method=" + input.method,
    content: lines.join("\r\n"),
  };
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
