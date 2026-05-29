import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { listGoogleBusyWindows } from "@digitify/api/src/lib/google-calendar";
import { resolvePublicTenantUserId } from "@digitify/api/src/lib/public-tenant";
import { ensureTenantSchemaCompatibility } from "@digitify/api/src/lib/tenant-schema-compat";
import {
  addDays,
  addMinutes,
  DEFAULT_BOOKING_TIMEZONE,
  ensureDefaultBookingEventType,
  formatDateKey,
  formatDateKeyInZone,
  formatTimeInZone,
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

export async function GET(request: Request) {
  await ensureTenantSchemaCompatibility(prisma).catch(() => null);
  const url = new URL(request.url);
  const tenantUserId = await resolvePublicTenantUserId(prisma, url.searchParams.get("tenant") || "");
  if (!tenantUserId) return NextResponse.json({ error: "Ongeldige tenant." }, { status: 400 });

  const slug = url.searchParams.get("eventType")?.trim() || "";
  const from = url.searchParams.get("from") || formatDateKey(new Date());
  const to = url.searchParams.get("to") || from;
  const displayTimeZone = url.searchParams.get("displayTimezone") || url.searchParams.get("timezone") || DEFAULT_BOOKING_TIMEZONE;
  const eventType = slug
    ? await prisma.bookingEventType.findFirst({
        where: { createdById: tenantUserId, slug, isActive: true },
        include: { availabilityRules: true },
      })
    : await ensureDefaultBookingEventType(prisma, tenantUserId);
  if (!eventType) return NextResponse.json({ error: "Bookingtype niet gevonden." }, { status: 404 });

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

  const preliminaryHostTz = eventType.timezone?.trim() || DEFAULT_BOOKING_TIMEZONE;
  const rangeStart = dayBoundsUtc(from, preliminaryHostTz);
  const rangeEnd = dayBoundsUtc(to, preliminaryHostTz);
  let googleWindows: Array<{ start: Date; end: Date; allDay: boolean }> = [];
  let googleEnabled = false;
  let googleTimeZone = DEFAULT_BOOKING_TIMEZONE;
  try {
    const google = await listGoogleBusyWindows(prisma, {
      timeMin: addDays(rangeStart.start, -1),
      timeMax: addDays(rangeEnd.end, 1),
      userId: hostUserId,
    });
    googleEnabled = google.enabled;
    googleWindows = google.windows;
    googleTimeZone = google.timeZone || DEFAULT_BOOKING_TIMEZONE;
  } catch {
    googleEnabled = false;
    googleWindows = [];
  }

  const hostTimeZone = eventType.timezone?.trim() || googleTimeZone || DEFAULT_BOOKING_TIMEZONE;
  const weekdayMap: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  for (const cursor = new Date(startDate); cursor <= endDate && days.length < 90; cursor.setDate(cursor.getDate() + 1)) {
    const dateKey = formatDateKey(cursor);
    const hostNoon = zonedDateTimeToUtc(dateKey, "12:00", hostTimeZone);
    const weekdayName =
      new Intl.DateTimeFormat("en-US", { timeZone: hostTimeZone, weekday: "long" }).formatToParts(hostNoon).find((part) => part.type === "weekday")
        ?.value || "";
    const rule = rules.get(weekdayMap[weekdayName] ?? cursor.getDay());
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
      const start = zonedDateTimeToUtc(dateKey, time, hostTimeZone);
      const end = addMinutes(start, eventType.duration);
      if (start < earliest || start > latest) continue;

      const bufferedStart = addMinutes(start, -(eventType.bufferBefore || 0));
      const bufferedEnd = addMinutes(end, eventType.bufferAfter || 0);

      const localOverlap = await hasBookingOverlap(prisma, {
        ownerUserId: tenantUserId,
        hostUserId,
        start: bufferedStart,
        end: bufferedEnd,
      });
      if (localOverlap) continue;
      if (googleEnabled && overlapsBusyWindow(bufferedStart, bufferedEnd, googleWindows)) continue;

      const displayDate = formatDateKeyInZone(start, displayTimeZone);
      const displayTime = formatTimeInZone(start, displayTimeZone);
      slots.push({
        time,
        displayTime,
        displayDate,
        start: start.toISOString(),
        end: end.toISOString(),
        available: true,
        hostUserId,
      });
    }
    days.push({ date: dateKey, available: slots.length > 0, slots });
  }

  await prisma.bookingAnalyticsEvent.create({
    data: {
      createdById: tenantUserId,
      eventTypeId: eventType.id,
      type: "availability_view",
      metadata: { from, to, hostTimeZone, displayTimeZone, googleEnabled },
    },
  }).catch(() => null);

  return NextResponse.json({
    eventType: {
      id: eventType.id,
      slug: eventType.slug,
      duration: eventType.duration,
      slotMinutes: eventType.slotMinutes,
      timezone: hostTimeZone,
    },
    hostTimeZone,
    displayTimeZone,
    timezone: hostTimeZone,
    googleCalendarSynced: googleEnabled,
    days,
  });
}
