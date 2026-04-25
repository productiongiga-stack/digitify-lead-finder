import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { sendBrandedEmail } from "@digitify/api/src/lib/email-sender";
import {
  isGoogleSlotAvailable,
  upsertGoogleBookingEvent,
  upsertGoogleEventIdInNotes,
} from "@digitify/api/src/lib/google-calendar";
import { checkRateLimit } from "@/lib/rate-limit";

function getSetting(settings: Array<{ key: string; value: unknown }>, key: string, fallback = "") {
  const row = settings.find((item) => item.key === key);
  if (!row) return fallback;
  const raw = row.value;
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw !== "string") return String(raw);
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" || typeof parsed === "number" || typeof parsed === "boolean"
      ? String(parsed)
      : fallback;
  } catch {
    return raw.trim() || fallback;
  }
}

type DaySchedule = { enabled: boolean; start: string; end: string };
type WeeklySchedule = Record<number, DaySchedule>;

function parseWeeklySchedule(
  raw: string,
  fallbackStart: string,
  fallbackEnd: string,
  availableDays: number[]
): WeeklySchedule {
  const defaultSchedule: WeeklySchedule = {
    0: { enabled: availableDays.includes(0), start: fallbackStart, end: fallbackEnd },
    1: { enabled: availableDays.includes(1), start: fallbackStart, end: fallbackEnd },
    2: { enabled: availableDays.includes(2), start: fallbackStart, end: fallbackEnd },
    3: { enabled: availableDays.includes(3), start: fallbackStart, end: fallbackEnd },
    4: { enabled: availableDays.includes(4), start: fallbackStart, end: fallbackEnd },
    5: { enabled: availableDays.includes(5), start: fallbackStart, end: fallbackEnd },
    6: { enabled: availableDays.includes(6), start: fallbackStart, end: fallbackEnd },
  };
  if (!raw) return defaultSchedule;

  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<DaySchedule>>;
    for (const [key, value] of Object.entries(parsed || {})) {
      const day = Number(key);
      if (Number.isNaN(day) || day < 0 || day > 6) continue;
      defaultSchedule[day] = {
        enabled: value.enabled ?? defaultSchedule[day].enabled,
        start: value.start || defaultSchedule[day].start,
        end: value.end || defaultSchedule[day].end,
      };
    }
  } catch {
    return defaultSchedule;
  }

  return defaultSchedule;
}

