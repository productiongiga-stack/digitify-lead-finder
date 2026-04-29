import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { sendBrandedEmail } from "../lib/email-sender";
import { getSettingString } from "../lib/settings";
import { loadUserSettingRows } from "../lib/user-settings";
import { assertLeadAccess } from "../lib/tenant";

const DEFAULT_TEMPLATE_PACK: Array<{
  name: string;
  subject: string;
  body: string;
  isGlobal: boolean;
}> = [
  {
    name: "Lead Contact - Eerste bericht",
    subject: "Korte intro voor {{companyName}}",
    body: [
      "Beste {{contactName}},",
      "",
      "Ik zag dat {{companyName}} actief is in {{industry}} en ik wou kort contact opnemen.",
      "We helpen bedrijven zoals het uwe met gerichte verbeteringen in zichtbaarheid en conversie.",
      "",
      "Is een korte kennismaking deze week haalbaar?",
      "",
      "Vriendelijke groeten,",
      "{{senderName}}",
      "",
      "[[LAYOUT=modern]]",
    ].join("\n"),
    isGlobal: true,
  },
  {
    name: "Follow-up - Opvolging",
    subject: "Even opvolgen op mijn bericht",
    body: [
      "Beste {{contactName}},",
      "",
      "Ik volg kort op mijn vorige bericht.",
      "Past dit momenteel binnen jullie prioriteiten bij {{companyName}}?",
      "",
      "Ik licht het graag in 10 minuten toe.",
      "",
      "Vriendelijke groeten,",
      "{{senderName}}",
      "",
      "[[LAYOUT=followup]]",
    ].join("\n"),
    isGlobal: true,
  },
  {
    name: "Offerte - Samenvatting",
    subject: "Offerte {{quoteNumber}} voor {{companyName}}",
    body: [
      "Beste {{contactName}},",
      "",
      "Hierbij bezorgen we uw offerte met een duidelijke samenvatting.",
      "Totaalprijs: {{offerPrice}}",
      "",
      "Laat gerust weten welke onderdelen je eerst wil opstarten.",
      "",
      "Vriendelijke groeten,",
      "{{senderName}}",
      "",
      "[[LAYOUT=proposal]]",
    ].join("\n"),
    isGlobal: true,
  },
  {
    name: "Rapport - Persoonlijke analyse",
    subject: "Uw gepersonaliseerd opportuniteitenrapport",
    body: [
      "Beste {{contactName}},",
      "",
      "In bijlage/onderstaande link vindt u uw gepersonaliseerde rapport.",
      "Daarin tonen we de belangrijkste opportuniteiten voor {{companyName}} op basis van score, website en marktpositie.",
      "",
      "Ik bespreek de aanbevelingen graag samen in een kort gesprek.",
      "",
      "Vriendelijke groeten,",
      "{{senderName}}",
      "",
      "[[LAYOUT=business]]",
    ].join("\n"),
    isGlobal: true,
  },
  {
    name: "Booking - Bevestiging",
    subject: "Bevestiging van uw afspraak",
    body: [
      "Beste {{contactName}},",
      "",
      "Uw afspraak is ingepland en bevestigd.",
      "U ontvangt kort voor de afspraak nog een herinnering met praktische info.",
      "",
      "Tot binnenkort,",
      "{{senderName}}",
      "",
      "[[LAYOUT=business]]",
    ].join("\n"),
    isGlobal: true,
  },
  {
    name: "Review - Vriendelijke vraag",
    subject: "Korte feedbackvraag",
    body: [
      "Beste {{contactName}},",
      "",
      "Dankjewel voor de samenwerking.",
      "Heb je 1 minuut om je ervaring te delen? Dat helpt ons sterk om verder te verbeteren.",
      "",
      "Alvast bedankt!",
      "{{senderName}}",
      "",
      "[[LAYOUT=minimal]]",
    ].join("\n"),
    isGlobal: true,
  },
];

