import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { sendBrandedEmail } from "@digitify/api/src/lib/email-sender";
import { log } from "@digitify/api/src/lib/logger";
import { isGoogleSlotAvailable } from "@digitify/api/src/lib/google-calendar";
import { resolvePublicTenantUserId } from "@digitify/api/src/lib/public-tenant";
import { ensureTenantSchemaCompatibility } from "@digitify/api/src/lib/tenant-schema-compat";
import {
  addMinutes,
  buildIcsAttachment,
  createPublicToken,
  DEFAULT_BOOKING_TIMEZONE,
  ensureDefaultBookingEventType,
  formatDateKey,
  hashPublicToken,
  hasBookingOverlap,
  minutesToTime,
  timeToMinutes,
} from "@digitify/api/src/lib/booking-utils";
import { fireBookingWebhook } from "@digitify/api/src/lib/booking-webhooks";
import { enforceRateLimit, getClientIp } from "@/lib/http-security";

function userSettingKey(userId: string, key: string) {
  return `user:${userId}:${key.trim()}`;
}

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

function parseRules(rawRules: Array<{ weekday: number; enabled: boolean; startTime: string; endTime: string }>, fallback: DaySchedule) {
  const rules = new Map<number, DaySchedule>();
  for (let day = 0; day <= 6; day += 1) rules.set(day, { enabled: false, start: fallback.start, end: fallback.end });
  for (const rule of rawRules) {
    rules.set(rule.weekday, { enabled: rule.enabled, start: rule.startTime, end: rule.endTime });
  }
  return rules;
}

type SuggestedSlot = { date: string; time: string; start: string };

async function findNextAvailableSlots(
  db: typeof prisma,
  input: {
    tenantUserId: string;
    hostUserId: string;
    eventType: { duration: number; slotMinutes: number; bufferBefore: number; bufferAfter: number };
    rules: Map<number, DaySchedule>;
    fromDate: Date;
    limit?: number;
  }
): Promise<SuggestedSlot[]> {
  const { tenantUserId, hostUserId, eventType, rules, fromDate, limit = 3 } = input;
  const suggestions: SuggestedSlot[] = [];
  const interval = Math.max(5, eventType.slotMinutes || 30);
  const requestedMinutes = fromDate.getHours() * 60 + fromDate.getMinutes();

  for (let dayOffset = 0; dayOffset < 7 && suggestions.length < limit; dayOffset += 1) {
    const candidateDay = new Date(fromDate);
    candidateDay.setDate(fromDate.getDate() + dayOffset);
    const dateKey = formatDateKey(candidateDay);
    const rule = rules.get(candidateDay.getDay());
    if (!rule?.enabled) continue;

    const startMinutes = timeToMinutes(rule.start, 9 * 60);
    const endMinutes = timeToMinutes(rule.end, 17 * 60);
    // On the same day, start from the next slot after the requested time
    const slotStart = dayOffset === 0
      ? Math.ceil((requestedMinutes + interval) / interval) * interval
      : startMinutes;

    for (
      let minutes = Math.max(slotStart, startMinutes);
      minutes + eventType.duration <= endMinutes && suggestions.length < limit;
      minutes += interval
    ) {
      const slotTime = minutesToTime(minutes);
      const slotDatetime = new Date(`${dateKey}T${slotTime}:00`);
      const slotEnd = addMinutes(slotDatetime, eventType.duration);

      const overlap = await hasBookingOverlap(db, {
        ownerUserId: tenantUserId,
        hostUserId,
        start: addMinutes(slotDatetime, -(eventType.bufferBefore || 0)),
        end: addMinutes(slotEnd, eventType.bufferAfter || 0),
      });
      if (!overlap) {
        suggestions.push({ date: dateKey, time: slotTime, start: slotDatetime.toISOString() });
      }
    }
  }
  return suggestions;
}

