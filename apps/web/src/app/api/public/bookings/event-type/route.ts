import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { ensureDefaultBookingEventType } from "@digitify/api/src/lib/booking-utils";
import { resolvePublicTenantUserId } from "@digitify/api/src/lib/public-tenant";
import { ensureTenantSchemaCompatibility } from "@digitify/api/src/lib/tenant-schema-compat";

export async function GET(request: Request) {
  await ensureTenantSchemaCompatibility(prisma).catch(() => null);
  const url = new URL(request.url);
  const tenantUserId = await resolvePublicTenantUserId(prisma, url.searchParams.get("tenant") || "");
  if (!tenantUserId) return NextResponse.json({ error: "Ongeldige tenant." }, { status: 400 });

  const slug = url.searchParams.get("eventType")?.trim() || "";
  const eventType = slug
    ? await prisma.bookingEventType.findFirst({
        where: { createdById: tenantUserId, slug, isActive: true },
        include: { questions: { orderBy: { sortOrder: "asc" } } },
      })
    : await ensureDefaultBookingEventType(prisma, tenantUserId);

  if (!eventType) return NextResponse.json({ error: "Bookingtype niet gevonden." }, { status: 404 });

  return NextResponse.json({
    id: eventType.id,
    slug: eventType.slug,
    name: eventType.name,
    description: eventType.description,
    duration: eventType.duration,
    slotMinutes: eventType.slotMinutes,
    color: eventType.color,
    location: eventType.location,
    timezone: eventType.timezone,
    minimumNoticeHours: eventType.minimumNoticeHours,
    maximumHorizonDays: eventType.maximumHorizonDays,
    privacyText: eventType.privacyText,
    requireConsent: eventType.requireConsent,
    questions: eventType.questions.map((question) => ({
      id: question.id,
      label: question.label,
      type: question.type,
      required: question.required,
      options: question.options,
      sortOrder: question.sortOrder,
    })),
  });
}