export const contactRouter = router({
  getTopbarStats: protectedProcedure.query(async ({ ctx }) => {
    const settings = await loadUserSettingRows(ctx.db, ctx.user.id, ["email.followup_days"]);
    const followupDays = Math.max(
      1,
      Number.parseInt(getSettingString(settings, "email.followup_days", "3"), 10) || 3,
    );
    const reminderThreshold = new Date(Date.now() - followupDays * 24 * 60 * 60 * 1000);

    const [pendingDrafts, followupLeads] = await Promise.all([
      ctx.db.emailDraft.count({
        where: { status: "PENDING_APPROVAL", lead: { createdById: ctx.user.id } },
      }),
      ctx.db.emailDraft.findMany({
        where: {
          status: "SENT",
          sentAt: { lte: reminderThreshold },
          lead: {
            createdById: ctx.user.id,
            status: { notIn: ["RESPONDED", "QUALIFIED", "WON", "LOST", "ARCHIVED"] },
          },
        },
        select: { leadId: true },
        distinct: ["leadId"],
        take: 30,
      }),
    ]);

    return {
      pendingDrafts,
      followUpCount: followupLeads.length,
    };
  }),

  listDrafts: protectedProcedure
    .input(
      z.object({
        status: z.string().optional(),
        leadId: z.string().optional(),
        search: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        lead: { createdById: ctx.user.id },
      };
      if (input.status) where.status = input.status;
      if (input.leadId) {
        await assertLeadAccess(ctx.db, ctx.user.id, input.leadId);
        where.leadId = input.leadId;
      }
      const search = input.search?.trim();
      if (search) {
        where.OR = [
          { subject: { contains: search, mode: "insensitive" } },
          { toEmail: { contains: search, mode: "insensitive" } },
          { lead: { companyName: { contains: search, mode: "insensitive" }, createdById: ctx.user.id } },
        ];
      }

      const [items, total] = await Promise.all([
        ctx.db.emailDraft.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          include: {
            lead: { select: { id: true, companyName: true } },
            author: { select: { id: true, name: true } },
            approver: { select: { id: true, name: true } },
          },
        }),
        ctx.db.emailDraft.count({ where }),
      ]);

      return { items, total, page: input.page, pageSize: input.pageSize, totalPages: Math.ceil(total / input.pageSize) };
    }),

  deleteDraft: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.emailDraft.findFirst({
        where: { id: input.id, lead: { createdById: ctx.user.id } },
        select: { id: true, leadId: true, subject: true },
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "E-mail niet gevonden." });

      await ctx.db.emailDraft.delete({ where: { id: draft.id } });
      await ctx.db.activity.create({
        data: {
          leadId: draft.leadId,
          userId: ctx.user.id,
          type: "LEAD_UPDATED",
          title: `Outbound e-mail verwijderd: ${draft.subject}`,
          metadata: { draftId: draft.id, source: "contact.deleteDraft" },
        },
      }).catch(() => null);

      return { success: true };
    }),

  bulkDeleteDrafts: protectedProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const drafts = await ctx.db.emailDraft.findMany({
        where: { id: { in: input.ids }, lead: { createdById: ctx.user.id } },
        select: { id: true },
      });
      const ids = drafts.map((draft) => draft.id);
      if (ids.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Geen e-mails gevonden." });
      const result = await ctx.db.emailDraft.deleteMany({ where: { id: { in: ids } } });
      return { success: true, deleted: result.count };
    }),

  bulkSendDrafts: protectedProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(25) }))
    .mutation(async ({ ctx, input }) => {
      const drafts = await ctx.db.emailDraft.findMany({
        where: {
          id: { in: input.ids },
          lead: { createdById: ctx.user.id },
          status: { in: ["APPROVED", "FAILED"] },
        },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      if (drafts.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selecteer minstens één goedgekeurde of mislukte e-mail.",
        });
      }

      const results: Array<{ id: string; success: boolean; error?: string }> = [];
      const caller = contactRouter.createCaller(ctx);
      for (const draft of drafts) {
        try {
          await caller.sendEmail({ id: draft.id });
          results.push({ id: draft.id, success: true });
        } catch (error) {
          results.push({
            id: draft.id,
            success: false,
            error: error instanceof Error ? error.message : "Verzenden mislukt",
          });
        }
      }

      return {
        success: true,
        sent: results.filter((item) => item.success).length,
        failed: results.filter((item) => !item.success).length,
        results,
      };
    }),

  getFollowUpQueue: protectedProcedure.query(async ({ ctx }) => {
    const settings = await loadUserSettingRows(ctx.db, ctx.user.id, ["email.followup_days"]);
    const followupDays = Math.max(
      1,
      Number.parseInt(getSettingString(settings, "email.followup_days", "3"), 10) || 3,
    );
    const reminderThreshold = new Date(Date.now() - followupDays * 24 * 60 * 60 * 1000);

    const drafts = await ctx.db.emailDraft.findMany({
      where: {
        status: "SENT",
        sentAt: { lte: reminderThreshold },
        lead: {
          createdById: ctx.user.id,
          status: { notIn: ["RESPONDED", "QUALIFIED", "WON", "LOST", "ARCHIVED"] },
        },
      },
      orderBy: { sentAt: "asc" },
      distinct: ["leadId"],
      take: 8,
      include: {
        lead: {
          select: {
            id: true,
            companyName: true,
            status: true,
            scorePriority: true,
            city: true,
          },
        },
      },
    });

    const items = drafts.flatMap((draft) => {
      if (!draft.lead) return [];
      const sentAt = draft.sentAt ?? draft.createdAt;
      const daysSinceSent = Math.max(
        0,
        Math.floor((Date.now() - new Date(sentAt).getTime()) / (1000 * 60 * 60 * 24)),
      );
      return [{
        id: draft.id,
        subject: draft.subject,
        toEmail: draft.toEmail,
        sentAt,
        daysSinceSent,
        recommendedAt: new Date(new Date(sentAt).getTime() + followupDays * 24 * 60 * 60 * 1000),
        lead: draft.lead,
      }];
    });

    return { followupDays, items };
  }),

  createDraft: protectedProcedure
    .input(
      z.object({
        leadId: z.string(),
        toEmail: z.string().email(),
        subject: z.string().min(1),
        body: z.string().min(1),
        templateId: z.string().optional(),
        type: z.enum(["LEAD_CONTACT", "QUOTE", "REPLY", "FOLLOW_UP", "REVIEW_REQUEST", "TRANSACTIONAL"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertLeadAccess(ctx.db, ctx.user.id, input.leadId);
      const draft = await ctx.db.emailDraft.create({
        data: {
          ...input,
          authorId: ctx.user.id,
          status: "DRAFT",
        },
      });

      await ctx.db.activity.create({
        data: {
          leadId: input.leadId,
          userId: ctx.user.id,
          type: "EMAIL_DRAFTED",
          title: "E-mail draft aangemaakt",
        },
      });

      return draft;
    }),

  updateDraft: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        subject: z.string().optional(),
        body: z.string().optional(),
        toEmail: z.string().email().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.emailDraft.findFirst({
        where: {
          id: input.id,
          lead: { createdById: ctx.user.id },
        },
        select: { id: true, status: true, authorId: true },
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      if (draft.authorId !== ctx.user.id && !["OWNER", "ADMIN"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Geen toegang om dit concept te bewerken." });
      }
      if (draft.status !== "DRAFT" && draft.status !== "REJECTED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Can only edit drafts or rejected emails" });
      }

      const { id, ...data } = input;
      return ctx.db.emailDraft.update({ where: { id }, data: { ...data, status: "DRAFT" } });
    }),

  submitForApproval: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.emailDraft.findFirst({
        where: {
          id: input.id,
          lead: { createdById: ctx.user.id },
        },
        select: { id: true, status: true, authorId: true },
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      if (draft.authorId !== ctx.user.id && !["OWNER", "ADMIN"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Geen toegang om dit concept in te dienen." });
      }
      if (draft.status !== "DRAFT") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only drafts can be submitted for approval" });
      }

      return ctx.db.emailDraft.update({
        where: { id: input.id },
        data: { status: "PENDING_APPROVAL" },
      });
    }),

  approve: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.emailDraft.findFirst({
        where: { id: input.id, lead: { createdById: ctx.user.id } },
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      if (draft.status !== "PENDING_APPROVAL") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only pending emails can be approved" });
      }

      const updated = await ctx.db.emailDraft.update({
        where: { id: input.id },
        data: {
          status: "APPROVED",
          approverId: ctx.user.id,
          approvedAt: new Date(),
        },
      });

      await ctx.db.activity.create({
        data: {
          leadId: draft.leadId,
          userId: ctx.user.id,
          type: "EMAIL_APPROVED",
          title: "E-mail goedgekeurd",
        },
      });

      return updated;
    }),

  reject: adminProcedure
    .input(z.object({ id: z.string(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.emailDraft.findFirst({
        where: { id: input.id, lead: { createdById: ctx.user.id } },
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      if (draft.status !== "PENDING_APPROVAL") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only pending emails can be rejected" });
      }

      return ctx.db.emailDraft.update({
        where: { id: input.id },
        data: {
          status: "REJECTED",
          approverId: ctx.user.id,
          rejectedAt: new Date(),
          rejectionNote: input.note,
        },
      });
    }),

  sendEmail: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.emailDraft.findFirst({
        where: {
          id: input.id,
          lead: { createdById: ctx.user.id },
        },
        include: { lead: { select: { id: true, companyName: true } } },
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      if (draft.status === "SENT") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Deze e-mail is al verzonden.",
        });
      }
      if (draft.status !== "APPROVED" && draft.status !== "FAILED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Alleen goedgekeurde of mislukte e-mails kunnen worden verzonden",
        });
      }

      await ctx.db.emailDraft.update({
        where: { id: input.id },
        data: { status: "SENDING" },
      });

      try {
        const followUpDays =
          Number.parseInt(
            getSettingString(
              await loadUserSettingRows(ctx.db, ctx.user.id, ["email.followup_days"]),
              "email.followup_days",
              "3",
            ),
            10,
          ) || 3;

        const result = await sendBrandedEmail(ctx.db, {
          toEmail: draft.toEmail,
          subject: draft.subject,
          body: draft.body,
          recipientCompany: draft.lead?.companyName ?? draft.toEmail,
          leadId: draft.leadId,
          userId: ctx.user.id,
          trackingDraftId: draft.id,
        });

        if (!result.success) {
          await ctx.db.emailDraft.update({
            where: { id: input.id },
            data: {
              status: "FAILED",
              rejectionNote: result.error || "E-mail verzenden mislukt",
            },
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error || "E-mail verzenden mislukt",
          });
        }

        // Update draft status
        const updated = await ctx.db.emailDraft.update({
          where: { id: input.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            messageId: result.messageId,
            rejectionNote: null,
          },
        });

        // Create activity record
        await ctx.db.activity.create({
          data: {
            leadId: draft.leadId,
            userId: ctx.user.id,
            type: "EMAIL_SENT",
            title: `E-mail verzonden naar ${draft.toEmail}`,
            metadata: { followUpDays },
          },
        });

        return updated;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        await ctx.db.emailDraft.update({
          where: { id: input.id },
          data: {
            status: "FAILED",
            rejectionNote: error instanceof Error ? error.message : "E-mail verzenden mislukt",
          },
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "E-mail verzenden mislukt",
        });
      }
    }),

  listTemplates: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.emailTemplate.findMany({
      where: { createdById: ctx.user.id },
      orderBy: { createdAt: "desc" },
      include: { campaign: { select: { id: true, name: true } } },
    });
  }),

  createTemplate: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        subject: z.string().min(1),
        body: z.string().min(1),
        campaignId: z.string().optional(),
        isGlobal: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.campaignId) {
        const campaign = await ctx.db.campaign.findFirst({
          where: { id: input.campaignId, createdById: ctx.user.id },
          select: { id: true },
        });
        if (!campaign) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campagne niet gevonden." });
        }
      }
      return ctx.db.emailTemplate.create({
        data: {
          ...input,
          createdById: ctx.user.id,
          isGlobal: false,
        },
      });
    }),

  seedDefaultTemplates: protectedProcedure.mutation(async ({ ctx }) => {
    const existing = await ctx.db.emailTemplate.findMany({
      where: {
        createdById: ctx.user.id,
        OR: DEFAULT_TEMPLATE_PACK.map((template) => ({ name: template.name })),
      },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((item) => item.name));
    const templatesToCreate = DEFAULT_TEMPLATE_PACK.filter(
      (template) => !existingNames.has(template.name)
    );
    if (templatesToCreate.length === 0) {
      return { created: 0, total: DEFAULT_TEMPLATE_PACK.length };
    }
    await ctx.db.emailTemplate.createMany({
      data: templatesToCreate.map((template) => ({
        createdById: ctx.user.id,
        name: template.name,
        subject: template.subject,
        body: template.body,
        isGlobal: false,
      })),
      skipDuplicates: true,
    });
    return { created: templatesToCreate.length, total: DEFAULT_TEMPLATE_PACK.length };
  }),

  updateTemplate: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        subject: z.string().min(1).optional(),
        body: z.string().min(1).optional(),
        campaignId: z.string().nullable().optional(),
        isGlobal: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const template = await ctx.db.emailTemplate.findFirst({
        where: { id, createdById: ctx.user.id },
        select: { id: true },
      });
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template niet gevonden." });
      }
      if (data.campaignId) {
        const campaign = await ctx.db.campaign.findFirst({
          where: { id: data.campaignId, createdById: ctx.user.id },
          select: { id: true },
        });
        if (!campaign) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campagne niet gevonden." });
        }
      }
      return ctx.db.emailTemplate.update({
        where: { id },
        data: {
          ...data,
          isGlobal: data.isGlobal ?? false,
        },
      });
    }),

  deleteTemplate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.emailTemplate.findFirst({
        where: { id: input.id, createdById: ctx.user.id },
        select: { id: true },
      });
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template niet gevonden." });
      }
      await ctx.db.emailTemplate.delete({ where: { id: input.id } });
      return { success: true };
    }),

  getDraftById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const draft = await ctx.db.emailDraft.findFirst({
        where: {
          id: input.id,
          lead: { createdById: ctx.user.id },
        },
        include: {
          lead: { select: { id: true, companyName: true, email: true, city: true, industry: true } },
          author: { select: { id: true, name: true } },
          template: true,
        },
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      return draft;
    }),
});
