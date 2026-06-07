import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, ownerProcedure, mutationProcedure } from "../trpc";
import { type PrismaClient } from "@digitify/db";
import { loadEmailSettings } from "../lib/email-sender";
import { sendTemplatedEmail } from "../lib/send-templated-email";
import { assertLeadAccess } from "../lib/tenant";
import { log } from "../lib/logger";
import {
  deleteGoogleBookingEvent,
  isGoogleSlotAvailable,
  listGoogleCalendarEvents,
  upsertGoogleBookingEvent,
} from "../lib/google-calendar";
import {
  buildIcsAttachment,
  createPublicToken,
  DEFAULT_BOOKING_TIMEZONE,
  applyWorkspaceEmbedSettingsToEventType,
  ensureDefaultBookingEventType,
  getStoredGoogleEventId,
  hashPublicToken,
  hasBookingOverlap,
  normalizeSlug,
  removeLegacyGoogleEventId,
  syncHostTimezoneForWorkspace,
} from "../lib/booking-utils";
import { fireBookingWebhook } from "../lib/booking-webhooks";

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

const BOOKING_SYNC_RETRY_DELAY_MS = 5 * 60 * 1000;

function normalizeSyncError(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 400);
  return String(error || "Onbekende syncfout").slice(0, 400);
}

function resolveAppUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
  ];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed) continue;
    try {
      return new URL(trimmed).toString().replace(/\/$/, "");
    } catch {
      continue;
    }
  }
  return "http://localhost:3000";
}

