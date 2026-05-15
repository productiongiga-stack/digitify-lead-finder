import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { loadEmailSettings, sendBrandedEmail } from "@digitify/api/src/lib/email-sender";
import { log } from "@digitify/api/src/lib/logger";
import { deleteGoogleBookingEvent, getGoogleBookingEvent, upsertGoogleBookingEvent } from "@digitify/api/src/lib/google-calendar";
import { buildIcsAttachment, getStoredGoogleEventId, removeLegacyGoogleEventId } from "@digitify/api/src/lib/booking-utils";
import { loadUserSettingRows } from "@digitify/api/src/lib/user-settings";
import { getSettingBoolean, settingsRowsToMap } from "@digitify/api/src/lib/settings";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";

  if (cronSecret) {
    return bearerToken.length > 0 && bearerToken === cronSecret;
  }

  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return isVercelCron;
}

function formatBookingDate(value: Date) {
  return value.toLocaleString("nl-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function sendBookingSyncEmails(input: {
  booking: {
    clientName: string;
    clientEmail: string | null;
    date: Date;
    duration: number;
    status: string;
    notes: string | null;
  };
  companyName: string;
  adminRecipient: string;
  title: string;
  introCustomer: string;
  introAdmin: string;
}) {
  const details = [
    `Datum: ${formatBookingDate(input.booking.date)}`,
    `Duur: ${input.booking.duration} minuten`,
    `Status: ${input.booking.status}`,
    `Notities: ${input.booking.notes || "Geen notities."}`,
  ].join("\n");

  const tasks: Promise<unknown>[] = [];
  if (input.booking.clientEmail) {
    tasks.push(
      sendBrandedEmail(prisma, {
        toEmail: input.booking.clientEmail,
        subject: input.title,
        body: [`Beste ${input.booking.clientName},`, "", input.introCustomer, "", details].join("\n"),
        recipientCompany: input.booking.clientName,
      })
    );
  }

  if (input.adminRecipient) {
    tasks.push(
      sendBrandedEmail(prisma, {
        toEmail: input.adminRecipient,
        subject: `${input.title} · ${input.booking.clientName}`,
        body: [input.introAdmin, "", `Klant: ${input.booking.clientName}`, details].join("\n"),
        recipientCompany: input.companyName,
      })
    );
  }

  await Promise.allSettled(tasks);
}