export async function POST(request: Request) {
  let _phase = "schema-compat";
  // Ensure all booking-related DB columns/tables exist (idempotent, cached for 6h per process)
  await ensureTenantSchemaCompatibility(prisma).catch(() => null);
  try {
    _phase = "parse";
    const body = await request.json();
    _phase = "tenant";
    const ip = getClientIp(request);
    const tenantUserId = await resolvePublicTenantUserId(prisma, String(body.tenant || ""));
    if (!tenantUserId) {
      log.security.warn("Public booking rejected: invalid tenant token", { ip });
      return NextResponse.json({ error: "Ongeldige tenant." }, { status: 400 });
    }

    _phase = "rate-limit";
    const burstLimiter = enforceRateLimit(request, {
      key: `public-booking-burst:${tenantUserId}:${ip}`,
      limit: 4,
      windowMs: 60_000,
      message: "Te veel aanvragen. Wacht even en probeer opnieuw.",
    });
    if (burstLimiter) return burstLimiter;
    const hourlyLimiter = enforceRateLimit(request, {
      key: `public-booking:${tenantUserId}:${ip}`,
      limit: 12,
      windowMs: 60 * 60 * 1000,
      message: "Te veel aanvragen. Probeer het binnen enkele minuten opnieuw.",
    });
    if (hourlyLimiter) return hourlyLimiter;
    if (String(body.website || "").trim()) return NextResponse.json({ success: true });

    _phase = "validate";
    const clientName = String(body.clientName || "").trim();
    const clientEmail = String(body.clientEmail || "").trim();
    const date = String(body.date || "").trim();
    const localDate = String(body.localDate || "").trim();
    const localTime = String(body.localTime || "").trim();
    const notes = String(body.notes || "").trim();
    const eventTypeSlug = String(body.eventType || body.eventTypeSlug || "").trim();
    const timezone = String(body.timezone || DEFAULT_BOOKING_TIMEZONE).trim();
    const answers = Array.isArray(body.answers) ? body.answers : [];
    const consentAccepted = Boolean(body.consentAccepted);

    if (!clientName || !clientEmail || !date) {
      return NextResponse.json({ error: "Naam, e-mail en gewenste datum zijn verplicht." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      return NextResponse.json({ error: "Ongeldig e-mailadres." }, { status: 400 });
    }

    _phase = "event-type";
    const eventType = eventTypeSlug
      ? await prisma.bookingEventType.findFirst({
          where: { createdById: tenantUserId, slug: eventTypeSlug, isActive: true },
          include: {
            availabilityRules: true,
            questions: { orderBy: { sortOrder: "asc" } },
          },
        })
      : await ensureDefaultBookingEventType(prisma, tenantUserId);
    if (!eventType) return NextResponse.json({ error: "Bookingtype niet gevonden." }, { status: 404 });
    if (eventType.requireConsent && !consentAccepted) {
      return NextResponse.json({ error: "Gelieve akkoord te gaan met de privacyvoorwaarden." }, { status: 400 });
    }

    const duration = Number(body.duration || eventType.duration || 60);
    if (!Number.isFinite(duration) || duration < 5 || duration > 480) {
      return NextResponse.json({ error: "Ongeldige afspraakduur (5-480 minuten)." }, { status: 400 });
    }
    const bookingDate = new Date(date);
    if (Number.isNaN(bookingDate.getTime())) {
      return NextResponse.json({ error: "Ongeldige datum." }, { status: 400 });
    }

    const earliest = new Date(Date.now() + Math.max(0, eventType.minimumNoticeHours || 0) * 60 * 60 * 1000);
    const latest = new Date(Date.now() + Math.max(1, eventType.maximumHorizonDays || 60) * 24 * 60 * 60 * 1000);
    if (bookingDate < earliest) return NextResponse.json({ error: "Dit tijdslot valt binnen de minimale reservatietijd." }, { status: 400 });
    if (bookingDate > latest) return NextResponse.json({ error: "Dit tijdslot ligt te ver in de toekomst." }, { status: 400 });

    const fallbackRule = { enabled: true, start: "09:00", end: "17:00" };
    const rules = parseRules(eventType.availabilityRules, fallbackRule);
    const weekdaySource = localDate || bookingDate.toISOString().slice(0, 10);
    const weekday = new Date(`${weekdaySource}T12:00:00`).getDay();
    const rule = rules.get(weekday) || fallbackRule;
    if (!rule.enabled) return NextResponse.json({ error: "Deze dag is niet beschikbaar voor boekingen." }, { status: 400 });
    const selectedTime = localTime || `${String(bookingDate.getHours()).padStart(2, "0")}:${String(bookingDate.getMinutes()).padStart(2, "0")}`;
    const selectedMinutes = selectedTime.split(":").map(Number).reduce((acc, value, index) => acc + value * (index === 0 ? 60 : 1), 0);
    const startMinutes = rule.start.split(":").map(Number).reduce((acc, value, index) => acc + value * (index === 0 ? 60 : 1), 0);
    const endMinutes = rule.end.split(":").map(Number).reduce((acc, value, index) => acc + value * (index === 0 ? 60 : 1), 0);
    if (selectedMinutes < startMinutes || selectedMinutes + duration > endMinutes) {
      return NextResponse.json({ error: "Het gekozen tijdslot valt buiten de ingestelde beschikbaarheid." }, { status: 400 });
    }
    if (eventType.slotMinutes > 0 && (selectedMinutes - startMinutes) % eventType.slotMinutes !== 0) {
      return NextResponse.json({ error: "Het gekozen tijdslot past niet op het ingestelde interval." }, { status: 400 });
    }

    const hostIds = Array.isArray(eventType.hostUserIds)
      ? eventType.hostUserIds.map((item) => String(item)).filter(Boolean)
      : [tenantUserId];
    const hostUserId = hostIds[0] || tenantUserId;
    const bookingEnd = new Date(bookingDate.getTime() + duration * 60 * 1000);

    _phase = "overlap-check";
    const overlap = await hasBookingOverlap(prisma, {
      ownerUserId: tenantUserId,
      hostUserId,
      start: new Date(bookingDate.getTime() - (eventType.bufferBefore || 0) * 60_000),
      end: new Date(bookingEnd.getTime() + (eventType.bufferAfter || 0) * 60_000),
    });
    if (overlap) {
      const suggestedSlots = await findNextAvailableSlots(prisma, {
        tenantUserId,
        hostUserId,
        eventType: { duration, slotMinutes: eventType.slotMinutes, bufferBefore: eventType.bufferBefore, bufferAfter: eventType.bufferAfter },
        rules,
        fromDate: bookingDate,
      });
      return NextResponse.json(
        { error: "Dit tijdslot is net al ingenomen. Kies een ander moment.", suggestedSlots },
        { status: 409 }
      );
    }

    _phase = "google-check";
    let googleAvailability: { enabled: boolean; available: boolean } = { enabled: false, available: true };
    try {
      googleAvailability = await isGoogleSlotAvailable(prisma, { start: bookingDate, end: bookingEnd, userId: hostUserId });
    } catch {
      // Google auth/network failure — skip the check so customers can still book
    }
    if (googleAvailability.enabled && !googleAvailability.available) {
      const suggestedSlots = await findNextAvailableSlots(prisma, {
        tenantUserId,
        hostUserId,
        eventType: { duration, slotMinutes: eventType.slotMinutes, bufferBefore: eventType.bufferBefore, bufferAfter: eventType.bufferAfter },
        rules,
        fromDate: bookingDate,
      });
      return NextResponse.json(
        { error: "Dit tijdslot is al bezet in de gekoppelde Google agenda.", suggestedSlots },
        { status: 409 }
      );
    }

    _phase = "duplicate-check";
    const duplicateWindow = new Date(Date.now() - 15 * 60 * 1000);
    const recentDuplicate = await prisma.booking.findFirst({
      where: {
        createdAt: { gte: duplicateWindow },
        date: bookingDate,
        createdById: tenantUserId,
        status: { in: ["PENDING", "SCHEDULED", "CONFIRMED"] },
        OR: [
          { clientEmail: { equals: clientEmail, mode: "insensitive" } },
          { clientName: { equals: clientName, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (recentDuplicate) {
      return NextResponse.json({ error: "Deze aanvraag lijkt al verstuurd. Controleer je inbox of probeer straks opnieuw." }, { status: 409 });
    }

    // Check global approval mode setting as fallback when event type uses default "manual"
    let autoConfirm = eventType.approvalMode === "automatic";
    if (!autoConfirm) {
      const approvalModeSetting = await prisma.setting.findFirst({
        where: { key: userSettingKey(tenantUserId, "bookings.default_approval_mode") },
        select: { value: true },
      });
      const globalApprovalMode = typeof approvalModeSetting?.value === "string"
        ? approvalModeSetting.value.trim()
        : "";
      if (globalApprovalMode === "automatic") autoConfirm = true;
    }

    _phase = "booking-create";
    const cancelToken = createPublicToken();
    const rescheduleToken = createPublicToken();
    const booking = await prisma.booking.create({
      data: {
        clientName,
        clientEmail,
        date: bookingDate,
        duration,
        notes: notes || "Aangemaakt via booking embed",
        status: autoConfirm ? "CONFIRMED" : "PENDING",
        timezone,
        location: eventType.location || null,
        eventTypeId: eventType.id,
        hostUserId,
        cancelTokenHash: hashPublicToken(cancelToken),
        rescheduleTokenHash: hashPublicToken(rescheduleToken),
        consentText: eventType.requireConsent ? eventType.privacyText || "Privacyvoorwaarden geaccepteerd." : null,
        consentedAt: eventType.requireConsent ? new Date() : null,
        createdById: tenantUserId,
      },
    });

    _phase = "answers-create";
    const answerRows = answers
      .map((answer: any) => {
        const question = eventType.questions.find((item) => item.id === String(answer.questionId || ""));
        if (!question) return null;
        return { bookingId: booking.id, questionId: question.id, label: question.label, value: String(answer.value ?? "").slice(0, 4000) };
      })
      .filter(Boolean) as Array<{ bookingId: string; questionId: string; label: string; value: string }>;
    if (answerRows.length) await prisma.bookingQuestionAnswer.createMany({ data: answerRows }).catch(() => null);

    await prisma.bookingAnalyticsEvent.create({
      data: { createdById: tenantUserId, eventTypeId: eventType.id, bookingId: booking.id, type: "submit_success", metadata: { timezone, autoConfirm } },
    }).catch(() => null);

    _phase = "settings-fetch";
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: ["branding.company_name", "company.email", "email.from_email"].map((key) =>
            userSettingKey(tenantUserId, key)
          ),
        },
      },
    });
    const scopedSettings = settings.map((row) => ({ ...row, key: row.key.replace(`user:${tenantUserId}:`, "") }));
    const companyName = getSetting(scopedSettings, "branding.company_name", "Digitify");
    const adminRecipient = getSetting(scopedSettings, "company.email") || getSetting(scopedSettings, "email.from_email");
    const bookingDateLabel = booking.date.toLocaleString("nl-BE", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const manageUrl = new URL(`/bookings/manage/${encodeURIComponent(rescheduleToken)}`, request.url).toString();

    const icsAttachment = buildIcsAttachment({
      bookingId: booking.id,
      method: "REQUEST",
      start: booking.date,
      end: addMinutes(booking.date, booking.duration),
      summary: `Afspraak met ${clientName}`,
      description: notes || undefined,
      location: booking.location || undefined,
      organizerEmail: adminRecipient || undefined,
      attendeeEmail: clientEmail,
    });

    if (autoConfirm) {
      // Booking is immediately confirmed — send confirmation email with calendar invite
      await sendBrandedEmail(prisma, {
        toEmail: clientEmail,
        subject: `Afspraak bevestigd bij ${companyName}`,
        body: [
          `Beste ${clientName},`,
          "",
          `Uw afspraak is bevestigd. U vindt de uitnodiging als bijlage.`,
          "",
          `Datum: ${bookingDateLabel}`,
          `Duur: ${booking.duration} minuten`,
          `Locatie: ${booking.location || "-"}`,
          "",
          notes ? `Extra info: ${notes}` : "",
          "",
          `Aanpassen of annuleren: ${manageUrl}`,
        ].filter((line) => line !== "").join("\n"),
        recipientCompany: clientName,
        userId: tenantUserId,
        attachments: [icsAttachment],
      }).catch(() => null);

      if (adminRecipient) {
        await sendBrandedEmail(prisma, {
          toEmail: adminRecipient,
          subject: `Nieuwe booking (automatisch bevestigd): ${clientName}`,
          body: [
            `Er is een nieuwe booking automatisch bevestigd.`,
            "",
            `Naam: ${clientName}`,
            `E-mail: ${clientEmail}`,
            `Bookingtype: ${eventType.name}`,
            `Datum: ${bookingDateLabel}`,
            `Duur: ${booking.duration} minuten`,
            `Locatie: ${booking.location || "-"}`,
            notes ? `Notities: ${notes}` : "",
          ].filter(Boolean).join("\n"),
          recipientCompany: companyName,
          userId: tenantUserId,
        }).catch(() => null);
      }
    } else {
      // Booking is pending — send "we received your request" email
      await sendBrandedEmail(prisma, {
        toEmail: clientEmail,
        subject: `Boeking ontvangen bij ${companyName}`,
        body: [
          `Beste ${clientName},`,
          "",
          `Bedankt voor uw aanvraag. We hebben uw boeking goed ontvangen.`,
          `Datum: ${bookingDateLabel}`,
          `Duur: ${booking.duration} minuten`,
          `Locatie: ${booking.location || "-"}`,
          "",
          notes ? `Extra info: ${notes}` : "",
          "",
          `Aanpassen of annuleren: ${manageUrl}`,
          "",
          `We sturen u zo snel mogelijk een bevestiging.`,
        ].filter((line) => line !== "").join("\n"),
        recipientCompany: clientName,
        userId: tenantUserId,
      }).catch(() => null);

      if (adminRecipient) {
        await sendBrandedEmail(prisma, {
          toEmail: adminRecipient,
          subject: `Nieuwe booking aanvraag: ${clientName}`,
          body: [
            `Er is een nieuwe booking aanvraag binnengekomen.`,
            "",
            `Naam: ${clientName}`,
            `E-mail: ${clientEmail}`,
            `Bookingtype: ${eventType.name}`,
            `Datum: ${bookingDateLabel}`,
            `Duur: ${booking.duration} minuten`,
            `Locatie: ${booking.location || "-"}`,
            notes ? `Notities: ${notes}` : "",
            "",
            `Bevestig of wijs af in de booking workqueue.`,
          ].filter(Boolean).join("\n"),
          recipientCompany: companyName,
          userId: tenantUserId,
        }).catch(() => null);
      }
    }

    // Fire webhook in background (non-blocking)
    fireBookingWebhook(prisma, tenantUserId, "booking.created", {
      id: booking.id,
      clientName,
      clientEmail,
      date: booking.date.toISOString(),
      duration: booking.duration,
      status: booking.status,
      eventType: eventType.name,
      location: booking.location,
      timezone,
      autoConfirmed: autoConfirm,
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      autoConfirmed: autoConfirm,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    log.api.error("Public booking request failed", { route: "/api/public/bookings", phase: _phase, errMsg }, error);
    return NextResponse.json({ error: `Boeking opslaan mislukt. [${_phase}]` }, { status: 500 });
  }
}
