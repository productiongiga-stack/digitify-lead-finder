import { z } from "zod";
import { router, protectedProcedure, adminProcedure, mutationProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { sendBrandedEmail } from "../lib/email-sender";
import { sendApprovedQuoteDraft } from "../lib/quote-outbound-email";
import { extractInvoiceIdFromDraftBody } from "../lib/invoice-outbound";
import { getSettingString } from "../lib/settings";
import { loadWorkspaceSettingRows, workspaceScopeFromUser } from "../lib/workspace-settings";
import { assertLeadAccess } from "../lib/tenant";
import {
  buildOutboundSourceModuleWhere,
  EMAIL_TYPE_VALUES,
  getOutboundSourceModule,
  normalizeLegacyScheduledDrafts,
  OUTBOUND_SOURCE_MODULES,
  RESCHEDULABLE_OUTBOUND_STATUSES,
} from "../lib/outbound-draft-meta";

function enrichDraftRow<
  T extends {
    sequenceId: string | null;
    type: string;
    status: string;
    scheduledFor: Date | null;
  },
>(draft: T) {
  return {
    ...draft,
    sourceModule: getOutboundSourceModule(draft),
    displayStatus: draft.status === "SCHEDULED" ? "DRAFT" : draft.status,
  };
}

export const contactRouter = router({
  getOutboundStats: protectedProcedure.query(async ({ ctx }) => {
    const workspaceId = ctx.user.workspaceId!;
    await normalizeLegacyScheduledDrafts(ctx.db, workspaceId);

    const buckets = await ctx.db.emailDraft.groupBy({
      by: ["status"],
      where: { lead: { createdById: workspaceId } },
      _count: { _all: true },
    });

    const byStatus = Object.fromEntries(
      buckets.map((row) => [row.status, row._count._all]),
    ) as Record<string, number>;

    const draft = (byStatus.DRAFT ?? 0) + (byStatus.SCHEDULED ?? 0);
    const pending = byStatus.PENDING_APPROVAL ?? 0;
    const approved = byStatus.APPROVED ?? 0;
    const sent = byStatus.SENT ?? 0;
    const failed = byStatus.FAILED ?? 0;
    const rejected = byStatus.REJECTED ?? 0;

    return {
      draft,
      pending,
      approved,
      sent,
      failed,
      rejected,
      total: buckets.reduce((sum, row) => sum + row._count._all, 0),
    };
  }),

  getTopbarStats: protectedProcedure.query(async ({ ctx }) => {
    const scope = workspaceScopeFromUser(ctx.user);
    const settings = await loadWorkspaceSettingRows(ctx.db, scope, ["email.followup_days"]);
    const followupDays = Math.max(
      1,
      Number.parseInt(getSettingString(settings, "email.followup_days", "3"), 10) || 3,
    );
    const reminderThreshold = new Date(Date.now() - followupDays * 24 * 60 * 60 * 1000);

    const [pendingDrafts, followupLeads] = await Promise.all([
      ctx.db.emailDraft.count({
        where: { status: "PENDING_APPROVAL", lead: { createdById: ctx.user.workspaceId! } },
      }),
      ctx.db.emailDraft.findMany({
        where: {
          status: "SENT",
          sentAt: { lte: reminderThreshold },
          lead: {
            createdById: ctx.user.workspaceId!,
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

  getOverview: protectedProcedure
    .input(
      z.object({
        status: z.string().optional(),
        leadId: z.string().optional(),
        search: z.string().optional(),
        type: z.enum(EMAIL_TYPE_VALUES).optional(),
        sourceModule: z.enum(OUTBOUND_SOURCE_MODULES).optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId!;
      await normalizeLegacyScheduledDrafts(ctx.db, workspaceId);

      const scope = workspaceScopeFromUser(ctx.user);
      const settings = await loadWorkspaceSettingRows(ctx.db, scope, ["email.followup_days"]);
      const followupDays = Math.max(
        1,
        Number.parseInt(getSettingString(settings, "email.followup_days", "3"), 10) || 3,
      );
      const reminderThreshold = new Date(Date.now() - followupDays * 24 * 60 * 60 * 1000);

      const where: Record<string, unknown> = {
        lead: { createdById: workspaceId },
      };
      if (input.status) {
        where.status = input.status === "DRAFT" ? { in: ["DRAFT", "SCHEDULED"] } : input.status;
      }
      if (input.type) where.type = input.type;
      if (input.sourceModule) {
        Object.assign(where, buildOutboundSourceModuleWhere(input.sourceModule));
      }
      if (input.leadId) {
        await assertLeadAccess(ctx.db, workspaceId, input.leadId);
        where.leadId = input.leadId;
      }
      const search = input.search?.trim();
      if (search) {
        where.OR = [
          { subject: { contains: search, mode: "insensitive" } },
          { toEmail: { contains: search, mode: "insensitive" } },
          { lead: { companyName: { contains: search, mode: "insensitive" }, createdById: workspaceId } },
        ];
      }

      const [draftRows, draftTotal, pendingDrafts, followupLeads, followUpDrafts] = await Promise.all([
        ctx.db.emailDraft.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          include: {
            lead: { select: { id: true, companyName: true } },
            author: { select: { id: true, name: true } },
            approver: { select: { id: true, name: true } },
            sequence: { select: { id: true, name: true } },
          },
        }),
        ctx.db.emailDraft.count({ where }),
        ctx.db.emailDraft.count({
          where: { status: "PENDING_APPROVAL", lead: { createdById: workspaceId } },
        }),
        ctx.db.emailDraft.findMany({
          where: {
            status: "SENT",
            sentAt: { lte: reminderThreshold },
            lead: {
              createdById: workspaceId,
              status: { notIn: ["RESPONDED", "QUALIFIED", "WON", "LOST", "ARCHIVED"] },
            },
          },
          select: { leadId: true },
          distinct: ["leadId"],
          take: 30,
        }),
        ctx.db.emailDraft.findMany({
          where: {
            status: "SENT",
            sentAt: { lte: reminderThreshold },
            lead: {
              createdById: workspaceId,
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
        }),
      ]);

      const drafts = {
        items: draftRows.map(enrichDraftRow),
        total: draftTotal,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(draftTotal / input.pageSize),
      };

      const followUpQueue = {
        followupDays,
        items: followUpDrafts.flatMap((draft) => {
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
        }),
      };

      return {
        drafts,
        followUpQueue,
        topbarStats: {
          pendingDrafts,
          followUpCount: followupLeads.length,
        },
      };
    }),

  listDrafts: protectedProcedure
    .input(
      z.object({
        status: z.string().optional(),
        leadId: z.string().optional(),
        search: z.string().optional(),
        type: z.enum(EMAIL_TYPE_VALUES).optional(),
        sourceModule: z.enum(OUTBOUND_SOURCE_MODULES).optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId!;
      await normalizeLegacyScheduledDrafts(ctx.db, workspaceId);

      const where: Record<string, unknown> = {
        lead: { createdById: workspaceId },
      };
      if (input.status) {
        where.status = input.status === "DRAFT" ? { in: ["DRAFT", "SCHEDULED"] } : input.status;
      }
      if (input.type) where.type = input.type;
      if (input.sourceModule) {
        Object.assign(where, buildOutboundSourceModuleWhere(input.sourceModule));
      }
      if (input.leadId) {
        await assertLeadAccess(ctx.db, workspaceId, input.leadId);
        where.leadId = input.leadId;
      }
      const search = input.search?.trim();
      if (search) {
        where.OR = [
          { subject: { contains: search, mode: "insensitive" } },
          { toEmail: { contains: search, mode: "insensitive" } },
          { lead: { companyName: { contains: search, mode: "insensitive" }, createdById: workspaceId } },
        ];
      }

      const [rows, total] = await Promise.all([
        ctx.db.emailDraft.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          include: {
            lead: { select: { id: true, companyName: true } },
            author: { select: { id: true, name: true } },
            approver: { select: { id: true, name: true } },
            sequence: { select: { id: true, name: true } },
          },
        }),
        ctx.db.emailDraft.count({ where }),
      ]);

      const items = rows.map(enrichDraftRow);

      return { items, total, page: input.page, pageSize: input.pageSize, totalPages: Math.ceil(total / input.pageSize) };
    }),

  listAgenda: protectedProcedure
    .input(
      z.object({
        rangeStart: z.string().datetime(),
        rangeEnd: z.string().datetime(),
        type: z.enum(EMAIL_TYPE_VALUES).optional(),
        sourceModule: z.enum(OUTBOUND_SOURCE_MODULES).optional(),
        status: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId!;
      await normalizeLegacyScheduledDrafts(ctx.db, workspaceId);

      const rangeStart = new Date(input.rangeStart);
      const rangeEnd = new Date(input.rangeEnd);
      if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ongeldige datumperiode." });
      }

      const where: Record<string, unknown> = {
        lead: { createdById: workspaceId },
        scheduledFor: { gte: rangeStart, lte: rangeEnd },
      };
      if (input.type) where.type = input.type;
      if (input.sourceModule) {
        Object.assign(where, buildOutboundSourceModuleWhere(input.sourceModule));
      }
      if (input.status) {
        where.status = input.status === "DRAFT" ? { in: ["DRAFT", "SCHEDULED"] } : input.status;
      }

      const rows = await ctx.db.emailDraft.findMany({
        where,
        orderBy: { scheduledFor: "asc" },
        include: {
          lead: { select: { id: true, companyName: true } },
          author: { select: { id: true, name: true } },
          sequence: { select: { id: true, name: true } },
        },
      });

      return { items: rows.map(enrichDraftRow) };
    }),

  updateScheduledFor: mutationProcedure
    .input(
      z.object({
        id: z.string(),
        scheduledFor: z.string().datetime(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId!;
      const draft = await ctx.db.emailDraft.findFirst({
        where: { id: input.id, lead: { createdById: workspaceId } },
        select: { id: true, status: true, leadId: true, subject: true, authorId: true },
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "E-mail niet gevonden." });
      if (draft.authorId !== ctx.user.id && !["OWNER", "ADMIN"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Geen toegang om deze planning aan te passen." });
      }
      if (!(RESCHEDULABLE_OUTBOUND_STATUSES as readonly string[]).includes(draft.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Alleen concepten of goedgekeurde mails met een gepland tijdstip kunnen worden verplaatst.",
        });
      }

      const scheduledFor = new Date(input.scheduledFor);
      if (Number.isNaN(scheduledFor.getTime())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ongeldig tijdstip." });
      }

      const nextStatus = draft.status === "SCHEDULED" ? "DRAFT" : draft.status;

      const updated = await ctx.db.emailDraft.update({
        where: { id: draft.id },
        data: {
          scheduledFor,
          status: nextStatus,
        },
        include: {
          lead: { select: { id: true, companyName: true } },
          sequence: { select: { id: true, name: true } },
        },
      });

      if (draft.leadId) {
        await ctx.db.activity
          .create({
            data: {
              leadId: draft.leadId,
              userId: ctx.user.id,
              type: "LEAD_UPDATED",
              title: `Verzendmoment aangepast: ${draft.subject}`,
              metadata: { draftId: draft.id, scheduledFor: scheduledFor.toISOString(), source: "contact.updateScheduledFor" },
            },
          })
          .catch(() => null);
      }

      return enrichDraftRow(updated);
    }),

  deleteDraft: mutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.emailDraft.findFirst({
        where: { id: input.id, lead: { createdById: ctx.user.workspaceId! } },
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

  bulkDeleteDrafts: mutationProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const drafts = await ctx.db.emailDraft.findMany({
        where: { id: { in: input.ids }, lead: { createdById: ctx.user.workspaceId! } },
        select: { id: true },
      });
      const ids = drafts.map((draft) => draft.id);
      if (ids.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Geen e-mails gevonden." });
      const result = await ctx.db.emailDraft.deleteMany({ where: { id: { in: ids } } });
      return { success: true, deleted: result.count };
    }),

  bulkSendDrafts: mutationProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(25) }))
    .mutation(async ({ ctx, input }) => {
      const drafts = await ctx.db.emailDraft.findMany({
        where: {
          id: { in: input.ids },
          lead: { createdById: ctx.user.workspaceId! },
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
    const scope = workspaceScopeFromUser(ctx.user);
    const settings = await loadWorkspaceSettingRows(ctx.db, scope, ["email.followup_days"]);
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
          createdById: ctx.user.workspaceId!,
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

  createDraft: mutationProcedure
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
      await assertLeadAccess(ctx.db, ctx.user.workspaceId!, input.leadId);
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

  updateDraft: mutationProcedure
    .input(
      z.object({
        id: z.string(),
        subject: z.string().optional(),
        body: z.string().optional(),
        toEmail: z.string().email().optional(),
        templateId: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.emailDraft.findFirst({
        where: {
          id: input.id,
          lead: { createdById: ctx.user.workspaceId! },
        },
        select: { id: true, status: true, authorId: true },
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      if (draft.authorId !== ctx.user.id && !["OWNER", "ADMIN"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Geen toegang om dit concept te bewerken." });
      }
      const editableStatuses = ["DRAFT", "REJECTED", "PENDING_APPROVAL", "APPROVED", "FAILED"];
      if (!editableStatuses.includes(draft.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Deze e-mail kan niet meer worden bewerkt." });
      }

      const { id, ...data } = input;
      const nextStatus = draft.status === "PENDING_APPROVAL" ? "PENDING_APPROVAL" : "DRAFT";
      const approvalReset =
        draft.status === "APPROVED"
          ? { approverId: null, approvedAt: null, rejectedAt: null, rejectionNote: null }
          : {};

      return ctx.db.emailDraft.update({
        where: { id },
        data: { ...data, status: nextStatus, ...approvalReset },
      });
    }),

  submitForApproval: mutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.emailDraft.findFirst({
        where: {
          id: input.id,
          lead: { createdById: ctx.user.workspaceId! },
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
        where: { id: input.id, lead: { createdById: ctx.user.workspaceId! } },
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
        where: { id: input.id, lead: { createdById: ctx.user.workspaceId! } },
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

  sendEmail: mutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.emailDraft.findFirst({
        where: {
          id: input.id,
          lead: { createdById: ctx.user.workspaceId! },
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
              await loadWorkspaceSettingRows(
                ctx.db,
                workspaceScopeFromUser(ctx.user),
                ["email.followup_days"],
              ),
              "email.followup_days",
              "3",
            ),
            10,
          ) || 3;

        const result =
          draft.type === "QUOTE" && draft.leadId
            ? await sendApprovedQuoteDraft(
                ctx.db,
                { ...draft, leadId: draft.leadId },
                ctx.user.id,
                ctx.user.workspaceId!,
              )
            : await sendBrandedEmail(ctx.db, {
                toEmail: draft.toEmail,
                subject: draft.subject,
                body: draft.body,
                recipientCompany: draft.lead?.companyName ?? draft.toEmail,
                leadId: draft.leadId ?? undefined,
                userId: workspaceScopeFromUser(ctx.user),
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

        const invoiceId = extractInvoiceIdFromDraftBody(draft.body);
        if (invoiceId) {
          await ctx.db.workspaceInvoice.updateMany({
            where: {
              id: invoiceId,
              createdById: ctx.user.workspaceId!,
              status: "DRAFT",
            },
            data: { status: "SENT" },
          });
        }

        // Create activity record
        await ctx.db.activity.create({
          data: {
            leadId: draft.leadId,
            userId: ctx.user.id,
            type: draft.type === "QUOTE" ? "QUOTE_SENT" : "EMAIL_SENT",
            title:
              draft.type === "QUOTE"
                ? `Offerte per e-mail verstuurd naar ${draft.toEmail}`
                : `E-mail verzonden naar ${draft.toEmail}`,
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

  getDraftById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const draft = await ctx.db.emailDraft.findFirst({
        where: {
          id: input.id,
          lead: { createdById: ctx.user.workspaceId! },
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