async function runBookingsSync(request: Request) {
  if (!isAuthorized(request)) {
    log.security.warn("Bookings sync cron unauthorized request");
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const bookings = await prisma.booking.findMany({
    where: {
      date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      OR: [{ googleEventId: { not: null } }, { notes: { contains: "[[GCAL_EVENT_ID=" } }],
      status: { in: ["PENDING", "SCHEDULED", "CONFIRMED"] },
    },
    orderBy: { date: "asc" },
  });

  let checked = 0;
  let changed = 0;
  let cancelled = 0;
  let failed = 0;
  let skipped = 0;
  let reminders = 0;
  let retriesProcessed = 0;

  log.job.info("Bookings sync cron started", { bookings: bookings.length });

  for (const booking of bookings) {
    const eventId = getStoredGoogleEventId(booking);
    if (!eventId) {
      skipped += 1;
      continue;
    }
    const userId = booking.hostUserId || booking.createdById;
    const emailCfg = await loadEmailSettings(prisma, booking.createdById).catch(() => null);
    const companyName = emailCfg?.companyName || emailCfg?.fromName || "Digitify";
    const adminRecipient = emailCfg?.fromEmail || emailCfg?.smtpUser || "";

    try {
      const remote = await getGoogleBookingEvent(prisma, eventId, userId);
      if (!remote.enabled) {
        skipped += 1;
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            googleSyncState: "DISABLED",
            googleSyncError: null,
            googleSyncLastAttemptAt: new Date(),
            googleSyncRetryAt: null,
          },
        }).catch(() => null);
        continue;
      }

      checked += 1;

      if (!remote.found || remote.cancelled) {
        const updated = await prisma.booking.update({
          where: { id: booking.id },
          data: {
            status: "CANCELLED",
            googleEventId: null,
            googleHtmlLink: null,
            googleMeetLink: null,
            googleSyncState: "SYNCED",
            googleSyncError: null,
            googleSyncLastAttemptAt: new Date(),
            googleSyncRetryAt: null,
            notes: removeLegacyGoogleEventId(booking.notes),
          },
        });

        changed += 1;
        cancelled += 1;

        await sendBookingSyncEmails({
          booking: updated,
          companyName,
          adminRecipient,
          title: `Afspraak geannuleerd bij ${companyName}`,
          introCustomer: "Uw afspraak werd geannuleerd via de gekoppelde agenda.",
          introAdmin: "Een booking werd automatisch geannuleerd door Google agenda sync.",
        });
        continue;
      }

      if (!remote.start || !remote.end) {
        continue;
      }

      const remoteDuration = Math.max(15, Math.round((remote.end.getTime() - remote.start.getTime()) / 60000));
      const localEnd = new Date(booking.date.getTime() + booking.duration * 60 * 1000);

      const startChanged = Math.abs(remote.start.getTime() - booking.date.getTime()) > 60_000;
      const endChanged = Math.abs(remote.end.getTime() - localEnd.getTime()) > 60_000;
      const emailCandidate = remote.attendeeEmails.find((email) => email.includes("@"));
      const emailChanged = Boolean(emailCandidate && !booking.clientEmail);

      if (!startChanged && !endChanged && !emailChanged) {
        continue;
      }

      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          date: remote.start,
          duration: remoteDuration,
          clientEmail: emailCandidate || booking.clientEmail,
          googleEventId: remote.eventId,
          googleHtmlLink: remote.htmlLink || booking.googleHtmlLink,
          googleMeetLink: remote.meetLink || booking.googleMeetLink,
          googleSyncState: "SYNCED",
          googleSyncError: null,
          googleSyncLastAttemptAt: new Date(),
          googleSyncRetryAt: null,
          notes: removeLegacyGoogleEventId(booking.notes),
        },
      });

      changed += 1;

      await sendBookingSyncEmails({
        booking: updated,
        companyName,
        adminRecipient,
        title: `Afspraak aangepast bij ${companyName}`,
        introCustomer: "Uw afspraak werd bijgewerkt via de gekoppelde agenda synchronisatie.",
        introAdmin: "Een booking werd automatisch bijgewerkt vanuit Google agenda.",
      });
    } catch (error) {
      failed += 1;
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          googleSyncState: "RETRYING",
          googleSyncError: error instanceof Error ? error.message.slice(0, 400) : String(error).slice(0, 400),
          googleSyncLastAttemptAt: new Date(),
          googleSyncRetryAt: new Date(Date.now() + 5 * 60_000),
        },
      }).catch(() => null);
      log.integration.error("Bookings sync item failed", { bookingId: booking.id, eventId }, error);
    }
  }

  const retryCandidates = await prisma.booking.findMany({
    where: {
      status: { in: ["PENDING", "SCHEDULED", "CONFIRMED", "CANCELLED", "REJECTED"] },
      googleSyncState: { in: ["RETRYING", "ERROR"] },
      OR: [{ googleSyncRetryAt: null }, { googleSyncRetryAt: { lte: new Date() } }],
    },
    orderBy: { googleSyncLastAttemptAt: "asc" },
    take: 100,
  });

  for (const booking of retryCandidates) {
    const userId = booking.hostUserId || booking.createdById;
    const attemptedAt = new Date();
    try {
      const shouldDelete = booking.status === "CANCELLED" || booking.status === "REJECTED";
      const eventId = getStoredGoogleEventId(booking);
      if (shouldDelete) {
        if (eventId) await deleteGoogleBookingEvent(prisma, eventId, userId);
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            googleEventId: null,
            googleHtmlLink: null,
            googleMeetLink: null,
            notes: removeLegacyGoogleEventId(booking.notes),
            googleSyncState: "SYNCED",
            googleSyncError: null,
            googleSyncLastAttemptAt: attemptedAt,
            googleSyncRetryAt: null,
          },
        });
        retriesProcessed += 1;
        continue;
      }

      const event = await upsertGoogleBookingEvent(prisma, {
        start: booking.date,
        bookingId: booking.id,
        end: new Date(booking.date.getTime() + booking.duration * 60_000),
        summary: `Afspraak met ${booking.clientName}`,
        description: [
          `Booking status: ${booking.status}`,
          `Klant: ${booking.clientName}`,
          `E-mail: ${booking.clientEmail || "-"}`,
          `Notities: ${booking.notes || "-"}`,
        ].join("\n"),
        attendeeEmail: booking.clientEmail || undefined,
        location: booking.location || undefined,
        existingEventId: eventId,
        userId,
      });

      if (!event.synced || !event.eventId) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            googleSyncState: "DISABLED",
            googleSyncError: null,
            googleSyncLastAttemptAt: attemptedAt,
            googleSyncRetryAt: null,
          },
        });
        retriesProcessed += 1;
        continue;
      }

      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          googleEventId: event.eventId,
          googleHtmlLink: event.htmlLink || booking.googleHtmlLink,
          googleMeetLink: event.meetLink || booking.googleMeetLink,
          notes: removeLegacyGoogleEventId(booking.notes),
          googleSyncState: "SYNCED",
          googleSyncError: null,
          googleSyncLastAttemptAt: attemptedAt,
          googleSyncRetryAt: null,
        },
      });
      retriesProcessed += 1;
    } catch (error) {
      failed += 1;
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          googleSyncState: "RETRYING",
          googleSyncError: error instanceof Error ? error.message.slice(0, 400) : String(error).slice(0, 400),
          googleSyncLastAttemptAt: attemptedAt,
          googleSyncRetryAt: new Date(Date.now() + 5 * 60_000),
        },
      }).catch(() => null);
      log.integration.error("Bookings retry sync failed", { bookingId: booking.id }, error);
    }
  }

  const reminderCandidates = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      date: {
        gte: new Date(),
        lte: new Date(Date.now() + 25 * 60 * 60_000),
      },
      clientEmail: { not: null },
    },
    orderBy: { date: "asc" },
    take: 200,
  });

  // Cache reminder settings per user to avoid redundant DB lookups
  const reminderSettingsCache = new Map<string, { enabled24h: boolean; enabled1h: boolean }>();

  for (const booking of reminderCandidates) {
    const msUntil = booking.date.getTime() - Date.now();
    const due24h = msUntil <= 24 * 60 * 60_000 && !booking.reminder24hSentAt;
    const due1h = msUntil <= 60 * 60_000 && !booking.reminder1hSentAt;
    if (!due24h && !due1h) continue;

    // Check per-user reminder toggles (default: enabled)
    if (!reminderSettingsCache.has(booking.createdById)) {
      const rows = await loadUserSettingRows(prisma as any, booking.createdById, [
        "bookings.reminders_24h_enabled",
        "bookings.reminders_1h_enabled",
      ]).catch(() => [] as any[]);
      const map = settingsRowsToMap(rows);
      reminderSettingsCache.set(booking.createdById, {
        enabled24h: getSettingBoolean(map, "bookings.reminders_24h_enabled", true),
        enabled1h: getSettingBoolean(map, "bookings.reminders_1h_enabled", true),
      });
    }
    const reminderSettings = reminderSettingsCache.get(booking.createdById)!;
    if (due24h && !reminderSettings.enabled24h) continue;
    if (due1h && !reminderSettings.enabled1h) continue;

    const emailCfg = await loadEmailSettings(prisma, booking.createdById).catch(() => null);
    const companyName = emailCfg?.companyName || emailCfg?.fromName || "Digitify";
    const title = due1h ? `Herinnering: uw afspraak start bijna` : `Herinnering: uw afspraak bij ${companyName}`;
    await sendBrandedEmail(prisma, {
      toEmail: booking.clientEmail || "",
      subject: title,
      body: [
        `Beste ${booking.clientName},`,
        "",
        due1h ? "Uw afspraak start binnen ongeveer een uur." : "Dit is een herinnering voor uw afspraak.",
        `Datum: ${formatBookingDate(booking.date)}`,
        `Duur: ${booking.duration} minuten`,
        booking.location ? `Locatie: ${booking.location}` : "",
        booking.googleMeetLink ? `Google Meet: ${booking.googleMeetLink}` : "",
      ].filter(Boolean).join("\n"),
      recipientCompany: booking.clientName,
      userId: booking.createdById,
      attachments: [
        buildIcsAttachment({
          bookingId: booking.id,
          method: "REQUEST",
          start: booking.date,
          end: new Date(booking.date.getTime() + booking.duration * 60_000),
          summary: `Afspraak met ${booking.clientName}`,
          description: booking.notes || undefined,
          location: booking.googleMeetLink || booking.location || undefined,
          attendeeEmail: booking.clientEmail,
        }),
      ],
    }).catch(() => null);
    await prisma.booking.update({
      where: { id: booking.id },
      data: due1h ? { reminder1hSentAt: new Date() } : { reminder24hSentAt: new Date() },
    });
    reminders += 1;
  }

  log.job.info("Bookings sync cron completed", { checked, changed, cancelled, failed, skipped, reminders, retriesProcessed });
  return NextResponse.json({ success: true, checked, changed, cancelled, failed, skipped, reminders, retriesProcessed });
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return runBookingsSync(request);
}

export async function POST(request: Request) {
  return runBookingsSync(request);
}
