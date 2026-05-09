import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { sendBrandedEmail } from "@digitify/api/src/lib/email-sender";
import { deleteGoogleBookingEvent, isGoogleSlotAvailable } from "@digitify/api/src/lib/google-calendar";
import {
  buildIcsAttachment,
  getStoredGoogleEventId,
  hashPublicToken,
  hasBookingOverlap,
} from "@digitify/api/src/lib/booking-utils";

async function findBooking(token: string) {
  const hash = hashPublicToken(token);
  return prisma.booking.findFirst({
    where: {
      OR: [{ cancelTokenHash: hash }, { rescheduleTokenHash: hash }],
    },
    include: { eventType: true, questionAnswers: true },
  });
}

function canManage(booking: { status: string; date: Date; eventType?: { minimumNoticeHours: number } | null }) {
  if (["COMPLETED", "REJECTED", "CANCELLED"].includes(booking.status)) return false;
  const cutoffHours = booking.eventType?.minimumNoticeHours ?? 4;
  return booking.date.getTime() - Date.now() > cutoffHours * 60 * 60_000;
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const booking = await findBooking(token);
  if (!booking) return NextResponse.json({ error: "Boeking niet gevonden." }, { status: 404 });
  return NextResponse.json({
    id: booking.id,
    clientName: booking.clientName,
    clientEmail: booking.clientEmail,
    date: booking.date,
    duration: booking.duration,
    status: booking.status,
    notes: booking.notes,
    location: booking.location,
    canManage: canManage(booking),
    eventType: booking.eventType ? { slug: booking.eventType.slug, name: booking.eventType.name, timezone: booking.eventType.timezone } : null,
    answers: booking.questionAnswers,
  });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  const booking = await findBooking(token);
  if (!booking) return NextResponse.json({ error: "Boeking niet gevonden." }, { status: 404 });
  if (!canManage(booking)) return NextResponse.json({ error: "Deze boeking kan niet meer aangepast worden." }, { status: 400 });

  if (action === "cancel") {
    const eventId = getStoredGoogleEventId(booking);
    if (eventId) await deleteGoogleBookingEvent(prisma, eventId, booking.hostUserId || booking.createdById).catch(() => null);
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), googleEventId: null, googleHtmlLink: null },
    });
    if (updated.clientEmail) {
      await sendBrandedEmail(prisma, {
        toEmail: updated.clientEmail,
        subject: "Uw afspraak werd geannuleerd",
        body: [`Beste ${updated.clientName},`, "", "Uw afspraak werd geannuleerd.", `Datum: ${updated.date.toLocaleString("nl-BE")}`].join("\n"),
        recipientCompany: updated.clientName,
        attachments: [
          buildIcsAttachment({
            bookingId: updated.id,
            method: "CANCEL",
            start: updated.date,
            end: new Date(updated.date.getTime() + updated.duration * 60_000),
            summary: `Afspraak met ${updated.clientName}`,
            location: updated.location || undefined,
            attendeeEmail: updated.clientEmail,
          }),
        ],
        userId: updated.createdById,
      }).catch(() => null);
    }
    await prisma.bookingAnalyticsEvent.create({ data: { createdById: updated.createdById, eventTypeId: updated.eventTypeId, bookingId: updated.id, type: "cancel" } }).catch(() => null);
    return NextResponse.json({ success: true, booking: updated });
  }

  if (action === "reschedule") {
    const nextDate = new Date(String(body.date || ""));
    if (Number.isNaN(nextDate.getTime())) return NextResponse.json({ error: "Ongeldige datum." }, { status: 400 });
    const nextEnd = new Date(nextDate.getTime() + booking.duration * 60_000);
    const overlap = await hasBookingOverlap(prisma, {
      ownerUserId: booking.createdById,
      hostUserId: booking.hostUserId || booking.createdById,
      start: nextDate,
      end: nextEnd,
      ignoreBookingId: booking.id,
    });
    if (overlap) return NextResponse.json({ error: "Dit tijdslot is niet meer beschikbaar." }, { status: 409 });
    const google = await isGoogleSlotAvailable(prisma, {
      start: nextDate,
      end: nextEnd,
      ignoreEventId: getStoredGoogleEventId(booking),
      userId: booking.hostUserId || booking.createdById,
    });
    if (google.enabled && !google.available) return NextResponse.json({ error: "Dit tijdslot is bezet in Google Agenda." }, { status: 409 });

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { date: nextDate, rescheduledAt: new Date(), status: "PENDING" },
    });
    if (updated.clientEmail) {
      await sendBrandedEmail(prisma, {
        toEmail: updated.clientEmail,
        subject: "Uw afspraakwijziging werd ontvangen",
        body: [`Beste ${updated.clientName},`, "", "We hebben uw nieuwe gewenste moment ontvangen.", `Nieuw moment: ${updated.date.toLocaleString("nl-BE")}`].join("\n"),
        recipientCompany: updated.clientName,
        userId: updated.createdById,
      }).catch(() => null);
    }
    await prisma.bookingAnalyticsEvent.create({ data: { createdById: updated.createdById, eventTypeId: updated.eventTypeId, bookingId: updated.id, type: "reschedule" } }).catch(() => null);
    return NextResponse.json({ success: true, booking: updated });
  }

  return NextResponse.json({ error: "Onbekende actie." }, { status: 400 });
}