function bookingToWebhookPayload(booking: Record<string, unknown>): Record<string, unknown> {
  // Serialize only safe, non-circular fields for webhook delivery
  return {
    id: booking.id,
    status: booking.status,
    clientName: booking.clientName,
    clientEmail: booking.clientEmail,
    date: booking.date instanceof Date ? booking.date.toISOString() : booking.date,
    duration: booking.duration,
    timezone: booking.timezone,
    location: booking.location,
    notes: booking.notes,
    eventTypeId: booking.eventTypeId,
    hostUserId: booking.hostUserId,
    leadId: booking.leadId,
    createdById: booking.createdById,
    createdAt: booking.createdAt instanceof Date ? booking.createdAt.toISOString() : booking.createdAt,
    updatedAt: booking.updatedAt instanceof Date ? booking.updatedAt.toISOString() : booking.updatedAt,
    googleMeetLink: booking.googleMeetLink,
    googleHtmlLink: booking.googleHtmlLink,
  };
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
    googleEventId?: string | null;
    googleHtmlLink?: string | null;
    googleMeetLink?: string | null;
    googleSyncState?: string | null;
    googleSyncError?: string | null;
    googleSyncLastAttemptAt?: Date | null;
    googleSyncRetryAt?: Date | null;
    location?: string | null;
    status: string;
    leadId?: string | null;
    hostUserId?: string | null;
  },
  companyName: string,
  userId?: string
) {
  const existingEventId = getStoredGoogleEventId(booking);
  const shouldDelete = booking.status === "REJECTED" || booking.status === "CANCELLED";
  const attemptedAt = new Date();
  try {
    if (shouldDelete) {
      if (!existingEventId) {
        return db.booking.update({
          where: { id: booking.id },
          data: {
            googleSyncState: "SYNCED",
            googleSyncError: null,
            googleSyncLastAttemptAt: attemptedAt,
            googleSyncRetryAt: null,
          },
        });
      }
      await deleteGoogleBookingEvent(db, existingEventId, userId);
      return db.booking.update({
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
    }

    const event = await upsertGoogleBookingEvent(db, {
      start: booking.date,
      bookingId: booking.id,
      end: getBookingEndDate(booking),
      summary: `Afspraak met ${booking.clientName}`,
      description: [
        `Booking status: ${booking.status}`,
        `Klant: ${booking.clientName}`,
        `E-mail: ${booking.clientEmail || "-"}`,
        `Notities: ${booking.notes || "-"}`,
        `Bedrijf: ${companyName}`,
      ].filter(Boolean).join("\n"),
      attendeeEmail: booking.clientEmail || undefined,
      location: booking.location || undefined,
      existingEventId,
      userId,
    });
    if (!event.synced || !event.eventId) {
      return db.booking.update({
        where: { id: booking.id },
        data: {
          googleSyncState: "DISABLED",
          googleSyncError: null,
          googleSyncLastAttemptAt: attemptedAt,
          googleSyncRetryAt: null,
        },
      });
    }

    return db.booking.update({
      where: { id: booking.id },
      data: {
        googleEventId: event.eventId,
        googleHtmlLink: event.htmlLink || booking.googleHtmlLink || null,
        googleMeetLink: event.meetLink || booking.googleMeetLink || null,
        notes: removeLegacyGoogleEventId(booking.notes),
        googleSyncState: "SYNCED",
        googleSyncError: null,
        googleSyncLastAttemptAt: attemptedAt,
        googleSyncRetryAt: null,
      },
    });
  } catch (error) {
    const syncError = normalizeSyncError(error);
    const retryAt = new Date(attemptedAt.getTime() + BOOKING_SYNC_RETRY_DELAY_MS);
    log.integration.error(
      "Booking Google sync failed",
      { bookingId: booking.id, userId, status: booking.status, existingEventId },
      error,
    );
    return db.booking.update({
      where: { id: booking.id },
      data: {
        googleSyncState: "RETRYING",
        googleSyncError: syncError,
        googleSyncLastAttemptAt: attemptedAt,
        googleSyncRetryAt: retryAt,
      },
    });
  }
}

function buildBookingDetailsBlock(booking: {
  date: Date;
  duration: number;
  notes: string | null;
  status: string;
  location?: string | null;
  googleMeetLink?: string | null;
  googleHtmlLink?: string | null;
}) {
  return [
    `Datum: ${formatBookingDate(booking.date)}`,
    `Duur: ${booking.duration} minuten`,
    `Status: ${booking.status}`,
    booking.location ? `Locatie: ${booking.location}` : "",
    booking.googleMeetLink ? `Google Meet: ${booking.googleMeetLink}` : "",
    booking.googleHtmlLink ? `Agenda event: ${booking.googleHtmlLink}` : "",
    `Notities: ${booking.notes || "Geen notities."}`,
  ].filter(Boolean).join("\n");
}

async function sendBookingChangeEmails(params: {
  db: PrismaClient;
  workspaceId: string;
  booking: {
    clientName: string;
    clientEmail: string | null;
    date: Date;
    duration: number;
    notes: string | null;
    status: string;
    id?: string;
    location?: string | null;
    googleMeetLink?: string | null;
    googleHtmlLink?: string | null;
  };
  companyName: string;
  adminRecipient: string;
  customerTemplateKey: string;
  adminSubject: string;
  adminIntro: string;
  rejectionReason?: string;
  manageUrl?: string;
  userId?: string;
}) {
  const { booking, companyName, adminRecipient } = params;
  const bookingDetails = buildBookingDetailsBlock(booking);
  const placeholderContext = {
    contactName: booking.clientName,
    senderCompany: companyName,
    bookingDetails,
    clientEmail: booking.clientEmail || "-",
    rejectionReason: params.rejectionReason ? ` Reden: ${params.rejectionReason}` : "",
    manageUrl: params.manageUrl || "",
    adminSubject: params.adminSubject,
    adminIntro: params.adminIntro,
  };

  const emailTasks: Promise<{ success: boolean; messageId?: string; error?: string }>[] = [];
  if (booking.clientEmail) {
    const attachments = booking.id
      ? [
          buildIcsAttachment({
            bookingId: booking.id,
            method: booking.status === "CANCELLED" || booking.status === "REJECTED" ? "CANCEL" : "REQUEST",
            start: booking.date,
            end: getBookingEndDate(booking),
            summary: `Afspraak met ${booking.clientName}`,
            description: booking.notes || undefined,
            location: booking.googleMeetLink || booking.location || undefined,
            organizerEmail: adminRecipient || undefined,
            attendeeEmail: booking.clientEmail,
          }),
        ]
      : undefined;
    emailTasks.push(
      sendTemplatedEmail(params.db, params.workspaceId, {
        templateKey: params.customerTemplateKey,
        toEmail: booking.clientEmail,
        placeholderContext,
        recipientCompany: booking.clientName,
        attachments,
        userId: params.userId,
      }),
    );
  }
  if (adminRecipient) {
    emailTasks.push(
      sendTemplatedEmail(params.db, params.workspaceId, {
        templateKey: "booking.admin_notify",
        toEmail: adminRecipient,
        placeholderContext,
        recipientCompany: companyName,
        userId: params.userId,
      }),
    );
  }
  const results = await Promise.allSettled(emailTasks);
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      if (!result.value.success) {
        log.email.error("Booking notification email failed", {
          userId: params.userId,
          channel: index === 0 ? "customer" : "admin",
          status: "failed",
          error: result.value.error || "unknown",
        });
      }
      return;
    }
    log.email.error("Booking notification email rejected", {
      userId: params.userId,
      channel: index === 0 ? "customer" : "admin",
    }, result.reason);
  });
}

