import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { listGoogleBusyWindows } from "@digitify/api/src/lib/google-calendar";
import { resolvePublicTenantUserId } from "@digitify/api/src/lib/public-tenant";
import { ensureTenantSchemaCompatibility } from "@digitify/api/src/lib/tenant-schema-compat";
import {
  addMinutes,
  DEFAULT_BOOKING_TIMEZONE,
  ensureDefaultBookingEventType,
  formatDateKey,
  hasBookingOverlap,
  minutesToTime,
  overlapsBusyWindow,
  parseDateKey,
  timeToMinutes,
  zonedDateTimeToUtc,
} from "@digitify/api/src/lib/booking-utils";

function dayBoundsUtc(dateKey: string, timeZone: string) {
  const start = zonedDateTimeToUtc(dateKey, "00:00", timeZone);
  const end = addMinutes(zonedDateTimeToUtc(dateKey, "23:59", timeZone), 1);
  return { start, end };
}

function slotBlockedByGoogle(
  slotStart: Date,
  slotEnd: Date,
  dateKey: string,
  timeZone: string,
  windows: Array<{ start: Date; end: Date; allDay: boolean }>,
) {
  const dayStart = zonedDateTimeToUtc(dateKey, "00:00", timeZone);
  const dayEnd = addMinutes(zonedDateTimeToUtc(dateKey, "23:59", timeZone), 1);
  for (const window of windows) {
    if (window.allDay && overlap(dayStart, dayEnd, window.start, window.end)) return true;
  }
  return overlapsBusyWindow(
    slotStart,
    slotEnd,
    windows.filter((window) => !window.allDay),
  );
}

function overlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

export async function GET(request: Request) {
  await ensureTenantSchemaCompatibility(prisma).catch(() => null);
  const url = new URL(request.url);
  const tenantUserId = await resolvePublicTenantUserId(prisma, url.searchParams.get("tenant") || "");
  if (!tenantUserId) return NextResponse.json({ error: "Ongeldige tenant." }, { status: 400 });

  const slug = url.searchParams.get("eventType")?.trim() || "";
  const from = url.searchParams.get("from") || formatDateKey(new Date());
  const to = url.searchParams.get("to") || from;
  const timezone = url.searchParams.get("timezone") || DEFAULT_BOOKING_TIMEZONE;
  const eventType = slug
    ? await prisma.bookingEventType.findFirst({
        where: { createdById: tenantUserId, slug, isActive: true },
        include: { availabilityRules: true },
      })
    : await ensureDefaultBookingEventType(prisma, tenantUserId);
  if (!eventType) return NextResponse.json({ error: "Bookingtype niet gevonden." }, { status: 404 });

  const slotTimeZone = eventType.timezone || timezone || DEFAULT_BOOKING_TIMEZONE;
  const hostIds = Array.isArray(eventType.hostUserIds)
    ? eventType.hostUserIds.map((item) => String(item)).filter(Boolean)
    : [tenantUserId];
  const hostUserId = hostIds[0] || tenantUserId;
  const rules = new Map(eventType.availabilityRules.map((rule) => [rule.weekday, rule]));
  const startDate = parseDateKey(from);
  const endDate = parseDateKey(to);
  const days = [];
  const now = new Date();
  const earliest = new Date(now.getTime() + Math.max(0, eventType.minimumNoticeHours || 0) * 60 * 60_000);
  const latest = new Date(now.getTime() + Math.max(1, eventType.maximumHorizonDays || 60) * 24 * 60 * 60_000);

  const rangeStart = dayBoundsUtc(from, slotTimeZone).start;
  const rangeEnd = dayBoundsUtc(to, slotTimeZone).end;
  let googleWindows: Array<{ start: Date; end: Date; allDay: boolean }> = [];
  let googleEnabled = false;
  try {
    const google = await listGoogleBusyWindows(prisma, {
      timeMin: rangeStart,
      timeMax: rangeEnd,
      userId: hostUserId,
    });
    googleEnabled = google.enabled;
    googleWindows = google.windows;
  } catch {
    googleEnabled = false;
    googleWindows = [];
  }

  for (const cursor = new Date(startDate); cursor <= endDate && days.length < 90; cursor.setDate(cursor.getDate() + 1)) {
    const dateKey = formatDateKey(cursor);
    const rule = rules.get(cursor.getDay());
    if (!rule?.enabled) {
      days.push({ date: dateKey, available: false, slots: [] });
      continue;
    }
    const slots = [];
    const startMinutes = timeToMinutes(rule.startTime, 9 * 60);
      const endMinutes = timeToMinutes(rule.endTime, 17 * 60);
      const interval = Math.max(5, eventType.slotMinutes || 30);
      for (let minutes = startMinutes; minutes + eventType.duration <= endMinutes; minutes += interval) {
        const time = minutesToTime(minutes);
        const start = zonedDateTimeToUtc(dateKey, time, slotTimeZone);
        const end = addMinutes(start, eventType.duration);
        if (start < earliest || start > latest) continue;

        const localOverlap = await hasBookingOverlap(prisma, {
          ownerUserId: tenantUserId,
          hostUserId,
          start: addMinutes(start, -(eventType.bufferBefore || 0)),
          end: addMinutes(end, eventType.bufferAfter || 0),
        });
        let available = !localOverlap;
        if (available && googleEnabled) {
          available = !slotBlockedByGoogle(
            addMinutes(start, -(eventType.bufferBefore || 0)),
            addMinutes(end, eventType.bufferAfter || 0),
            dateKey,
            slotTimeZone,
            googleWindows,
          );
        }
        if (!available) continue;
        slots.push({
          time,
          start: start.toISOString(),
          end: end.toISOString(),
          available: true,
          hostUserId,
        });
      }
    days.push({ date: dateKey, available: slots.length > 0, slots });
  }

  await prisma.bookingAnalyticsEvent.create({
    data: { createdById: tenantUserId, eventTypeId: eventType.id, type: "availability_view", metadata: { from, to, timezone: slotTimeZone, googleEnabled } },
  }).catch(() => null);

  return NextResponse.json({
    eventType: { id: eventType.id, slug: eventType.slug, duration: eventType.duration, slotMinutes: eventType.slotMinutes, timezone: slotTimeZone },
    timezone: slotTimeZone,
    googleCalendarSynced: googleEnabled,
    days,
  });
}
