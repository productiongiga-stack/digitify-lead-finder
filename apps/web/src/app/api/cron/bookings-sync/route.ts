import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { loadEmailSettings, sendBrandedEmail } from "@digitify/api/src/lib/email-sender";
import {
  extractGoogleEventId,
  getGoogleBookingEvent,
  upsertGoogleEventIdInNotes,
} from "@digitify/api/src/lib/google-calendar";

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
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const emailCfg = await loadEmailSettings(prisma);
  const companyName = emailCfg.companyName || emailCfg.fromName || "Digitify";
  const adminRecipient = emailCfg.fromEmail || emailCfg.smtpUser || "";

  const bookings = await prisma.booking.findMany({
    where: {
      date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      notes: { contains: "[[GCAL_EVENT_ID=" },
      status: { in: ["PENDING", "SCHEDULED", "CONFIRMED"] },
    },
    orderBy: { date: "asc" },
  });

  let checked = 0;
  let changed = 0;
  let cancelled = 0;
  let failed = 0;

  for (const booking of bookings) {
    const eventId = extractGoogleEventId(booking.notes);
    if (!eventId) continue;

    try {
      const remote = await getGoogleBookingEvent(prisma, eventId);
      if (!remote.enabled) {
        return NextResponse.json({
          success: true,
          checked,
          changed,
          cancelled,
          failed,
          skipped: bookings.length - checked,
          message: "Google sync staat uit of mist configuratie.",
        });
      }

      checked += 1;

      if (!remote.found || remote.cancelled) {
        const updated = await prisma.booking.update({
          where: { id: booking.id },
          data: {
            status: "CANCELLED",
            notes: upsertGoogleEventIdInNotes(booking.notes, null),
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
          notes: upsertGoogleEventIdInNotes(booking.notes, remote.eventId),
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
    } catch {
      failed += 1;
    }
  }

  return NextResponse.json({ success: true, checked, changed, cancelled, failed });
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return runBookingsSync(request);
}

export async function POST(request: Request) {
  return runBookingsSync(request);
}
