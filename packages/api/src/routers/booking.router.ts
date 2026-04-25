import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { type PrismaClient } from "@digitify/db";
import { loadEmailSettings, sendBrandedEmail } from "../lib/email-sender";
import { assertLeadAccess } from "../lib/tenant";
import {
  deleteGoogleBookingEvent,
  extractGoogleEventId,
  isGoogleSlotAvailable,
  upsertGoogleBookingEvent,
  upsertGoogleEventIdInNotes,
} from "../lib/google-calendar";

const BOOKING_STATUSES = [
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "CONFIRMED",
  "PENDING",
  "REJECTED",
] as const;

const bookingStatusEnum = z.enum(BOOKING_STATUSES);

function formatBookingDate(value: Date) {
  return value.toLocaleString("nl-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getBookingEndDate(booking: { date: Date; duration: number }) {
  return new Date(booking.date.getTime() + booking.duration * 60 * 1000);
}

async function logBookingActivity(params: {
  db: PrismaClient;
  leadId?: string | null;
  userId: string;
  bookingId: string;
  status: string;
  title: string;
  source: string;
}) {
  await params.db.activity.create({
    data: {
      leadId: params.leadId || null,
      userId: params.userId,
      type: "NOTE_ADDED",
      title: params.title,
      metadata: {
        bookingId: params.bookingId,
        status: params.status,
        source: params.source,
      },
    },
  });
}

async function syncBookingCalendarEvent(
  db: PrismaClient,
  booking: {
    id: string;
    clientName: string;
    clientEmail: string | null;
    date: Date;
    duration: number;
    notes: string | null;
    status: string;
    leadId?: string | null;
  },
  companyName: string,
  userId?: string
) {
  const existingEventId = extractGoogleEventId(booking.notes);
  const shouldDelete = booking.status === "REJECTED" || booking.status === "CANCELLED";
  if (shouldDelete) {
    if (!existingEventId) return booking;
    await deleteGoogleBookingEvent(db, existingEventId, userId).catch(() => null);
    return db.booking.update({
      where: { id: booking.id },
      data: { notes: upsertGoogleEventIdInNotes(booking.notes, null) },
    });
  }

  const event = await upsertGoogleBookingEvent(db, {
    start: booking.date,
    end: getBookingEndDate(booking),
    summary: `Afspraak met ${booking.clientName}`,
    description: [
      `Booking status: ${booking.status}`,
      `Klant: ${booking.clientName}`,
      `E-mail: ${booking.clientEmail || "-"}`,
      `Notities: ${booking.notes || "-"}`,
      `Bedrijf: ${companyName}`,
    ].join("\n"),
    attendeeEmail: booking.clientEmail || undefined,
    existingEventId,
    userId,
  });
  if (!event.synced || !event.eventId) return booking;

  return db.booking.update({
    where: { id: booking.id },
    data: { notes: upsertGoogleEventIdInNotes(booking.notes, event.eventId) },
  });
}

async function sendBookingChangeEmails(params: {
  db: PrismaClient;
  booking: {
    clientName: string;
    clientEmail: string | null;
    date: Date;
    duration: number;
    notes: string | null;
    status: string;
  };
  companyName: string;
  adminRecipient: string;
  customerSubject: string;
  customerIntro: string;
  adminSubject: string;
  adminIntro: string;
  userId?: string;
}) {
  const { booking, companyName, adminRecipient } = params;
  const details = [
    `Datum: ${formatBookingDate(booking.date)}`,
    `Duur: ${booking.duration} minuten`,
    `Status: ${booking.status}`,
    `Notities: ${booking.notes || "Geen notities."}`,
  ].join("\n");

  const emailTasks: Promise<unknown>[] = [];
  if (booking.clientEmail) {
    emailTasks.push(
      sendBrandedEmail(params.db, {
        toEmail: booking.clientEmail,
        subject: params.customerSubject,
        body: [`Beste ${booking.clientName},`, "", params.customerIntro, "", details].join("\n"),
        recipientCompany: booking.clientName,
        userId: params.userId,
      })
    );
  }
  if (adminRecipient) {
    emailTasks.push(
      sendBrandedEmail(params.db, {
        toEmail: adminRecipient,
        subject: params.adminSubject,
        body: [params.adminIntro, "", `Klant: ${booking.clientName}`, `E-mail: ${booking.clientEmail || "-"}`, details].join("\n"),
        recipientCompany: companyName,
        userId: params.userId,
      })
    );
  }
  await Promise.allSettled(emailTasks);
}

export const bookingRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        status: bookingStatusEnum.optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(25),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { status, page = 1, pageSize = 25 } = input ?? {};
      const where: Record<string, unknown> = { createdById: ctx.user.id };
      if (status) where.status = status;

      const [bookings, total] = await Promise.all([
        ctx.db.booking.findMany({
          where,
          orderBy: { date: "asc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            lead: { select: { id: true, companyName: true } },
          },
        }),
        ctx.db.booking.count({ where }),
      ]);

      return { bookings, total, page, pageSize };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const booking = await ctx.db.booking.findFirst({
        where: { id: input.id, createdById: ctx.user.id },
        include: {
          lead: { select: { id: true, companyName: true, email: true, phone: true } },
        },
      });
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Boeking niet gevonden" });
      return booking;
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [total, pending, scheduled, confirmed, completed, cancelled, rejected, noShow] = await Promise.all([
      ctx.db.booking.count({ where: { createdById: ctx.user.id } }),
      ctx.db.booking.count({ where: { status: "PENDING", createdById: ctx.user.id } }),
      ctx.db.booking.count({ where: { status: "SCHEDULED", createdById: ctx.user.id } }),
      ctx.db.booking.count({ where: { status: "CONFIRMED", createdById: ctx.user.id } }),
      ctx.db.booking.count({ where: { status: "COMPLETED", createdById: ctx.user.id } }),
      ctx.db.booking.count({ where: { status: "CANCELLED", createdById: ctx.user.id } }),
      ctx.db.booking.count({ where: { status: "REJECTED", createdById: ctx.user.id } }),
      ctx.db.booking.count({ where: { status: "NO_SHOW", createdById: ctx.user.id } }),
    ]);
    return { total, pending, scheduled, confirmed, completed, cancelled, rejected, noShow };
  }),

  create: protectedProcedure
    .input(
      z.object({
        clientName: z.string().min(1),
        clientEmail: z.union([z.string().email(), z.literal(""), z.undefined()]),
        date: z.string().min(1, "Datum is verplicht").or(z.date()),
        duration: z.number().min(15).default(60),
        notes: z.string().optional(),
        leadId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bookingDate = new Date(input.date);
      if (input.leadId) await assertLeadAccess(ctx.db, ctx.user.id, input.leadId);
      if (isNaN(bookingDate.getTime())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ongeldige datum" });
      }

      // Prevent booking in the past (allow a 5-minute grace window)
      const now = new Date();
      now.setMinutes(now.getMinutes() - 5);
      if (bookingDate < now) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Kan geen boeking aanmaken in het verleden",
        });
      }
      const bookingEnd = new Date(bookingDate.getTime() + input.duration * 60 * 1000);
      const googleSlot = await isGoogleSlotAvailable(ctx.db as any, {
        start: bookingDate,
        end: bookingEnd,
        userId: ctx.user.id,
      });
      if (googleSlot.enabled && !googleSlot.available) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Dit tijdslot is bezet in de gekoppelde Google agenda.",
        });
      }

      const created = await ctx.db.booking.create({
        data: {
          clientName: input.clientName,
          clientEmail: input.clientEmail || null,
          date: bookingDate,
          duration: input.duration,
          notes: input.notes || null,
          leadId: input.leadId || null,
          createdById: ctx.user.id,
        },
      });
      const emailCfg = await loadEmailSettings(ctx.db, ctx.user.id);
      const companyName = emailCfg.companyName || emailCfg.fromName || "Digitify";
      const booking = await syncBookingCalendarEvent(ctx.db, created, companyName, ctx.user.id);

      await logBookingActivity({
        db: ctx.db,
        leadId: booking.leadId,
        userId: ctx.user.id,
        bookingId: booking.id,
        status: booking.status,
        title: `Boeking aangemaakt voor ${booking.clientName}`,
        source: "booking.create",
      });

      const adminRecipient = emailCfg.fromEmail || emailCfg.smtpUser;
      const bookingLabel = formatBookingDate(booking.date);
      const sharedBody = [
        `Boeking: ${bookingLabel}`,
        `Duur: ${booking.duration} minuten`,
        `Notities: ${booking.notes || "Geen notities."}`,
      ].join("\n");

      const emailTasks: Promise<unknown>[] = [];
      if (booking.clientEmail) {
        emailTasks.push(
          sendBrandedEmail(ctx.db, {
            toEmail: booking.clientEmail,
            subject: `Boeking ontvangen bij ${companyName}`,
            body: [
              `Beste ${booking.clientName},`,
              ``,
              `Bedankt voor uw aanvraag. We hebben uw boeking ontvangen.`,
              sharedBody,
              ``,
              `We bevestigen uw afspraak zo snel mogelijk.`,
            ].join("\n"),
            recipientCompany: booking.clientName,
            userId: ctx.user.id,
          }),
        );
      }
      if (adminRecipient) {
        emailTasks.push(
          sendBrandedEmail(ctx.db, {
            toEmail: adminRecipient,
            subject: `Nieuwe booking: ${booking.clientName}`,
            body: [
              `Er werd een booking aangemaakt in de app.`,
              ``,
              `Naam: ${booking.clientName}`,
              `E-mail: ${booking.clientEmail || "-"}`,
              sharedBody,
            ].join("\n"),
            recipientCompany: companyName,
            userId: ctx.user.id,
          }),
        );
      }
      await Promise.allSettled(emailTasks);

      return booking;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        clientName: z.string().min(1).optional(),
        clientEmail: z.union([z.string().email(), z.literal(""), z.undefined()]),
        date: z.string().or(z.date()).optional(),
        duration: z.number().min(15).optional(),
        status: bookingStatusEnum.optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await ctx.db.booking.findFirst({ where: { id, createdById: ctx.user.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Boeking niet gevonden" });
      const updateData: Record<string, unknown> = {};
      if (data.clientName !== undefined) updateData.clientName = data.clientName;
      if (data.clientEmail !== undefined) updateData.clientEmail = data.clientEmail || null;
      if (data.date !== undefined) {
        const bookingDate = new Date(data.date);
        if (isNaN(bookingDate.getTime())) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Ongeldige datum" });
        }
        updateData.date = bookingDate;
      }
      if (data.duration !== undefined) updateData.duration = data.duration;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.notes !== undefined) {
        updateData.notes = upsertGoogleEventIdInNotes(
          data.notes || null,
          extractGoogleEventId(existing.notes)
        );
      }

      const nextDate = data.date !== undefined ? new Date(data.date) : existing.date;
      const nextDuration = data.duration !== undefined ? data.duration : existing.duration;
      const nextStatus = data.status !== undefined ? data.status : existing.status;
      const slotCheck = await isGoogleSlotAvailable(ctx.db as any, {
        start: nextDate,
        end: new Date(nextDate.getTime() + nextDuration * 60 * 1000),
        ignoreEventId: extractGoogleEventId(existing.notes),
        userId: ctx.user.id,
      });
      if (
        slotCheck.enabled &&
        !slotCheck.available &&
        nextStatus !== "REJECTED" &&
        nextStatus !== "CANCELLED"
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Dit tijdslot is bezet in de gekoppelde Google agenda.",
        });
      }

      const updatedRow = await ctx.db.booking.update({ where: { id }, data: updateData });
      const emailCfg = await loadEmailSettings(ctx.db, ctx.user.id);
      const companyName = emailCfg.companyName || emailCfg.fromName || "Digitify";
      const adminRecipient = emailCfg.fromEmail || emailCfg.smtpUser || "";
      const updated = await syncBookingCalendarEvent(ctx.db, updatedRow, companyName, ctx.user.id);
      await logBookingActivity({
        db: ctx.db,
        leadId: updated.leadId,
        userId: ctx.user.id,
        bookingId: updated.id,
        status: updated.status,
        title: `Boeking bijgewerkt voor ${updated.clientName}`,
        source: "booking.update",
      });
      await sendBookingChangeEmails({
        db: ctx.db,
        booking: updated,
        companyName,
        adminRecipient,
        customerSubject: `Update van uw afspraak bij ${companyName}`,
        customerIntro: "Uw afspraakgegevens werden aangepast. Hieronder vindt u de nieuwste planning.",
        adminSubject: `Booking aangepast: ${updated.clientName}`,
        adminIntro: "Een booking werd aangepast in de app.",
        userId: ctx.user.id,
      });
      return updated;
    }),

  confirm: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const booking = await ctx.db.booking.findFirst({ where: { id: input.id, createdById: ctx.user.id } });
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Boeking niet gevonden" });
      if (booking.status === "CANCELLED" || booking.status === "REJECTED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Kan een geannuleerde of afgewezen boeking niet bevestigen",
        });
      }

      const updated = await ctx.db.booking.update({
        where: { id: input.id },
        data: { status: "CONFIRMED" },
      });
      const emailCfg = await loadEmailSettings(ctx.db, ctx.user.id);
      const companyName = emailCfg.companyName || emailCfg.fromName || "Digitify";
      const adminRecipient = emailCfg.fromEmail || emailCfg.smtpUser || "";
      const synced = await syncBookingCalendarEvent(ctx.db, updated, companyName, ctx.user.id);
      await sendBookingChangeEmails({
        db: ctx.db,
        booking: synced,
        companyName,
        adminRecipient,
        customerSubject: `Uw afspraak is bevestigd`,
        customerIntro: `Uw afspraak bij ${companyName} is bevestigd.`,
        adminSubject: `Booking bevestigd: ${synced.clientName}`,
        adminIntro: "Een booking werd bevestigd.",
        userId: ctx.user.id,
      });
      await logBookingActivity({
        db: ctx.db,
        leadId: synced.leadId,
        userId: ctx.user.id,
        bookingId: synced.id,
        status: synced.status,
        title: `Boeking bevestigd voor ${synced.clientName}`,
        source: "booking.confirm",
      });
      return synced;
    }),

  reject: protectedProcedure
    .input(z.object({
      id: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const booking = await ctx.db.booking.findFirst({ where: { id: input.id, createdById: ctx.user.id } });
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Boeking niet gevonden" });
      if (booking.status === "COMPLETED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Kan een voltooide boeking niet afwijzen",
        });
      }

      const updated = await ctx.db.booking.update({
        where: { id: input.id },
        data: {
          status: "REJECTED",
          notes: input.reason
            ? `${booking.notes ? booking.notes + "\n" : ""}Afwijzingsreden: ${input.reason}`
            : booking.notes,
        },
      });
      const emailCfg = await loadEmailSettings(ctx.db, ctx.user.id);
      const companyName = emailCfg.companyName || emailCfg.fromName || "Digitify";
      const adminRecipient = emailCfg.fromEmail || emailCfg.smtpUser || "";
      const synced = await syncBookingCalendarEvent(ctx.db, updated, companyName, ctx.user.id);
      await sendBookingChangeEmails({
        db: ctx.db,
        booking: synced,
        companyName,
        adminRecipient,
        customerSubject: `Update over uw booking aanvraag`,
        customerIntro: `Uw booking aanvraag bij ${companyName} kon momenteel niet bevestigd worden.${input.reason ? ` Reden: ${input.reason}` : ""}`,
        adminSubject: `Booking afgewezen: ${synced.clientName}`,
        adminIntro: "Een booking werd afgewezen.",
        userId: ctx.user.id,
      });
      await logBookingActivity({
        db: ctx.db,
        leadId: synced.leadId,
        userId: ctx.user.id,
        bookingId: synced.id,
        status: synced.status,
        title: `Boeking afgewezen voor ${synced.clientName}`,
        source: "booking.reject",
      });
      return synced;
    }),

  getTimeline: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const booking = await ctx.db.booking.findFirst({
        where: { id: input.id, createdById: ctx.user.id },
        include: {
          lead: { select: { id: true, companyName: true } },
        },
      });
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Boeking niet gevonden" });

      const activityFilters: Array<Record<string, unknown>> = [
        { metadata: { path: ["bookingId"], equals: booking.id } },
      ];
      if (booking.leadId) activityFilters.push({ leadId: booking.leadId });

      const activities = await ctx.db.activity.findMany({
        where: {
          OR: activityFilters,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          lead: { select: { id: true, companyName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      });

      type TimelineEntry = {
        id: string;
        type: string;
        title: string;
        createdAt: Date;
        user: { id: string; name: string | null; email?: string | null } | null;
      };

      const filteredActivities = activities.filter((activity) => {
        const metadata = (activity.metadata ?? {}) as Record<string, unknown>;
        const bookingId = typeof metadata.bookingId === "string" ? metadata.bookingId : null;
        return bookingId === booking.id;
      }) as TimelineEntry[];

      const systemEvents: TimelineEntry[] = [
        {
          id: `booking-created-${booking.id}`,
          type: "BOOKING_CREATED",
          title: `Boeking aangemaakt voor ${booking.clientName}`,
          createdAt: booking.createdAt,
          user: null,
        },
      ];
      if (booking.updatedAt.getTime() !== booking.createdAt.getTime()) {
        systemEvents.push({
          id: `booking-updated-${booking.id}`,
          type: "BOOKING_UPDATED",
          title: "Laatste wijziging opgeslagen",
          createdAt: booking.updatedAt,
          user: null,
        });
      }

      return [...filteredActivities, ...systemEvents].sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.booking.findFirst({ where: { id: input.id, createdById: ctx.user.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Boeking niet gevonden" });
      const deleted = await ctx.db.booking.delete({ where: { id: input.id } });
      await logBookingActivity({
        db: ctx.db,
        leadId: existing.leadId,
        userId: ctx.user.id,
        bookingId: existing.id,
        status: existing.status,
        title: `Boeking verwijderd voor ${existing.clientName}`,
        source: "booking.delete",
      }).catch(() => null);
      return deleted;
    }),
});
