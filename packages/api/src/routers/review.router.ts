import { z } from "zod";
import { router, protectedProcedure, mutationProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { loadEmailSettings } from "../lib/email-sender";
import { sendTemplatedEmail } from "../lib/send-templated-email";
import { assertLeadAccess, resolveLeadOwnerId } from "../lib/tenant";

const REVIEW_STATUSES = ["PENDING", "SENDING", "SENT", "OPENED", "REVIEWED", "FEEDBACK"] as const;
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
      const leadOwnerId = await resolveLeadOwnerId(ctx.db, ctx.user.workspaceId!);
      const where: Record<string, unknown> = { createdById: leadOwnerId };
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
    const leadOwnerId = await resolveLeadOwnerId(ctx.db, ctx.user.workspaceId!);
    const [total, pending, sent, opened, reviewed, feedback, ratingResult] = await Promise.all([
      ctx.db.reviewRequest.count({ where: { createdById: leadOwnerId } }),
      ctx.db.reviewRequest.count({ where: { status: "PENDING", createdById: leadOwnerId } }),
      ctx.db.reviewRequest.count({ where: { status: "SENT", createdById: leadOwnerId } }),
      ctx.db.reviewRequest.count({ where: { status: "OPENED", createdById: leadOwnerId } }),
      ctx.db.reviewRequest.count({ where: { status: "REVIEWED", createdById: leadOwnerId } }),
      ctx.db.reviewRequest.count({ where: { status: "FEEDBACK", createdById: leadOwnerId } }),
      ctx.db.reviewRequest.aggregate({
        _avg: { rating: true },
        where: { rating: { not: null }, createdById: leadOwnerId },
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

  create: mutationProcedure
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
      if (input.leadId) await assertLeadAccess(ctx.db, ctx.user.workspaceId!, input.leadId);
      const leadOwnerId = await resolveLeadOwnerId(ctx.db, ctx.user.workspaceId!);
      return ctx.db.reviewRequest.create({
        data: {
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          leadId: input.leadId || null,
          platform: input.platform,
          reviewUrl: input.reviewUrl || null,
          createdById: leadOwnerId,
        },
      });
    }),

  update: mutationProcedure
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
      const leadOwnerId = await resolveLeadOwnerId(ctx.db, ctx.user.workspaceId!);
      const existing = await ctx.db.reviewRequest.findFirst({
        where: { id, createdById: leadOwnerId },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Review request niet gevonden" });
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

  send: mutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const leadOwnerId = await resolveLeadOwnerId(ctx.db, ctx.user.workspaceId!);
      const review = await ctx.db.reviewRequest.findFirst({
        where: { id: input.id, createdById: leadOwnerId },
        include: { lead: { select: { id: true, companyName: true } } },
      });
      if (!review) throw new TRPCError({ code: "NOT_FOUND", message: "Review request niet gevonden" });
      if (review.status === "SENDING" || review.status === "SENT" || review.status === "REVIEWED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Review request is al verzonden" });
      }

      // Claim before talking to SMTP so double clicks or two browser tabs
      // cannot send the same review request twice.
      const claimed = await ctx.db.reviewRequest.updateMany({
        where: { id: review.id, createdById: leadOwnerId, status: { in: ["PENDING", "OPENED"] } },
        data: { status: "SENDING" },
      });
      if (claimed.count !== 1) {
        throw new TRPCError({ code: "CONFLICT", message: "Deze review wordt al verwerkt. Vernieuw de pagina." });
      }

      const platformLabel = getPlatformLabel(review.platform);
      let result: Awaited<ReturnType<typeof sendTemplatedEmail>>;
      try {
        const cfg = await loadEmailSettings(ctx.db, {
          workspaceId: ctx.user.workspaceId!,
          memberId: ctx.user.id,
        });
        const reviewGateUrl = getReviewGateUrl(review.id);
        const reviewBody = [
          `Bedankt voor uw vertrouwen in ${cfg.companyName}! We hopen dat u tevreden bent met onze samenwerking.`,
          ``,
          `Mag ik u vragen om eerst kort uw ervaring met ons te beoordelen?`,
          ``,
          `Als u 4 of 5 sterren geeft, sturen we u meteen door naar ${platformLabel}. Bij een lagere score kunnen we uw feedback intern oppakken en verbeteren.`,
        ].join("\n");
        result = await sendTemplatedEmail(ctx.db, ctx.user.workspaceId!, {
          templateKey: "review.request",
          toEmail: review.clientEmail,
          subjectOverride: `${review.clientName}, hoe was uw ervaring met ${cfg.companyName}?`,
          placeholderContext: {
            contactName: review.clientName,
            senderCompany: cfg.companyName,
            reviewBody,
            reviewLink: reviewGateUrl,
          },
          recipientCompany: review.lead?.companyName ?? review.clientName,
          leadId: review.leadId || undefined,
          userId: { workspaceId: ctx.user.workspaceId!, memberId: ctx.user.id },
        });
      } catch (error) {
        await ctx.db.reviewRequest.updateMany({ where: { id: review.id, createdById: leadOwnerId, status: "SENDING" }, data: { status: "PENDING" } });
        throw error;
      }

      if (!result.success) {
        await ctx.db.reviewRequest.updateMany({ where: { id: review.id, createdById: leadOwnerId, status: "SENDING" }, data: { status: "PENDING" } });
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
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
        }).catch(() => null);
      }

      return updated;
    }),

  bulkSend: mutationProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const leadOwnerId = await resolveLeadOwnerId(ctx.db, ctx.user.workspaceId!);
      const reviews = await ctx.db.reviewRequest.findMany({
        where: { id: { in: input.ids }, createdById: leadOwnerId },
        include: { lead: { select: { id: true, companyName: true } } },
      });

      // Filter to only sendable reviews (PENDING status)
      const sendable = reviews.filter((r) => r.status === "PENDING" || r.status === "OPENED");

      if (sendable.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Geen review requests gevonden die verzonden kunnen worden",
        });
      }

      const cfg = await loadEmailSettings(ctx.db, {
        workspaceId: ctx.user.workspaceId!,
        memberId: ctx.user.id,
      });
      const results: { id: string; success: boolean; error?: string }[] = [];

      for (const review of sendable) {
        const claimed = await ctx.db.reviewRequest.updateMany({
          where: { id: review.id, createdById: leadOwnerId, status: { in: ["PENDING", "OPENED"] } },
          data: { status: "SENDING" },
        });
        if (claimed.count !== 1) {
          results.push({ id: review.id, success: false, error: "Deze review wordt al verwerkt." });
          continue;
        }
        try {
          const platformLabel = getPlatformLabel(review.platform);
          const reviewGateUrl = getReviewGateUrl(review.id);

          const reviewBody = [
            `Bedankt voor uw vertrouwen in ${cfg.companyName}! We hopen dat u tevreden bent met onze samenwerking.`,
            ``,
            `Mag ik u vragen om eerst kort uw ervaring met ons te beoordelen?`,
            ``,
            `Bij 4 of 5 sterren sturen we u meteen door naar ${platformLabel}. Bij een lagere score vragen we uw feedback intern op.`,
          ].join("\n");

          const result = await sendTemplatedEmail(ctx.db, ctx.user.workspaceId!, {
            templateKey: "review.request",
            toEmail: review.clientEmail,
            subjectOverride: `${review.clientName}, hoe was uw ervaring met ${cfg.companyName}?`,
            placeholderContext: {
              contactName: review.clientName,
              senderCompany: cfg.companyName,
              reviewBody,
              reviewLink: reviewGateUrl,
            },
            recipientCompany: review.lead?.companyName ?? review.clientName,
            leadId: review.leadId || undefined,
            userId: { workspaceId: ctx.user.workspaceId!, memberId: ctx.user.id },
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
              }).catch(() => null);
            }

            results.push({ id: review.id, success: true });
          } else {
            await ctx.db.reviewRequest.updateMany({ where: { id: review.id, createdById: leadOwnerId, status: "SENDING" }, data: { status: "PENDING" } });
            results.push({ id: review.id, success: false, error: result.error });
          }
        } catch (err: any) {
          await ctx.db.reviewRequest.updateMany({ where: { id: review.id, createdById: leadOwnerId, status: "SENDING" }, data: { status: "PENDING" } });
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

  delete: mutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const leadOwnerId = await resolveLeadOwnerId(ctx.db, ctx.user.workspaceId!);
      const existing = await ctx.db.reviewRequest.findFirst({
        where: { id: input.id, createdById: leadOwnerId },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Review request niet gevonden" });
      return ctx.db.reviewRequest.delete({ where: { id: input.id } });
    }),
});
