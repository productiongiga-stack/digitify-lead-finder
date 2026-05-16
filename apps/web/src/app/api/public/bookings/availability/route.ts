import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { isGoogleSlotAvailable } from "@digitify/api/src/lib/google-calendar";
import { resolvePublicTenantUserId } from "@digitify/api/src/lib/public-tenant";
import { ensureTenantSchemaCompatibility } from "@digitify/api/src/lib/tenant-schema-compat";
import {
  addMinutes,
  DEFAULT_BOOKING_TIMEZONE,
  ensureDefaultBookingEventType,
  formatDateKey,
  hasBookingOverlap,
  minutesToTime,
  parseDateKey,
  timeToMinutes,
  toLocalIso,
} from "@digitify/api/src/lib/booking-utils";

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

  for (const cursor = new Date(startDate); cursor <= endDate && days.length < 90; cursor.setDate(cursor.getDate() + 1)) {
    const dateKey = formatDateKey(cursor);
    const rule = rules.get(cursor.getDay());
    const slots = [];
    if (rule?.enabled) {
      const startMinutes = timeToMinutes(rule.startTime, 9 * 60);
      const endMinutes = timeToMinutes(rule.endTime, 17 * 60);
      const interval = Math.max(5, eventType.slotMinutes || 30);
      for (let minutes = startMinutes; minutes + eventType.duration <= endMinutes; minutes += interval) {
        const time = minutesToTime(minutes);
        const start = new Date(toLocalIso(dateKey, time));
        const end = addMinutes(start, eventType.duration);
        if (start < earliest || start > latest) continue;

        const localOverlap = await hasBookingOverlap(prisma, {
          ownerUserId: tenantUserId,
          hostUserId,
          start: addMinutes(start, -(eventType.bufferBefore || 0)),
          end: addMinutes(end, eventType.bufferAfter || 0),
        });
        let available = !localOverlap;
        if (available) {
          try {
            const google = await isGoogleSlotAvailable(prisma, { start, end, userId: hostUserId });
            available = !google.enabled || google.available;
          } catch {
            // Google auth failure — treat slot as available so the calendar still loads
          }
        }
        slots.push({
          time,
          start: start.toISOString(),
          end: end.toISOString(),
          available,
          hostUserId,
        });
      }
    }
    days.push({ date: dateKey, available: slots.some((slot) => slot.available), slots });
  }

  await prisma.bookingAnalyticsEvent.create({
    data: { createdById: tenantUserId, eventTypeId: eventType.id, type: "availability_view", metadata: { from, to, timezone } },
  }).catch(() => null);

  return NextResponse.json({
    eventType: { id: eventType.id, slug: eventType.slug, duration: eventType.duration, slotMinutes: eventType.slotMinutes, timezone: eventType.timezone },
    timezone,
    days,
  });
}