export const bookingRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        status: bookingStatusEnum.optional(),
        search: z.string().optional(),
        eventTypeId: z.string().optional(),
        hostUserId: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(25),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { status, search, eventTypeId, hostUserId, dateFrom, dateTo, page = 1, pageSize = 25 } = input ?? {};
      const where: Record<string, unknown> = { createdById: ctx.user.workspaceId! };
      if (status) where.status = status;
      if (eventTypeId) where.eventTypeId = eventTypeId;
      if (hostUserId) where.hostUserId = hostUserId;
      if (dateFrom || dateTo) {
        where.date = {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo ? { lte: new Date(dateTo) } : {}),
        };
      }
      if (search?.trim()) {
        const q = search.trim();
        where.OR = [
          { clientName: { contains: q, mode: "insensitive" } },
          { clientEmail: { contains: q, mode: "insensitive" } },
          { notes: { contains: q, mode: "insensitive" } },
        ];
      }

      const [bookings, total] = await Promise.all([
        ctx.db.booking.findMany({
          where,
          orderBy: { date: "asc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            lead: { select: { id: true, companyName: true } },
            hostUser: { select: { id: true, name: true, email: true } },
            eventType: { select: { id: true, name: true, slug: true, color: true } },
            questionAnswers: true,
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
        where: { id: input.id, createdById: ctx.user.workspaceId! },
        include: {
          lead: { select: { id: true, companyName: true, email: true, phone: true } },
          hostUser: { select: { id: true, name: true, email: true } },
          eventType: { include: { questions: { orderBy: { sortOrder: "asc" } } } },
          questionAnswers: true,
        },
      });
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Boeking niet gevonden" });
      return booking;
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [total, pending, scheduled, confirmed, completed, cancelled, rejected, noShow] = await Promise.all([
      ctx.db.booking.count({ where: { createdById: ctx.user.workspaceId! } }),
      ctx.db.booking.count({ where: { status: "PENDING", createdById: ctx.user.workspaceId! } }),
      ctx.db.booking.count({ where: { status: "SCHEDULED", createdById: ctx.user.workspaceId! } }),
      ctx.db.booking.count({ where: { status: "CONFIRMED", createdById: ctx.user.workspaceId! } }),
      ctx.db.booking.count({ where: { status: "COMPLETED", createdById: ctx.user.workspaceId! } }),
      ctx.db.booking.count({ where: { status: "CANCELLED", createdById: ctx.user.workspaceId! } }),
      ctx.db.booking.count({ where: { status: "REJECTED", createdById: ctx.user.workspaceId! } }),
      ctx.db.booking.count({ where: { status: "NO_SHOW", createdById: ctx.user.workspaceId! } }),
    ]);
    return { total, pending, scheduled, confirmed, completed, cancelled, rejected, noShow };
  }),

  create: mutationProcedure
    .input(
      z.object({
        clientName: z.string().min(1),
        clientEmail: z.union([z.string().email(), z.literal(""), z.undefined()]),
        date: z.string().min(1, "Datum is verplicht").or(z.date()),
        duration: z.number().min(15).default(60),
        notes: z.string().optional(),
        leadId: z.string().optional(),
        eventTypeId: z.string().optional(),
        hostUserId: z.string().optional(),
        location: z.string().optional(),
        timezone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bookingDate = new Date(input.date);
      if (input.leadId) await assertLeadAccess(ctx.db, ctx.user.workspaceId!, input.leadId);
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
      const eventType = input.eventTypeId
        ? await ctx.db.bookingEventType.findFirst({ where: { id: input.eventTypeId, createdById: ctx.user.workspaceId! } })
        : await ensureDefaultBookingEventType(ctx.db, ctx.user.workspaceId!);
      if (input.eventTypeId && !eventType) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bookingtype niet gevonden" });
      }
      const hostUserId = input.hostUserId || ctx.user.id;
      const localOverlap = await hasBookingOverlap(ctx.db, {
        ownerUserId: ctx.user.workspaceId!,
        hostUserId,
        start: new Date(bookingDate.getTime() - (eventType?.bufferBefore || 0) * 60_000),
        end: new Date(bookingEnd.getTime() + (eventType?.bufferAfter || 0) * 60_000),
      });
      if (localOverlap) {
        throw new TRPCError({ code: "CONFLICT", message: "Dit tijdslot overlapt met een bestaande booking." });
      }
      const googleSlot = await isGoogleSlotAvailable(ctx.db as any, {
        start: bookingDate,
        end: bookingEnd,
        userId: hostUserId,
      });
      if (googleSlot.enabled && !googleSlot.available) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Dit tijdslot is bezet in de gekoppelde Google agenda.",
        });
      }

      const cancelToken = createPublicToken();
      const rescheduleToken = createPublicToken();
      const created = await ctx.db.booking.create({
        data: {
          clientName: input.clientName,
          clientEmail: input.clientEmail || null,
          date: bookingDate,
          duration: input.duration,
          notes: input.notes || null,
          timezone: input.timezone || eventType?.timezone || DEFAULT_BOOKING_TIMEZONE,
          location: input.location || eventType?.location || null,
          eventTypeId: eventType?.id || null,
          hostUserId,
          cancelTokenHash: hashPublicToken(cancelToken),
          rescheduleTokenHash: hashPublicToken(rescheduleToken),
          leadId: input.leadId || null,
          createdById: ctx.user.workspaceId!,
        },
      });
      const emailCfg = await loadEmailSettings(ctx.db, {
        workspaceId: ctx.user.workspaceId!,
        memberId: ctx.user.id,
      });
      const companyName = emailCfg.companyName || emailCfg.fromName || "Digitify";
      const booking = await syncBookingCalendarEvent(ctx.db, created, companyName, hostUserId);

      await logBookingActivity({
        db: ctx.db,
        leadId: booking.leadId,
        userId: ctx.user.id,
        bookingId: booking.id,
        status: booking.status,
        title: `Boeking aangemaakt voor ${booking.clientName}`,
        source: "booking.create",
      });
      fireBookingWebhook(ctx.db, ctx.user.id, "booking.created", bookingToWebhookPayload(booking as Record<string, unknown>)).catch(() => null);

      const adminRecipient = emailCfg.fromEmail || emailCfg.smtpUser;
      const manageUrl = `${resolveAppUrl()}/bookings/manage/${encodeURIComponent(rescheduleToken)}`;
      const bookingDetails = buildBookingDetailsBlock(booking);
      const placeholderContext = {
        contactName: booking.clientName,
        senderCompany: companyName,
        bookingDetails,
        clientEmail: booking.clientEmail || "-",
        manageUrl,
        adminSubject: `Nieuwe booking: ${booking.clientName}`,
        adminIntro: "Er werd een booking aangemaakt in de app.",
      };
      const emailTasks: Promise<{ success: boolean; messageId?: string; error?: string }>[] = [];
      if (booking.clientEmail) {
        emailTasks.push(
          sendTemplatedEmail(ctx.db, ctx.user.workspaceId!, {
            templateKey: "booking.pending",
            toEmail: booking.clientEmail,
            placeholderContext,
            recipientCompany: booking.clientName,
            attachments: [
              buildIcsAttachment({
                bookingId: booking.id,
                method: "REQUEST",
                start: booking.date,
                end: getBookingEndDate(booking),
                summary: `Afspraak met ${booking.clientName}`,
                description: booking.notes || undefined,
                location: booking.googleMeetLink || booking.location || undefined,
                organizerEmail: adminRecipient || undefined,
                attendeeEmail: booking.clientEmail,
              }),
            ],
            userId: ctx.user.id,
          }),
        );
      }
      if (adminRecipient) {
        emailTasks.push(
          sendTemplatedEmail(ctx.db, ctx.user.workspaceId!, {
            templateKey: "booking.admin_notify",
            toEmail: adminRecipient,
            placeholderContext,
            recipientCompany: companyName,
            userId: ctx.user.id,
          }),
        );
      }
      const results = await Promise.allSettled(emailTasks);
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          if (!result.value.success) {
            log.email.error("Booking create email failed", {
              userId: ctx.user.id,
              channel: index === 0 ? "customer" : "admin",
              bookingId: booking.id,
              error: result.value.error || "unknown",
            });
          }
          return;
        }
        log.email.error("Booking create email rejected", {
          userId: ctx.user.id,
          channel: index === 0 ? "customer" : "admin",
          bookingId: booking.id,
        }, result.reason);
      });

      return booking;
    }),

  update: mutationProcedure
    .input(
      z.object({
        id: z.string(),
        clientName: z.string().min(1).optional(),
        clientEmail: z.union([z.string().email(), z.literal(""), z.undefined()]),
        date: z.string().or(z.date()).optional(),
        duration: z.number().min(15).optional(),
        status: bookingStatusEnum.optional(),
        notes: z.string().optional(),
        location: z.string().optional(),
        timezone: z.string().optional(),
        hostUserId: z.string().optional(),
        eventTypeId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await ctx.db.booking.findFirst({ where: { id, createdById: ctx.user.workspaceId! } });
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
      if (data.location !== undefined) updateData.location = data.location || null;
      if (data.timezone !== undefined) updateData.timezone = data.timezone || DEFAULT_BOOKING_TIMEZONE;
      if (data.hostUserId !== undefined) updateData.hostUserId = data.hostUserId || ctx.user.id;
      if (data.eventTypeId !== undefined) {
        const eventType = data.eventTypeId
          ? await ctx.db.bookingEventType.findFirst({ where: { id: data.eventTypeId, createdById: ctx.user.workspaceId! } })
          : null;
        if (data.eventTypeId && !eventType) throw new TRPCError({ code: "NOT_FOUND", message: "Bookingtype niet gevonden" });
        updateData.eventTypeId = data.eventTypeId || null;
      }
      if (data.notes !== undefined) {
        updateData.notes = removeLegacyGoogleEventId(data.notes || null);
      }

      const nextDate = data.date !== undefined ? new Date(data.date) : existing.date;
      const nextDuration = data.duration !== undefined ? data.duration : existing.duration;
      const nextStatus = data.status !== undefined ? data.status : existing.status;
      const nextHostUserId = data.hostUserId !== undefined ? data.hostUserId || ctx.user.id : existing.hostUserId || ctx.user.id;
      const nextEventTypeId = data.eventTypeId !== undefined ? data.eventTypeId || null : existing.eventTypeId || null;
      const nextEventType = nextEventTypeId
        ? await ctx.db.bookingEventType.findFirst({ where: { id: nextEventTypeId, createdById: ctx.user.workspaceId! } })
        : null;
      const localOverlap = await hasBookingOverlap(ctx.db, {
        ownerUserId: ctx.user.workspaceId!,
        hostUserId: nextHostUserId,
        start: new Date(nextDate.getTime() - (nextEventType?.bufferBefore || 0) * 60_000),
        end: new Date(nextDate.getTime() + nextDuration * 60 * 1000 + (nextEventType?.bufferAfter || 0) * 60_000),
        ignoreBookingId: existing.id,
      });
      if (localOverlap && nextStatus !== "REJECTED" && nextStatus !== "CANCELLED") {
        throw new TRPCError({ code: "CONFLICT", message: "Dit tijdslot overlapt met een bestaande booking." });
      }
      const slotCheck = await isGoogleSlotAvailable(ctx.db as any, {
        start: nextDate,
        end: new Date(nextDate.getTime() + nextDuration * 60 * 1000),
        ignoreEventId: getStoredGoogleEventId(existing),
        userId: nextHostUserId,
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
      const emailCfg = await loadEmailSettings(ctx.db, {
        workspaceId: ctx.user.workspaceId!,
        memberId: ctx.user.id,
      });
      const companyName = emailCfg.companyName || emailCfg.fromName || "Digitify";
      const adminRecipient = emailCfg.fromEmail || emailCfg.smtpUser || "";
      const updated = await syncBookingCalendarEvent(ctx.db, updatedRow, companyName, updatedRow.hostUserId || ctx.user.id);
      await logBookingActivity({
        db: ctx.db,
        leadId: updated.leadId,
        userId: ctx.user.id,
        bookingId: updated.id,
        status: updated.status,
        title: `Boeking bijgewerkt voor ${updated.clientName}`,
        source: "booking.update",
      });
      const webhookUpdateEvent =
        updated.status === "CANCELLED" ? "booking.cancelled" :
        updated.status === "COMPLETED" ? "booking.completed" :
        "booking.updated";
      fireBookingWebhook(ctx.db, ctx.user.id, webhookUpdateEvent, bookingToWebhookPayload(updated as Record<string, unknown>)).catch(() => null);
      await sendBookingChangeEmails({
        db: ctx.db,
        workspaceId: ctx.user.workspaceId!,
        booking: updated,
        companyName,
        adminRecipient,
        customerTemplateKey: "booking.updated",
        adminSubject: `Booking aangepast: ${updated.clientName}`,
        adminIntro: "Een booking werd aangepast in de app.",
        userId: ctx.user.id,
      });
      return updated;
    }),

  confirm: mutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const booking = await ctx.db.booking.findFirst({ where: { id: input.id, createdById: ctx.user.workspaceId! } });
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
      const emailCfg = await loadEmailSettings(ctx.db, {
        workspaceId: ctx.user.workspaceId!,
        memberId: ctx.user.id,
      });
      const companyName = emailCfg.companyName || emailCfg.fromName || "Digitify";
      const adminRecipient = emailCfg.fromEmail || emailCfg.smtpUser || "";
      const synced = await syncBookingCalendarEvent(ctx.db, updated, companyName, updated.hostUserId || ctx.user.id);
      await sendBookingChangeEmails({
        db: ctx.db,
        workspaceId: ctx.user.workspaceId!,
        booking: synced,
        companyName,
        adminRecipient,
        customerTemplateKey: "booking.confirmed",
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
      fireBookingWebhook(ctx.db, ctx.user.id, "booking.confirmed", bookingToWebhookPayload(synced as Record<string, unknown>)).catch(() => null);
      return synced;
    }),

  reject: mutationProcedure
    .input(z.object({
      id: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const booking = await ctx.db.booking.findFirst({ where: { id: input.id, createdById: ctx.user.workspaceId! } });
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
      const emailCfg = await loadEmailSettings(ctx.db, {
        workspaceId: ctx.user.workspaceId!,
        memberId: ctx.user.id,
      });
      const companyName = emailCfg.companyName || emailCfg.fromName || "Digitify";
      const adminRecipient = emailCfg.fromEmail || emailCfg.smtpUser || "";
      const synced = await syncBookingCalendarEvent(ctx.db, updated, companyName, updated.hostUserId || ctx.user.id);
      await sendBookingChangeEmails({
        db: ctx.db,
        workspaceId: ctx.user.workspaceId!,
        booking: synced,
        companyName,
        adminRecipient,
        customerTemplateKey: "booking.cancelled",
        rejectionReason: input.reason,
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
      fireBookingWebhook(ctx.db, ctx.user.id, "booking.rejected", bookingToWebhookPayload(synced as Record<string, unknown>)).catch(() => null);
      return synced;
    }),

  getTimeline: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const booking = await ctx.db.booking.findFirst({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
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

  listEventTypes: protectedProcedure.query(async ({ ctx }) => {
    const defaults = await ensureDefaultBookingEventType(ctx.db, ctx.user.workspaceId!);
    const items = await ctx.db.bookingEventType.findMany({
      where: { createdById: ctx.user.workspaceId! },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      include: {
        availabilityRules: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
        questions: { orderBy: { sortOrder: "asc" } },
      },
    });
    return items.length ? items : [defaults];
  }),

  syncHostTimezone: ownerProcedure
    .input(z.object({ timezone: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return syncHostTimezoneForWorkspace(ctx.db, ctx.user.workspaceId!, input.timezone);
    }),

  syncEmbedFromSettings: mutationProcedure.mutation(async ({ ctx }) => {
      const eventTypeId = await applyWorkspaceEmbedSettingsToEventType(
        ctx.db,
        ctx.user.workspaceId!,
      );
    return { success: Boolean(eventTypeId) };
  }),

  getOpenClawAssistContext: protectedProcedure.query(async ({ ctx }) => {
    const { buildBookingOpenClawAssistContext } = await import("../lib/booking-openclaw-context");
    return buildBookingOpenClawAssistContext(ctx.db, ctx.user.workspaceId!);
  }),

  upsertEventType: mutationProcedure
    .input(z.object({
      id: z.string().optional(),
      slug: z.string().optional(),
      name: z.string().min(1),
      description: z.string().optional(),
      duration: z.number().min(5).max(480).default(60),
      slotMinutes: z.number().min(5).max(240).default(30),
      color: z.string().default("#f9ae5a"),
      location: z.string().optional(),
      meetingProvider: z.string().optional(),
      approvalMode: z.string().default("manual"),
      timezone: z.string().default(DEFAULT_BOOKING_TIMEZONE),
      bufferBefore: z.number().min(0).max(240).default(0),
      bufferAfter: z.number().min(0).max(240).default(0),
      minimumNoticeHours: z.number().min(0).max(720).default(4),
      maximumHorizonDays: z.number().min(1).max(365).default(60),
      privacyText: z.string().optional(),
      requireConsent: z.boolean().default(false),
      isActive: z.boolean().default(true),
      hostUserIds: z.array(z.string()).default([]),
      availabilityRules: z.array(z.object({
        weekday: z.number().min(0).max(6),
        enabled: z.boolean(),
        startTime: z.string(),
        endTime: z.string(),
        hostUserId: z.string().nullable().optional(),
      })).optional(),
      questions: z.array(z.object({
        id: z.string().optional(),
        label: z.string().min(1),
        type: z.enum(["text", "textarea", "email", "phone", "select", "checkbox"]).default("text"),
        required: z.boolean().default(false),
        options: z.array(z.string()).optional(),
        sortOrder: z.number().default(0),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const slug = normalizeSlug(input.slug || input.name);
      const hostUserIds = input.hostUserIds.length ? input.hostUserIds : [ctx.user.id];
      const data = {
        slug,
        name: input.name,
        description: input.description || null,
        duration: input.duration,
        slotMinutes: input.slotMinutes,
        color: input.color,
        location: input.location || null,
        meetingProvider: input.meetingProvider || "manual",
        approvalMode: input.approvalMode,
        timezone: input.timezone || DEFAULT_BOOKING_TIMEZONE,
        bufferBefore: input.bufferBefore,
        bufferAfter: input.bufferAfter,
        minimumNoticeHours: input.minimumNoticeHours,
        maximumHorizonDays: input.maximumHorizonDays,
        privacyText: input.privacyText || null,
        requireConsent: input.requireConsent,
        isActive: input.isActive,
        hostUserIds,
      };

      const existingEventType = input.id
        ? await ctx.db.bookingEventType.findFirst({ where: { id: input.id, createdById: ctx.user.workspaceId! } })
        : null;
      if (input.id && !existingEventType) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bookingtype niet gevonden" });
      }
      const eventType = existingEventType
        ? await ctx.db.bookingEventType.update({ where: { id: existingEventType.id }, data })
        : await ctx.db.bookingEventType.create({ data: { ...data, createdById: ctx.user.workspaceId!, isDefault: false } });

      if (input.availabilityRules) {
        await ctx.db.bookingAvailabilityRule.deleteMany({ where: { eventTypeId: eventType.id } });
        await ctx.db.bookingAvailabilityRule.createMany({
          data: input.availabilityRules.map((rule) => ({
            eventTypeId: eventType.id,
            weekday: rule.weekday,
            enabled: rule.enabled,
            startTime: rule.startTime,
            endTime: rule.endTime,
            hostUserId: rule.hostUserId || null,
          })),
        });
      }

      if (input.questions) {
        await ctx.db.bookingQuestion.deleteMany({ where: { eventTypeId: eventType.id } });
        await ctx.db.bookingQuestion.createMany({
          data: input.questions.map((question, index) => ({
            eventTypeId: eventType.id,
            label: question.label,
            type: question.type,
            required: question.required,
            options: question.options || undefined,
            sortOrder: question.sortOrder ?? index,
          })),
        });
      }

      return ctx.db.bookingEventType.findFirst({
        where: { id: eventType.id, createdById: ctx.user.workspaceId! },
        include: {
          availabilityRules: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
          questions: { orderBy: { sortOrder: "asc" } },
        },
      });
    }),

  deleteEventType: mutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const eventType = await ctx.db.bookingEventType.findFirst({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
      });
      if (!eventType) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bookingtype niet gevonden" });
      }
      if (eventType.isDefault) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Het standaard boekingstype kan niet verwijderd worden." });
      }
      // Soft-delete: set isActive to false, preserves booking history
      await ctx.db.bookingEventType.update({
        where: { id: input.id },
        data: { isActive: false },
      });
      return { success: true };
    }),

  getAnalyticsSummary: protectedProcedure
    .input(
      z
        .object({
          windowDays: z.union([z.literal(7), z.literal(14), z.literal(30), z.literal(90)]).default(30),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const days = input?.windowDays ?? 30;
      const now = Date.now();
      const since = new Date(now - days * 24 * 60 * 60 * 1000);
      const prevStart = new Date(now - 2 * days * 24 * 60 * 60 * 1000);

      const [analyticsEvents, bookingsInWindow, prevCount, confirmed, noShow] = await Promise.all([
        // Analytics events for conversion/confirmation rates
        ctx.db.bookingAnalyticsEvent.findMany({
          where: { createdById: ctx.user.workspaceId!, createdAt: { gte: since } },
          include: { eventType: { select: { id: true, name: true } } },
          take: 1000,
        }),
        // All bookings in current window (for grouping in JS)
        ctx.db.booking.findMany({
          where: { createdById: ctx.user.workspaceId!, createdAt: { gte: since } },
          select: {
            date: true,
            status: true,
            eventTypeId: true,
            duration: true,
            eventType: { select: { id: true, name: true } },
          },
        }),
        // Previous window count for trend
        ctx.db.booking.count({
          where: { createdById: ctx.user.workspaceId!, createdAt: { gte: prevStart, lt: since } },
        }),
        // Confirmed count in current window
        ctx.db.booking.count({
          where: { createdById: ctx.user.workspaceId!, status: "CONFIRMED", createdAt: { gte: since } },
        }),
        // No-show count in current window
        ctx.db.booking.count({
          where: { createdById: ctx.user.workspaceId!, status: "NO_SHOW", createdAt: { gte: since } },
        }),
      ]);

      // --- existing analytics event logic ---
      const byType = analyticsEvents.reduce<Record<string, number>>((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {});
      const submitSuccess = byType.submit_success || 0;
      const pageViews = byType.page_view || 0;
      const total = bookingsInWindow.length;

      // --- byDayOfWeek ---
      const DAY_LABELS = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"] as const;
      const dowCounts = new Array(7).fill(0) as number[];
      for (const b of bookingsInWindow) {
        if (b.date) {
          const d = new Date(b.date);
          dowCounts[d.getDay()]++;
        }
      }
      const byDayOfWeek = dowCounts.map((count, day) => ({
        day,
        label: DAY_LABELS[day],
        count,
      }));

      // --- byHour ---
      const hourCounts = new Map<number, number>();
      for (const b of bookingsInWindow) {
        if (b.date) {
          const hour = new Date(b.date).getHours();
          hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
        }
      }
      const byHour = Array.from(hourCounts.entries())
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour - b.hour);

      // --- byStatus ---
      const byStatus: Record<string, number> = {};
      for (const b of bookingsInWindow) {
        const s = b.status ?? "UNKNOWN";
        byStatus[s] = (byStatus[s] ?? 0) + 1;
      }

      // --- topEventTypes ---
      const etCounts = new Map<string, { id: string; name: string; count: number }>();
      for (const b of bookingsInWindow) {
        if (b.eventType) {
          const { id, name } = b.eventType;
          const existing = etCounts.get(id);
          if (existing) {
            existing.count++;
          } else {
            etCounts.set(id, { id, name, count: 1 });
          }
        }
      }
      const topEventTypes = Array.from(etCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // --- avgDurationMinutes ---
      const durationsWithValue = bookingsInWindow
        .map((b) => b.duration)
        .filter((d): d is number => typeof d === "number" && d > 0);
      const avgDurationMinutes =
        durationsWithValue.length > 0
          ? durationsWithValue.reduce((sum, d) => sum + d, 0) / durationsWithValue.length
          : 0;

      // --- trend ---
      const currentCount = total;
      const previousCount = prevCount;
      const changePercent =
        previousCount === 0
          ? currentCount > 0
            ? 100
            : 0
          : ((currentCount - previousCount) / previousCount) * 100;
      const trend = { current: currentCount, previous: previousCount, changePercent };

      return {
        windowDays: days,
        events: byType,
        conversionRate: pageViews ? submitSuccess / pageViews : 0,
        confirmationRate: total ? confirmed / total : 0,
        noShowRate: total ? noShow / total : 0,
        totalInWindow: total,
        byDayOfWeek,
        byHour,
        byStatus,
        topEventTypes,
        avgDurationMinutes,
        trend,
      };
    }),

  getAgenda: protectedProcedure
    .input(
      z
        .object({
          from: z.string().optional(),
          to: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId!;
      const now = new Date();
      const from = input?.from ? new Date(input.from) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const to = input?.to
        ? new Date(input.to)
        : new Date(from.getFullYear(), from.getMonth(), from.getDate() + 14, 23, 59, 59, 999);

      const [bookings, google] = await Promise.all([
        ctx.db.booking.findMany({
          where: {
            createdById: workspaceId,
            date: { gte: from, lte: to },
            status: { notIn: ["REJECTED", "CANCELLED"] },
          },
          orderBy: { date: "asc" },
          include: {
            eventType: { select: { id: true, name: true, color: true } },
            hostUser: { select: { id: true, name: true, email: true } },
          },
        }),
        listGoogleCalendarEvents(ctx.db as any, {
          timeMin: from,
          timeMax: to,
          userId: workspaceId,
        }),
      ]);

      const linkedGoogleIds = new Set(
        bookings
          .map((booking) => getStoredGoogleEventId(booking))
          .filter((value): value is string => Boolean(value))
      );

      return {
        from: from.toISOString(),
        to: to.toISOString(),
        googleEnabled: google.enabled,
        googleAccountEmail: google.accountEmail,
        googleCalendarId: google.calendarId,
        bookings,
        externalGoogleEvents: google.events.filter((event) => !linkedGoogleIds.has(event.id)),
      };
    }),

  testGoogleSync: mutationProcedure.mutation(async ({ ctx }) => {
    const workspaceId = ctx.user.workspaceId!;
    const now = new Date();
    const slot = await isGoogleSlotAvailable(ctx.db as any, {
      start: now,
      end: new Date(now.getTime() + 15 * 60_000),
      userId: workspaceId,
    });

    let upcomingGoogleEvents = 0;
    if (slot.enabled) {
      try {
        const listed = await listGoogleCalendarEvents(ctx.db as any, {
          timeMin: now,
          timeMax: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          userId: workspaceId,
        });
        upcomingGoogleEvents = listed.events.length;
      } catch {
        upcomingGoogleEvents = 0;
      }
    }

    return {
      enabled: slot.enabled,
      available: slot.available,
      upcomingGoogleEvents,
      checkedAt: new Date(),
    };
  }),

  delete: mutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.booking.findFirst({ where: { id: input.id, createdById: ctx.user.workspaceId! } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Boeking niet gevonden" });
      const eventId = getStoredGoogleEventId(existing);
      if (eventId) {
        await deleteGoogleBookingEvent(ctx.db, eventId, existing.hostUserId || ctx.user.id).catch((error) => {
          log.integration.error("Google event verwijderen bij booking delete mislukt", { bookingId: existing.id, eventId }, error);
        });
      }
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
