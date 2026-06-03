import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import {
  applyWorkspaceEmbedSettingsToEventType,
  ensureDefaultBookingEventType,
  eventTypeNeedsAvailabilityRuleSync,
  loadEmbedAvailabilityRulesFromSettings,
} from "@digitify/api/src/lib/booking-utils";
import { log } from "@digitify/api/src/lib/logger";
import { ensureTenantSchemaCompatibility } from "@digitify/api/src/lib/tenant-schema-compat";
import { enforceRateLimit } from "@/lib/http-security";
import {
  publicBookingRateLimitKey,
  resolvePublicBookingTenantUserId,
} from "@/lib/public-booking-tenant";

export async function GET(request: Request) {
  await ensureTenantSchemaCompatibility(prisma).catch(() => null);
  const url = new URL(request.url);
  const auth = {
    tenant: url.searchParams.get("tenant"),
    quotePortal: url.searchParams.get("quotePortal"),
    portalToken: url.searchParams.get("portalToken"),
  };
  const limiter = await enforceRateLimit(request, {
    key: `public-booking-event-type:${publicBookingRateLimitKey(auth)}`,
    limit: 60,
    windowMs: 60_000,
    message: "Te veel verzoeken. Probeer later opnieuw.",
  });
  if (limiter) return limiter;

  const tenantUserId = await resolvePublicBookingTenantUserId(auth);
  if (!tenantUserId) return NextResponse.json({ error: "Ongeldige tenant." }, { status: 400 });

  const slug = url.searchParams.get("eventType")?.trim() || "";
  let eventType;
  try {
    eventType = slug
      ? await prisma.bookingEventType.findFirst({
          where: { createdById: tenantUserId, slug, isActive: true },
          include: { questions: { orderBy: { sortOrder: "asc" } }, availabilityRules: true },
        })
      : null;
    if (!eventType) {
      if (slug) log.api.warn("Public event type slug not found, falling back to default", { tenantUserId, slug });
      eventType = await ensureDefaultBookingEventType(prisma, tenantUserId);
    }
  } catch (error) {
    log.api.warn("Public event type lookup failed, forcing schema compatibility retry", { tenantUserId, slug }, error);
    await ensureTenantSchemaCompatibility(prisma, { force: true }).catch(() => null);
    eventType = await ensureDefaultBookingEventType(prisma, tenantUserId);
  }

  if (!eventType) return NextResponse.json({ error: "Bookingtype niet gevonden." }, { status: 404 });

  try {
    const rules =
      "availabilityRules" in eventType && Array.isArray(eventType.availabilityRules)
        ? eventType.availabilityRules
        : [];
    const settingsRules = await loadEmbedAvailabilityRulesFromSettings(prisma, tenantUserId);
    if (eventTypeNeedsAvailabilityRuleSync(rules, settingsRules)) {
      await applyWorkspaceEmbedSettingsToEventType(prisma, tenantUserId, eventType.id);
    }
  } catch (error) {
    log.api.warn("Public event type settings sync skipped", { tenantUserId, eventTypeId: eventType.id }, error);
  }

  const resolved = await prisma.bookingEventType.findFirst({
    where: { id: eventType.id, createdById: tenantUserId },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  });
  if (!resolved) return NextResponse.json({ error: "Bookingtype niet gevonden." }, { status: 404 });

  return NextResponse.json({
    id: resolved.id,
    slug: resolved.slug,
    name: resolved.name,
    description: resolved.description,
    duration: resolved.duration,
    slotMinutes: resolved.slotMinutes,
    color: resolved.color,
    location: resolved.location,
    timezone: resolved.timezone,
    minimumNoticeHours: resolved.minimumNoticeHours,
    maximumHorizonDays: resolved.maximumHorizonDays,
    privacyText: resolved.privacyText,
    requireConsent: resolved.requireConsent,
    questions: resolved.questions.map((question) => ({
      id: question.id,
      label: question.label,
      type: question.type,
      required: question.required,
      options: question.options,
      sortOrder: question.sortOrder,
    })),
  });
}
