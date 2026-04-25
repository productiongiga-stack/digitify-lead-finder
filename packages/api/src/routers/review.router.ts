import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { replacePlaceholders } from "@digitify/email";
import { loadEmailSettings, sendBrandedEmail } from "../lib/email-sender";

const REVIEW_STATUSES = ["PENDING", "SENT", "OPENED", "REVIEWED", "FEEDBACK"] as const;
const reviewStatusEnum = z.enum(REVIEW_STATUSES);

function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

function getPlatformLabel(platform?: string | null) {
  const platformLabels: Record<string, string> = {
    google: "Google",
    trustpilot: "Trustpilot",
    facebook: "Facebook",
  };
  return platformLabels[platform || "google"] || "Google";
}

function getReviewGateUrl(id: string) {
  return `${getAppUrl()}/review/${id}`;
}

export const reviewRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        status: reviewStatusEnum.optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(25),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { status, page = 1, pageSize = 25 } = input ?? {};
      const where: Record<string, unknown> = {};
      if (status) where.status = status;

      const [reviews, total] = await Promise.all([
        ctx.db.reviewRequest.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            lead: { select: { id: true, companyName: true } },
          },
        }),
        ctx.db.reviewRequest.count({ where }),
      ]);

      return { reviews, total, page, pageSize };
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [total, pending, sent, opened, reviewed, feedback, ratingResult] = await Promise.all([
      ctx.db.reviewRequest.count(),
      ctx.db.reviewRequest.count({ where: { status: "PENDING" } }),
      ctx.db.reviewRequest.count({ where: { status: "SENT" } }),
      ctx.db.reviewRequest.count({ where: { status: "OPENED" } }),
      ctx.db.reviewRequest.count({ where: { status: "REVIEWED" } }),
      ctx.db.reviewRequest.count({ where: { status: "FEEDBACK" } }),
      ctx.db.reviewRequest.aggregate({
        _avg: { rating: true },
        where: { rating: { not: null } },
      }),
    ]);
    return {
      total,
      pending,
      sent,
      opened,
      reviewed,
      feedback,
      averageRating: ratingResult._avg.rating ? Math.round(ratingResult._avg.rating * 10) / 10 : null,
    };
  }),

  create: protectedProcedure
    .input(
      z.object({
        clientName: z.string().min(1),
        clientEmail: z.string().email(),
        leadId: z.string().optional(),
        platform: z.enum(["google", "trustpilot", "facebook"]).default("google"),
        reviewUrl: z.string().url().optional().or(z.literal("")),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.reviewRequest.create({
        data: {
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          leadId: input.leadId || null,
          platform: input.platform,
          reviewUrl: input.reviewUrl || null,
          createdById: ctx.user.id,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: reviewStatusEnum.optional(),
        rating: z.number().min(1).max(5).optional(),
        reviewUrl: z.string().url().optional(),
        feedback: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updateData: Record<string, unknown> = {};
      if (data.status !== undefined) {
        updateData.status = data.status;
        if (data.status === "SENT") updateData.sentAt = new Date();
        if (data.status === "REVIEWED" || data.status === "FEEDBACK") updateData.reviewedAt = new Date();
      }
      if (data.rating !== undefined) updateData.rating = data.rating;
      if (data.reviewUrl !== undefined) updateData.reviewUrl = data.reviewUrl;
      if (data.feedback !== undefined) {
        updateData.feedback = data.feedback || null;
        updateData.feedbackSubmittedAt = data.feedback ? new Date() : null;
      }

      return ctx.db.reviewRequest.update({ where: { id }, data: updateData });
    }),

  send: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const review = await ctx.db.reviewRequest.findUnique({
        where: { id: input.id },
        include: { lead: { select: { id: true, companyName: true } } },
      });
      if (!review) throw new TRPCError({ code: "NOT_FOUND", message: "Review request niet gevonden" });
      if (review.status === "SENT" || review.status === "REVIEWED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Review request is al verzonden" });
      }

      const cfg = await loadEmailSettings(ctx.db, ctx.user.id);
      const platformLabel = getPlatformLabel(review.platform);
      const reviewGateUrl = getReviewGateUrl(review.id);

      const bodyTemplate = [
        `Beste {{clientName}},`,
        ``,
        `Bedankt voor uw vertrouwen in {{senderCompany}}! We hopen dat u tevreden bent met onze samenwerking.`,
        ``,
        `Mag ik u vragen om eerst kort uw ervaring met ons te beoordelen?`,
        ``,
        `Als u 4 of 5 sterren geeft, sturen we u meteen door naar ${platformLabel}. Bij een lagere score kunnen we uw feedback intern oppakken en verbeteren.`,
      ].join("\n");

      const body = replacePlaceholders(bodyTemplate, {
        clientName: review.clientName,
        senderCompany: cfg.companyName,
      }, { removeMissing: true });

      const subject = `${review.clientName}, hoe was uw ervaring met ${cfg.companyName}?`;
      const result = await sendBrandedEmail(ctx.db, {
        toEmail: review.clientEmail,
        subject,
        body: `${body}\n\n[[CTA_TEXT=Geef uw beoordeling]]\n[[CTA_URL=${reviewGateUrl}]]`,
        recipientCompany: review.lead?.companyName ?? review.clientName,
        leadId: review.leadId || undefined,
        userId: ctx.user.id,
      });

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Review e-mail verzenden mislukt",
        });
      }

      // Update review request
      const updated = await ctx.db.reviewRequest.update({
        where: { id: input.id },
        data: { status: "SENT", sentAt: new Date() },
      });

      // Create activity record if linked to a lead
      if (review.leadId) {
        await ctx.db.activity.create({
          data: {
            leadId: review.leadId,
            userId: ctx.user.id,
            type: "EMAIL_SENT",
            title: `Review verzoek verzonden naar ${review.clientEmail} (${platformLabel})`,
          },
        });
      }

      return updated;
    }),

  bulkSend: protectedProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const reviews = await ctx.db.reviewRequest.findMany({
        where: { id: { in: input.ids } },
        include: { lead: { select: { id: true, companyName: true } } },
      });

      // Filter to only sendable reviews (PENDING status)
      const sendable = reviews.filter(
        (r) => r.status !== "SENT" && r.status !== "REVIEWED"
      );

      if (sendable.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Geen review requests gevonden die verzonden kunnen worden",
        });
      }

      const cfg = await loadEmailSettings(ctx.db, ctx.user.id);
      const results: { id: string; success: boolean; error?: string }[] = [];

      for (const review of sendable) {
        try {
          const platformLabel = getPlatformLabel(review.platform);
          const reviewGateUrl = getReviewGateUrl(review.id);

          const bodyTemplate = [
            `Beste {{clientName}},`,
            ``,
            `Bedankt voor uw vertrouwen in {{senderCompany}}! We hopen dat u tevreden bent met onze samenwerking.`,
            ``,
            `Mag ik u vragen om eerst kort uw ervaring met ons te beoordelen?`,
            ``,
            `Bij 4 of 5 sterren sturen we u meteen door naar ${platformLabel}. Bij een lagere score vragen we uw feedback intern op.`,
          ].join("\n");

          const body = replacePlaceholders(bodyTemplate, {
            clientName: review.clientName,
            senderCompany: cfg.companyName,
          }, { removeMissing: true });

          const subject = `${review.clientName}, hoe was uw ervaring met ${cfg.companyName}?`;
          const result = await sendBrandedEmail(ctx.db, {
            toEmail: review.clientEmail,
            subject,
            body: `${body}\n\n[[CTA_TEXT=Geef uw beoordeling]]\n[[CTA_URL=${reviewGateUrl}]]`,
            recipientCompany: review.lead?.companyName ?? review.clientName,
            leadId: review.leadId || undefined,
            userId: ctx.user.id,
          });

          if (result.success) {
            await ctx.db.reviewRequest.update({
              where: { id: review.id },
              data: { status: "SENT", sentAt: new Date() },
            });

            if (review.leadId) {
              await ctx.db.activity.create({
                data: {
                  leadId: review.leadId,
                  userId: ctx.user.id,
                  type: "EMAIL_SENT",
                  title: `Review verzoek verzonden naar ${review.clientEmail} (${platformLabel})`,
                },
              });
            }

            results.push({ id: review.id, success: true });
          } else {
            results.push({ id: review.id, success: false, error: result.error });
          }
        } catch (err: any) {
          results.push({ id: review.id, success: false, error: err.message });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      return {
        results,
        summary: {
          total: sendable.length,
          success: successCount,
          failed: failCount,
        },
      };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.reviewRequest.delete({ where: { id: input.id } });
    }),
});