export async function POST(request: Request) {
  try {
    const forwarded = request.headers.get("x-forwarded-for") || "";
    const ip = forwarded.split(",")[0]?.trim() || "unknown";
    const limiter = checkRateLimit({
      key: `public-booking:${ip}`,
      limit: 12,
      windowMs: 60 * 60 * 1000,
    });
    if (!limiter.allowed) {
      return NextResponse.json(
        { error: "Te veel aanvragen. Probeer het binnen enkele minuten opnieuw." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const honeypot = String(body.website || "").trim();
    if (honeypot) {
      return NextResponse.json({ success: true });
    }
    const clientName = String(body.clientName || "").trim();
    const clientEmail = String(body.clientEmail || "").trim();
    const date = String(body.date || "").trim();
    const localDate = String(body.localDate || "").trim();
    const localTime = String(body.localTime || "").trim();
    const duration = Number(body.duration || 60);
    const notes = String(body.notes || "").trim();
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: [
            "bookings.availability_start_time",
            "bookings.availability_end_time",
            "bookings.slot_minutes",
            "bookings.available_days",
            "bookings.weekly_hours",
            "branding.company_name",
            "company.email",
            "email.from_email",
          ],
        },
      },
    });

    if (!clientName || !clientEmail || !date) {
      return NextResponse.json(
        { error: "Naam, e-mail en gewenste datum zijn verplicht." },
        { status: 400 }
      );
    }

    if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      return NextResponse.json({ error: "Ongeldig e-mailadres." }, { status: 400 });
    }

    if (!Number.isFinite(duration) || duration < 5 || duration > 480) {
      return NextResponse.json({ error: "Ongeldige afspraakduur (5–480 minuten)." }, { status: 400 });
    }

    const bookingDate = new Date(date);
    if (Number.isNaN(bookingDate.getTime())) {
      return NextResponse.json({ error: "Ongeldige datum." }, { status: 400 });
    }

    const startTime = getSetting(settings, "bookings.availability_start_time", "09:00");
    const endTime = getSetting(settings, "bookings.availability_end_time", "17:00");
    const slotMinutes = Number(getSetting(settings, "bookings.slot_minutes", "30"));
    const availableDays = getSetting(settings, "bookings.available_days", "1,2,3,4,5")
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => !Number.isNaN(value));

    const weeklySchedule = parseWeeklySchedule(
      getSetting(settings, "bookings.weekly_hours", ""),
      startTime,
      endTime,
      availableDays
    );
    const weekdaySource = localDate || bookingDate.toISOString().slice(0, 10);
    const weekday = new Date(`${weekdaySource}T12:00:00`).getDay();
    const daySchedule = weeklySchedule[weekday] || { enabled: false, start: startTime, end: endTime };
    if (!daySchedule.enabled) {
      return NextResponse.json({ error: "Deze dag is niet beschikbaar voor boekingen." }, { status: 400 });
    }

    const [requestedHour, requestedMinute] = (localTime || `${String(bookingDate.getUTCHours()).padStart(2, "0")}:${String(bookingDate.getUTCMinutes()).padStart(2, "0")}`)
      .split(":")
      .map((value) => Number(value));
    if (Number.isNaN(requestedHour) || Number.isNaN(requestedMinute)) {
      return NextResponse.json({ error: "Ongeldig tijdslot." }, { status: 400 });
    }
    const minutesOfDay = requestedHour * 60 + requestedMinute;
    const [startHour, startMinute] = daySchedule.start.split(":").map((value) => Number(value));
    const [endHour, endMinute] = daySchedule.end.split(":").map((value) => Number(value));
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (minutesOfDay < startMinutes || minutesOfDay + duration > endMinutes) {
      return NextResponse.json({ error: "Het gekozen tijdslot valt buiten de ingestelde beschikbaarheid." }, { status: 400 });
    }

    if (slotMinutes > 0 && (minutesOfDay - startMinutes) % slotMinutes !== 0) {
      return NextResponse.json({ error: "Het gekozen tijdslot past niet op het ingestelde interval." }, { status: 400 });
    }
    const bookingEnd = new Date(bookingDate.getTime() + duration * 60 * 1000);
    const googleAvailability = await isGoogleSlotAvailable(prisma as any, {
      start: bookingDate,
      end: bookingEnd,
    });
    if (googleAvailability.enabled && !googleAvailability.available) {
      return NextResponse.json(
        { error: "Dit tijdslot is al bezet in de gekoppelde Google agenda." },
        { status: 409 }
      );
    }

    const existingBooking = await prisma.booking.findFirst({
      where: {
        date: bookingDate,
        status: { in: ["PENDING", "SCHEDULED", "CONFIRMED"] },
      },
      select: { id: true },
    });

    if (existingBooking) {
      return NextResponse.json({ error: "Dit tijdslot is net al ingenomen. Kies een ander moment." }, { status: 409 });
    }

    const duplicateWindow = new Date(Date.now() - 15 * 60 * 1000);
    const recentDuplicate = await prisma.booking.findFirst({
      where: {
        createdAt: { gte: duplicateWindow },
        date: bookingDate,
        status: { in: ["PENDING", "SCHEDULED", "CONFIRMED"] },
        OR: clientEmail
          ? [
              { clientEmail: { equals: clientEmail, mode: "insensitive" } },
              { clientName: { equals: clientName, mode: "insensitive" } },
            ]
          : [{ clientName: { equals: clientName, mode: "insensitive" } }],
      },
      select: { id: true },
    });
    if (recentDuplicate) {
      return NextResponse.json(
        { error: "Deze aanvraag lijkt al verstuurd. Controleer je inbox of probeer straks opnieuw." },
        { status: 409 },
      );
    }

    const creator = await prisma.user.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Geen interne gebruiker beschikbaar voor boekingen." },
        { status: 500 }
      );
    }

    const booking = await prisma.booking.create({
      data: {
        clientName,
        clientEmail: clientEmail || null,
        date: bookingDate,
        duration,
        notes: notes || "Aangemaakt via booking embed",
        status: "PENDING",
        createdById: creator.id,
      },
    });
    try {
      const event = await upsertGoogleBookingEvent(prisma as any, {
        start: booking.date,
        end: bookingEnd,
        summary: `Afspraak met ${booking.clientName}`,
        description: [
          `Booking via embed`,
          `Naam: ${booking.clientName}`,
          `E-mail: ${booking.clientEmail || "-"}`,
          `Notities: ${booking.notes || "-"}`,
        ].join("\n"),
        attendeeEmail: booking.clientEmail || undefined,
      });

      if (event.synced && event.eventId) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            notes: upsertGoogleEventIdInNotes(booking.notes, event.eventId),
          },
        });
      }
    } catch {
      await prisma.booking.delete({ where: { id: booking.id } }).catch(() => null);
      return NextResponse.json(
        { error: "Google agenda synchronisatie mislukt. Controleer integratie-instellingen en probeer opnieuw." },
        { status: 502 }
      );
    }

    const companyName = getSetting(settings, "branding.company_name", "Digitify");
    const adminRecipient = getSetting(settings, "company.email") || getSetting(settings, "email.from_email");
    const bookingDateLabel = booking.date.toLocaleString("nl-BE", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const notesText = booking.notes || "Geen extra notities.";

    if (clientEmail) {
      await sendBrandedEmail(prisma, {
        toEmail: clientEmail,
        subject: `Boeking ontvangen bij ${companyName}`,
        body: [
          `Beste ${clientName},`,
          ``,
          `Bedankt voor uw aanvraag. We hebben uw boeking goed ontvangen.`,
          `Datum: ${bookingDateLabel}`,
          `Duur: ${booking.duration} minuten`,
          ``,
          `Extra info: ${notesText}`,
          ``,
          `We sturen u zo snel mogelijk een bevestiging.`,
        ].join("\n"),
        recipientCompany: clientName,
      }).catch(() => null);
    }

    if (adminRecipient) {
      await sendBrandedEmail(prisma, {
        toEmail: adminRecipient,
        subject: `Nieuwe booking aanvraag: ${clientName}`,
        body: [
          `Er is een nieuwe booking aanvraag binnengekomen.`,
          ``,
          `Naam: ${clientName}`,
          `E-mail: ${clientEmail || "-"}`,
          `Datum: ${bookingDateLabel}`,
          `Duur: ${booking.duration} minuten`,
          `Notities: ${notesText}`,
        ].join("\n"),
        recipientCompany: companyName,
      }).catch(() => null);
    }

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
    });
  } catch {
    return NextResponse.json(
      { error: "Boeking opslaan mislukt." },
      { status: 500 }
    );
  }
}
