import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { listGoogleBusyWindows } from "@digitify/api/src/lib/google-calendar";
import { log } from "@digitify/api/src/lib/logger";
import { resolvePublicTenantUserId } from "@digitify/api/src/lib/public-tenant";
import { ensureTenantSchemaCompatibility } from "@digitify/api/src/lib/tenant-schema-compat";
import {
  addDays,
  addMinutes,
  applyWorkspaceEmbedSettingsToEventType,
  ensureDefaultBookingEventType,
  eventTypeNeedsAvailabilityRuleSync,
  formatDateKey,
  getBookingAvailabilityBounds,
  getWeekdayInZone,
  hasBookingOverlap,
  loadEmbedAvailabilityRulesFromSettings,
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
  let eventType;
  try {
    eventType = slug
      ? await prisma.bookingEventType.findFirst({
          where: { createdById: tenantUserId, slug, isActive: true },
          include: { availabilityRules: true },
        })
      : null;
    if (!eventType) {
      if (slug) log.api.warn("Public availability event type slug not found, falling back to default", { tenantUserId, slug });
      eventType = await ensureDefaultBookingEventType(prisma, tenantUserId);
    }
  } catch (error) {
    log.api.warn("Public availability event type lookup failed, forcing schema compatibility retry", { tenantUserId, slug }, error);
    await ensureTenantSchemaCompatibility(prisma, { force: true }).catch(() => null);
    eventType = await ensureDefaultBookingEventType(prisma, tenantUserId);
  }
  if (!eventType) return NextResponse.json({ error: "Bookingtype niet gevonden." }, { status: 404 });

  let needsRuleSync = false;
  try {
    const settingsRules = await loadEmbedAvailabilityRulesFromSettings(prisma, tenantUserId);
    needsRuleSync = eventTypeNeedsAvailabilityRuleSync(eventType.availabilityRules, settingsRules);
    if (needsRuleSync) {
      await applyWorkspaceEmbedSettingsToEventType(prisma, tenantUserId, eventType.id);
      eventType =
        (await prisma.bookingEventType.findFirst({
          where: { id: eventType.id, createdById: tenantUserId },
          include: { availabilityRules: true },
        })) ?? eventType;
    }
  } catch (error) {
    log.api.warn("Public availability event type settings sync skipped", { tenantUserId, eventTypeId: eventType.id }, error);
    needsRuleSync = false;
  }

  const hostIds = Array.isArray(eventType.hostUserIds)
    ? eventType.hostUserIds.map((item) => String(item)).filter(Boolean)
    : [tenantUserId];
  const hostUserId = hostIds[0] || tenantUserId;
  const rules = new Map(eventType.availabilityRules.map((rule) => [rule.weekday, rule]));
  const startDate = parseDateKey(from);
  const endDate = parseDateKey(to);
  const days = [];
  const now = new Date();
  const { earliest, latest } = getBookingAvailabilityBounds(eventType, now);

  const preliminaryHostTz = eventType.timezone?.trim() || "Europe/Brussels";
  const rangeStart = dayBoundsUtc(from, preliminaryHostTz);
  const rangeEnd = dayBoundsUtc(to, preliminaryHostTz);
  let googleWindows: Array<{ start: Date; end: Date; allDay: boolean }> = [];
  let googleEnabled = false;
  let googleTimeZone = preliminaryHostTz;
  try {
    const google = await listGoogleBusyWindows(prisma, {
      timeMin: addDays(rangeStart.start, -1),
      timeMax: addDays(rangeEnd.end, 1),
      userId: hostUserId,
    });
    googleEnabled = google.enabled;
    googleWindows = google.windows;
    googleTimeZone = google.timeZone || preliminaryHostTz;
  } catch {
    googleEnabled = false;
    googleWindows = [];
  }

  const hostTimeZone = eventType.timezone?.trim() || googleTimeZone || preliminaryHostTz;

  for (const cursor = new Date(startDate); cursor <= endDate && days.length < 90; cursor.setDate(cursor.getDate() + 1)) {
    const dateKey = formatDateKey(cursor);
    const weekday = getWeekdayInZone(dateKey, hostTimeZone);
    const rule = rules.get(weekday);
    if (!rule?.enabled) {
      days.push({ date: dateKey, available: false, status: "none", totalSlots: 0, availableSlots: 0, slots: [] });
      continue;
    }
    const slots = [];
    let totalSlots = 0;
    const startMinutes = timeToMinutes(rule.startTime, 9 * 60);
    const endMinutes = timeToMinutes(rule.endTime, 17 * 60);
    const interval = Math.max(5, eventType.slotMinutes || 30);
    const duration = Math.max(5, eventType.duration || 30);
    for (let minutes = startMinutes; minutes + duration <= endMinutes; minutes += interval) {
      const time = minutesToTime(minutes);
      const start = zonedDateTimeToUtc(dateKey, time, hostTimeZone);
      const end = addMinutes(start, duration);
      if (start < earliest || start > latest) continue;

      totalSlots += 1;
      const bufferedStart = addMinutes(start, -(eventType.bufferBefore || 0));
      const bufferedEnd = addMinutes(end, eventType.bufferAfter || 0);

      const localOverlap = await hasBookingOverlap(prisma, {
        ownerUserId: tenantUserId,
        hostUserId,
        start: bufferedStart,
        end: bufferedEnd,
      });
      if (localOverlap) continue;
      if (googleEnabled && overlapsBusyWindow(bufferedStart, bufferedEnd, googleWindows, { hostTimeZone })) {
        continue;
      }

      slots.push({
        time,
        start: start.toISOString(),
        end: end.toISOString(),
        available: true,
        hostUserId,
      });
    }
    const status =
      totalSlots === 0
        ? "none"
        : slots.length === 0
          ? "full"
          : slots.length < totalSlots
            ? "partial"
            : "available";
    days.push({
      date: dateKey,
      available: slots.length > 0,
      status,
      totalSlots,
      availableSlots: slots.length,
      slots,
    });
  }

  await prisma.bookingAnalyticsEvent
    .create({
      data: {
        createdById: tenantUserId,
        eventTypeId: eventType.id,
        type: "availability_view",
        metadata: { from, to, hostTimeZone, googleEnabled, rulesSynced: needsRuleSync },
      },
    })
    .catch(() => null);

  return NextResponse.json({
    eventType: {
      id: eventType.id,
      slug: eventType.slug,
      duration: eventType.duration,
      slotMinutes: eventType.slotMinutes,
      timezone: hostTimeZone,
      maximumHorizonDays: eventType.maximumHorizonDays,
      minimumNoticeHours: eventType.minimumNoticeHours,
    },
    hostTimeZone,
    timezone: hostTimeZone,
    googleCalendarSynced: googleEnabled,
    days,
  });
}
