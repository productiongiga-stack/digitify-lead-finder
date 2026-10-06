import { z } from "zod";
import { router, protectedProcedure, adminProcedure, mutationProcedure } from "../trpc";
import { effectiveWorkspaceRole } from "../lib/effective-role";
import { TRPCError } from "@trpc/server";
import { sendApprovedDraft } from "../lib/approved-email-send";
import { log } from "../lib/logger";
import { sendBrandedEmail } from "../lib/email-sender";
import { sendApprovedQuoteDraft } from "../lib/quote-outbound-email";
import { extractInvoiceIdFromDraftBody } from "../lib/invoice-outbound";
import { getSettingString } from "../lib/settings";
import { loadWorkspaceSettingRows, workspaceScopeFromUser } from "../lib/workspace-settings";
import { assertLeadAccess } from "../lib/tenant";
import { ensureLeadLink, findLeadByEmailInWorkspace } from "../lib/lead-link";
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

function draftWorkspaceWhere(workspaceId: string, extra: Record<string, unknown> = {}) {
  return { workspaceId, ...extra };
}

function normalizeRecipientEmail(value: string) {
  return value.trim().toLowerCase();
}

export const contactRouter = router({
  getOutboundStats: protectedProcedure.query(async ({ ctx }) => {
    const workspaceId = ctx.user.workspaceId!;
    await normalizeLegacyScheduledDrafts(ctx.db, workspaceId);

    const buckets = await ctx.db.emailDraft.groupBy({
      by: ["status"],
      where: draftWorkspaceWhere(workspaceId),
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
        where: { workspaceId: ctx.user.workspaceId!, status: "PENDING_APPROVAL" },
      }),
      ctx.db.emailDraft.findMany({
        where: {
          workspaceId: ctx.user.workspaceId!,
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

      const where: Record<string, unknown> = { workspaceId };
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
          where: { workspaceId, status: "PENDING_APPROVAL" },
        }),
        ctx.db.emailDraft.findMany({
          where: {
            workspaceId,
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
            workspaceId,
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

      const where: Record<string, unknown> = { workspaceId };
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
        workspaceId,
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
        where: { id: input.id, workspaceId },
        select: { id: true, status: true, leadId: true, subject: true, authorId: true },
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "E-mail niet gevonden." });
      if (draft.authorId !== ctx.user.id && !["OWNER", "ADMIN"].includes(effectiveWorkspaceRole(ctx))) {
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
        where: { id: input.id, workspaceId: ctx.user.workspaceId! },
        select: { id: true, leadId: true, subject: true },
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "E-mail niet gevonden." });

      const deleted = await ctx.db.emailDraft.deleteMany({
        where: { id: draft.id, workspaceId: ctx.user.workspaceId!, status: { notIn: ["SENDING", "DELIVERY_UNKNOWN"] } },
      });
      if (deleted.count !== 1) {
        throw new TRPCError({ code: "CONFLICT", message: "Deze e-mail is intussen gewijzigd of wordt verwerkt." });
      }
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
        where: { id: { in: input.ids }, workspaceId: ctx.user.workspaceId! },
        select: { id: true },
      });
      const ids = drafts.map((draft) => draft.id);
      if (ids.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Geen e-mails gevonden." });
      const result = await ctx.db.emailDraft.deleteMany({
        where: {
          id: { in: ids },
          workspaceId: ctx.user.workspaceId!,
          status: { notIn: ["SENDING", "DELIVERY_UNKNOWN"] },
        },
      });
      return { success: true, deleted: result.count };
    }),

  bulkSendDrafts: mutationProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(25) }))
    .mutation(async ({ ctx, input }) => {
      const drafts = await ctx.db.emailDraft.findMany({
        where: {
          id: { in: input.ids },
          workspaceId: ctx.user.workspaceId!,
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
        workspaceId: ctx.user.workspaceId!,
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
        leadId: z.string().optional(),
        toEmail: z.string().trim().email(),
        subject: z.string().min(1),
        body: z.string().min(1),
        templateId: z.string().optional(),
        type: z.enum(["LEAD_CONTACT", "QUOTE", "REPLY", "FOLLOW_UP", "REVIEW_REQUEST", "TRANSACTIONAL"]).optional(),
        idempotencyKey: z.string().trim().min(1).max(120).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId!;
      const toEmail = normalizeRecipientEmail(input.toEmail);
      if (input.leadId) await assertLeadAccess(ctx.db, workspaceId, input.leadId);

      if (input.idempotencyKey) {
        const existing = await ctx.db.emailDraft.findFirst({
          where: { workspaceId, idempotencyKey: input.idempotencyKey },
        });
        if (existing) return existing;
      }

      let draft;
      try {
        draft = await ctx.db.emailDraft.create({
          data: {
            workspaceId,
            leadId: input.leadId,
            toEmail,
            subject: input.subject.trim(),
            body: input.body.trim(),
            templateId: input.templateId,
            type: input.type,
            idempotencyKey: input.idempotencyKey,
            authorId: ctx.user.id,
            status: "DRAFT",
          },
        });
      } catch (error) {
        if (input.idempotencyKey) {
          const existing = await ctx.db.emailDraft.findFirst({
            where: { workspaceId, idempotencyKey: input.idempotencyKey },
          });
          if (existing) return existing;
        }
        throw error;
      }

      await ctx.db.activity.create({
        data: {
          leadId: input.leadId ?? null,
          userId: ctx.user.id,
          type: "EMAIL_DRAFTED",
          title: "E-mail draft aangemaakt",
          metadata: { draftId: draft.id, toEmail, workspaceId },
        },
      });

      return draft;
    }),

  resolveRecipient: protectedProcedure
    .input(z.object({ email: z.string().trim().email() }))
    .query(async ({ ctx, input }) => {
      const email = normalizeRecipientEmail(input.email);
      const lead = await findLeadByEmailInWorkspace(ctx.db, ctx.user.workspaceId!, email);
      return {
        email,
        lead: lead ? { id: lead.id, companyName: lead.companyName, email: lead.email } : null,
      };
    }),

  saveRecipientAsLead: mutationProcedure
    .input(z.object({
      draftId: z.string(),
      companyName: z.string().trim().max(200).optional(),
      website: z.string().trim().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId!;
      const draft = await ctx.db.emailDraft.findFirst({
        where: { id: input.draftId, workspaceId },
        select: { id: true, leadId: true, toEmail: true },
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "E-mail niet gevonden." });
      if (draft.leadId) return { outcome: "reused" as const, leadId: draft.leadId };

      const existingLead = await findLeadByEmailInWorkspace(ctx.db, workspaceId, draft.toEmail);
      if (existingLead) {
        await ctx.db.emailDraft.update({ where: { id: draft.id }, data: { leadId: existingLead.id } });
        await ctx.db.activity.create({
          data: {
            leadId: existingLead.id,
            userId: ctx.user.id,
            type: "LEAD_UPDATED",
            title: "Ontvanger aan bestaande lead gekoppeld",
            metadata: { draftId: draft.id, source: "contact.saveRecipientAsLead", outcome: "reused" },
          },
        }).catch(() => null);
        return { outcome: "reused" as const, leadId: existingLead.id };
      }

      const lead = await ensureLeadLink({
        db: ctx.db,
        userId: ctx.user.id,
        workspaceId,
        email: draft.toEmail,
        companyName: input.companyName,
        website: input.website,
        source: "contact_recipient_save",
        createIfMissing: true,
      });
      if (!lead) throw new TRPCError({ code: "BAD_REQUEST", message: "Ontvanger kon niet als lead worden opgeslagen." });

      await ctx.db.emailDraft.update({ where: { id: draft.id }, data: { leadId: lead.id } });
      await ctx.db.activity.create({
        data: {
          leadId: lead.id,
          userId: ctx.user.id,
          type: "LEAD_CREATED",
          title: "Ontvanger als lead opgeslagen",
          metadata: { draftId: draft.id, source: "contact.saveRecipientAsLead" },
        },
      }).catch(() => null);
      return { outcome: "created" as const, leadId: lead.id };
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
          workspaceId: ctx.user.workspaceId!,
        },
        select: { id: true, status: true, authorId: true, updatedAt: true },
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      if (draft.authorId !== ctx.user.id && !["OWNER", "ADMIN"].includes(effectiveWorkspaceRole(ctx))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Geen toegang om dit concept te bewerken." });
      }
      const editableStatuses = ["DRAFT", "REJECTED", "PENDING_APPROVAL", "APPROVED", "FAILED"];
      if (!editableStatuses.includes(draft.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Deze e-mail kan niet meer worden bewerkt." });
      }

      const { id, ...data } = input;
      const normalizedData = {
        ...data,
        ...(data.toEmail ? { toEmail: normalizeRecipientEmail(data.toEmail) } : {}),
      };
      const nextStatus = "DRAFT";
      const approvalReset = { approverId: null, approvedAt: null, rejectedAt: null, rejectionNote: null };

      return ctx.db.emailDraft.update({
        where: { id, status: draft.status, updatedAt: draft.updatedAt },
        data: { ...normalizedData, status: nextStatus, ...approvalReset },
      });
    }),

  submitForApproval: mutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.emailDraft.findFirst({
        where: { id: input.id, workspaceId: ctx.user.workspaceId! },
        select: { id: true, status: true, authorId: true, updatedAt: true },
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      if (draft.authorId !== ctx.user.id && !["OWNER", "ADMIN"].includes(effectiveWorkspaceRole(ctx))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Geen toegang om dit concept in te dienen." });
      }
      if (draft.status !== "DRAFT") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Alleen concepten kunnen worden ingediend." });
      }

      return ctx.db.emailDraft.update({
        where: { id: input.id, status: "DRAFT", updatedAt: draft.updatedAt },
        data: { status: "PENDING_APPROVAL" },
      });
    }),

  approve: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.emailDraft.findFirst({
        where: { id: input.id, workspaceId: ctx.user.workspaceId! },
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      if (draft.status !== "PENDING_APPROVAL") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Alleen ingediende e-mails kunnen worden goedgekeurd." });
      }

      const updated = await ctx.db.emailDraft.update({
        where: { id: input.id, status: "PENDING_APPROVAL", updatedAt: draft.updatedAt },
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
        where: { id: input.id, workspaceId: ctx.user.workspaceId! },
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      if (draft.status !== "PENDING_APPROVAL") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Alleen ingediende e-mails kunnen worden afgekeurd." });
      }

      const updated = await ctx.db.emailDraft.update({
        where: { id: input.id, status: "PENDING_APPROVAL", updatedAt: draft.updatedAt },
        data: {
          status: "REJECTED",
          approverId: ctx.user.id,
          rejectedAt: new Date(),
          rejectionNote: input.note,
        },
      });
      await ctx.db.activity.create({
        data: {
          leadId: draft.leadId,
          userId: ctx.user.id,
          type: "LEAD_UPDATED",
          title: "E-mail afgekeurd",
          metadata: { draftId: draft.id, source: "contact.reject", note: input.note ?? null },
        },
      }).catch(() => null);
      return updated;
    }),

  sendEmail: mutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await sendApprovedDraft(ctx.db, input.id, ctx.user.workspaceId!, (draft) =>
        draft.type === "QUOTE" && draft.leadId
          ? sendApprovedQuoteDraft(ctx.db, { ...draft, leadId: draft.leadId }, ctx.user.id, ctx.user.workspaceId!)
          : sendBrandedEmail(ctx.db, {
              toEmail: draft.toEmail, subject: draft.subject, body: draft.body,
              recipientCompany: draft.lead?.companyName ?? draft.toEmail,
              leadId: draft.leadId ?? undefined, userId: workspaceScopeFromUser(ctx.user),
              trackingDraftId: draft.id,
            }),
      );
      if (!updated) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "E-mail is verzonden, maar kon niet worden geregistreerd." });
      }
      try {
        const invoiceId = extractInvoiceIdFromDraftBody(updated.body);
        if (invoiceId) {
          await ctx.db.workspaceInvoice.updateMany({
            where: { id: invoiceId, createdById: ctx.user.workspaceId!, status: "DRAFT" },
            data: { status: "SENT" },
          });
        }
        if (updated.leadId) {
          await ctx.db.lead.updateMany({
            where: { id: updated.leadId, createdById: ctx.user.workspaceId! },
            data: { lastContactedAt: updated.sentAt },
          });
        }
        await ctx.db.activity.create({
          data: {
            leadId: updated.leadId, userId: ctx.user.id,
            type: updated.type === "QUOTE" ? "QUOTE_SENT" : "EMAIL_SENT",
            title: `E-mail verzonden naar ${updated.toEmail}`,
          },
        });
      } catch (error) {
        log.email.error("Sent email follow-up bookkeeping failed", { draftId: updated.id }, error);
      }
      return updated;
    }),

  getDraftById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const draft = await ctx.db.emailDraft.findFirst({
        where: {
          id: input.id,
          workspaceId: ctx.user.workspaceId!,
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
