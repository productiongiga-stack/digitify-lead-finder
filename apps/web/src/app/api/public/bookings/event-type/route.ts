import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import {
  applyWorkspaceEmbedSettingsToEventType,
  ensureDefaultBookingEventType,
  eventTypeNeedsAvailabilityRuleSync,
  loadEmbedAvailabilityRulesFromSettings,
} from "@digitify/api/src/lib/booking-utils";
import { resolvePublicTenantUserId } from "@digitify/api/src/lib/public-tenant";
import { ensureTenantSchemaCompatibility } from "@digitify/api/src/lib/tenant-schema-compat";

export async function GET(request: Request) {
  await ensureTenantSchemaCompatibility(prisma).catch(() => null);
  const url = new URL(request.url);
  const tenantUserId = await resolvePublicTenantUserId(prisma, url.searchParams.get("tenant") || "");
  if (!tenantUserId) return NextResponse.json({ error: "Ongeldige tenant." }, { status: 400 });

  const slug = url.searchParams.get("eventType")?.trim() || "";
  let eventType = slug
    ? await prisma.bookingEventType.findFirst({
        where: { createdById: tenantUserId, slug, isActive: true },
        include: { questions: { orderBy: { sortOrder: "asc" } }, availabilityRules: true },
      })
    : await ensureDefaultBookingEventType(prisma, tenantUserId);

  if (!eventType) return NextResponse.json({ error: "Bookingtype niet gevonden." }, { status: 404 });

  const rules =
    "availabilityRules" in eventType && Array.isArray(eventType.availabilityRules)
      ? eventType.availabilityRules
      : [];
  const settingsRules = await loadEmbedAvailabilityRulesFromSettings(prisma, tenantUserId);
  if (eventTypeNeedsAvailabilityRuleSync(rules, settingsRules)) {
    await applyWorkspaceEmbedSettingsToEventType(prisma, tenantUserId, eventType.id);
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
