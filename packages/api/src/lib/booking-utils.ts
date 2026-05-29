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
  time: string;
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

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = formatter.formatToParts(new Date(utcMs));
    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
    const gotMs = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"), 0);
    const targetMs = Date.UTC(year, month - 1, day, hour, minute, 0);
    const delta = targetMs - gotMs;
    if (delta === 0) break;
    utcMs += delta;
  }

  return new Date(utcMs);
}

export function overlapsBusyWindow(
  start: Date,
  end: Date,
  windows: Array<{ start: Date; end: Date }>,
) {
  return windows.some((window) => start < window.end && window.start < end);
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
