import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import type { Context } from "../trpc";
import { leadStatusLabelNl } from "../lib/lead-status-labels";
import { loadWorkspaceSettingRows, workspaceScopeFromUser } from "../lib/workspace-settings";
import { ownedChatSessionWhere } from "../lib/tenant";
import { readDashboardCache, writeDashboardCache } from "../lib/dashboard-cache";

function getSettingString(
  settings: Array<{ key: string; value: unknown }>,
  key: string,
  fallback = "",
) {
  const match = settings.find((item) => item.key === key);
  if (typeof match?.value === "string") return match.value;
  if (typeof match?.value === "number" || typeof match?.value === "boolean") return String(match.value);
  return fallback;
}

type KpiResult = {
  totalLeads: number;
  newLeads: number;
  hotLeads: number;
  contactedLeads: number;
  totalCampaigns: number;
  pendingDrafts: number;
  approvedDrafts: number;
  rejectedDrafts: number;
  sentEmails: number;
  wonLeads: number;
  avgScore: number;
  activeQuotes: number;
  totalQuoteValue: number;
  unreadChats: number;
  activeCampaignLeadCount: number;
  scheduledEmails: number;
  failedEmails: number;
  pendingReviews: number;
  conversionRate: number;
  responseRate: number;
};

type UnifiedReminderItem = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  href: string;
  dueAt: Date;
  tone: string;
};

type UnifiedRemindersResult = {
  followupDays: number;
  items: UnifiedReminderItem[];
};

type AttentionItem = UnifiedReminderItem;

type AttentionQueueResult = {
  totalCount: number;
  items: AttentionItem[];
};

type WorkspaceCtx = Pick<Context, "db"> & { user: { workspaceId: string; id: string } };

function asWorkspaceCtx(ctx: Context): WorkspaceCtx {
  return {
    db: ctx.db,
    user: {
      workspaceId: ctx.user!.workspaceId!,
      id: ctx.user!.id,
    },
  };
}

async function loadUnifiedReminders(ctx: WorkspaceCtx): Promise<UnifiedRemindersResult> {
  const cacheKey = `getUnifiedReminders:${ctx.user.workspaceId!}`;
  const cached = readDashboardCache<UnifiedRemindersResult>(cacheKey);
  if (cached) return cached;

  const scope = workspaceScopeFromUser(ctx.user);
  const settings = await loadWorkspaceSettingRows(ctx.db, scope, ["email.followup_days"]);
  const followupDays = Math.max(
    1,
    Number.parseInt(getSettingString(settings, "email.followup_days", "3"), 10) || 3,
  );
  const emailThreshold = new Date(Date.now() - followupDays * 24 * 60 * 60 * 1000);
  const quoteThreshold = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
  const quoteValidThreshold = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [drafts, pendingBookings, staleQuotes, leadFollowUps] = await Promise.all([
    ctx.db.emailDraft.findMany({
      where: {
        status: "SENT",
        sentAt: { lte: emailThreshold },
        lead: {
          createdById: ctx.user.workspaceId!,
          status: { notIn: ["RESPONDED", "QUALIFIED", "WON", "LOST", "ARCHIVED"] },
        },
      },
      orderBy: { sentAt: "asc" },
      distinct: ["leadId"],
      take: 6,
      include: {
        lead: {
          select: {
            id: true,
            companyName: true,
            status: true,
          },
        },
      },
    }),
    ctx.db.booking.findMany({
      where: {
        createdById: ctx.user.workspaceId!,
        OR: [
          { status: "PENDING" },
          {
            status: { in: ["SCHEDULED", "CONFIRMED"] },
            date: { gte: now, lte: next24Hours },
          },
        ],
      },
      orderBy: [{ status: "asc" }, { date: "asc" }],
      take: 6,
      select: {
        id: true,
        clientName: true,
        date: true,
        status: true,
      },
    }),
    ctx.db.quote.findMany({
      where: {
        createdById: ctx.user.workspaceId!,
        status: { in: ["SENT", "VIEWED"] },
        OR: [
          { sentAt: { lte: quoteThreshold } },
          { validUntil: { lte: quoteValidThreshold, gte: new Date() } },
        ],
      },
      orderBy: [{ validUntil: "asc" }, { sentAt: "asc" }],
      take: 6,
      select: {
        id: true,
        quoteNumber: true,
        clientName: true,
        status: true,
        sentAt: true,
        validUntil: true,
      },
    }),
    ctx.db.lead.findMany({
      where: {
        createdById: ctx.user.workspaceId!,
        status: { in: ["CONTACTED", "RESPONDED", "QUALIFIED"] },
        activities: {
          none: {
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        },
      },
      take: 6,
      orderBy: { updatedAt: "asc" },
      select: {
        id: true,
        companyName: true,
        status: true,
        updatedAt: true,
      },
    }),
  ]);

  const items = [
    ...drafts.flatMap((draft) => {
      if (!draft.lead) return [];
      return [{
        id: `email-${draft.id}`,
        type: "email_followup",
        title: `Follow-up klaar voor ${draft.lead.companyName}`,
        subtitle: draft.subject,
        href: `/contacts/compose?leadId=${draft.lead.id}`,
        dueAt: draft.sentAt ?? draft.createdAt,
        tone: "violet",
      }];
    }),
    ...pendingBookings.map((booking) => ({
      id: `booking-${booking.id}`,
      type: "booking_action",
      title:
        booking.status === "PENDING"
          ? `Bevestig booking van ${booking.clientName}`
          : `Aankomende booking: ${booking.clientName}`,
      subtitle:
        booking.status === "PENDING"
          ? "Nieuwe aanvraag wacht op reactie"
          : `Gepland op ${booking.date.toLocaleString("nl-BE")}`,
      href: "/bookings",
      dueAt: booking.status === "PENDING" ? booking.date : booking.date,
      tone: booking.status === "PENDING" ? "amber" : "blue",
    })),
    ...staleQuotes.map((quote) => ({
      id: `quote-${quote.id}`,
      type: "quote_followup",
      title: `Volg offerte ${quote.quoteNumber} op`,
      subtitle: quote.validUntil
        ? `Geldig tot ${quote.validUntil.toLocaleDateString("nl-BE")} voor ${quote.clientName}`
        : `Wacht op reactie van ${quote.clientName}`,
      href: `/quotes/${quote.id}`,
      dueAt: quote.validUntil ?? quote.sentAt ?? new Date(),
      tone: "emerald",
    })),
    ...leadFollowUps.map((lead) => ({
      id: `lead-${lead.id}`,
      type: "lead_followup",
      title: `Lead opvolgen: ${lead.companyName}`,
      subtitle: `Status ${leadStatusLabelNl(lead.status)} — opvolging nodig`,
      href: `/leads/${lead.id}`,
      dueAt: lead.updatedAt,
      tone: "rose",
    })),
  ];

  const dedupedItems: typeof items = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    dedupedItems.push(item);
  }

  const sortedItems = dedupedItems
    .sort((left, right) => new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime())
    .slice(0, 12);

  const result: UnifiedRemindersResult = { followupDays, items: sortedItems };
  writeDashboardCache(cacheKey, result);
  return result;
}

async function buildAttentionQueue(ctx: WorkspaceCtx): Promise<AttentionQueueResult> {
  const wsId = ctx.user.workspaceId!;
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const draftInclude = {
    lead: { select: { companyName: true } },
  } as const;

  const [
    unified,
    pendingDrafts,
    approvedDrafts,
    failedDrafts,
    rejectedDrafts,
    expiringDomains,
    pendingReviews,
    unreadChats,
    approvedCount,
    failedCount,
    rejectedCount,
  ] = await Promise.all([
    loadUnifiedReminders(ctx),
    ctx.db.emailDraft.findMany({
      where: { status: "PENDING_APPROVAL", lead: { createdById: wsId } },
      take: 20,
      orderBy: { createdAt: "desc" },
      include: draftInclude,
    }),
    ctx.db.emailDraft.findMany({
      where: { status: "APPROVED", lead: { createdById: wsId } },
      take: 10,
      orderBy: { updatedAt: "desc" },
      include: draftInclude,
    }),
    ctx.db.emailDraft.findMany({
      where: { status: "FAILED", lead: { createdById: wsId } },
      take: 10,
      orderBy: { updatedAt: "desc" },
      include: draftInclude,
    }),
    ctx.db.emailDraft.findMany({
      where: { status: "REJECTED", lead: { createdById: wsId } },
      take: 10,
      orderBy: { updatedAt: "desc" },
      include: draftInclude,
    }),
    ctx.db.domain.findMany({
      where: {
        createdById: wsId,
        expiresAt: { gte: now, lte: thirtyDaysFromNow },
        status: { in: ["ACTIVE", "EXPIRING"] },
      },
      orderBy: { expiresAt: "asc" },
      take: 10,
      select: { id: true, domainName: true, expiresAt: true },
    }),
    ctx.db.reviewRequest.count({ where: { status: "PENDING", createdById: wsId } }),
    ctx.db.chatSession.count({
      where: { ...ownedChatSessionWhere(wsId, ctx.user.id), isRead: false },
    }),
    ctx.db.emailDraft.count({ where: { status: "APPROVED", lead: { createdById: wsId } } }),
    ctx.db.emailDraft.count({ where: { status: "FAILED", lead: { createdById: wsId } } }),
    ctx.db.emailDraft.count({ where: { status: "REJECTED", lead: { createdById: wsId } } }),
  ]);

  const items: AttentionItem[] = [];

  for (const draft of pendingDrafts) {
    items.push({
      id: `approval-${draft.id}`,
      type: "outbound_approval",
      title: draft.subject || "E-mail zonder onderwerp",
      subtitle: `Wacht op goedkeuring · ${draft.lead?.companyName ?? draft.toEmail}`,
      href: "/contacts/approval",
      dueAt: draft.createdAt,
      tone: "amber",
    });
  }

  for (const draft of approvedDrafts) {
    items.push({
      id: `ready-${draft.id}`,
      type: "outbound_ready",
      title: draft.subject || "E-mail zonder onderwerp",
      subtitle: `Klaar om te verzenden · ${draft.lead?.companyName ?? draft.toEmail}`,
      href: `/contacts/drafts/${draft.id}`,
      dueAt: draft.updatedAt,
      tone: "blue",
    });
  }
  if (approvedCount > approvedDrafts.length) {
    items.push({
      id: "synthetic-approved-more",
      type: "outbound_ready",
      title: `${approvedCount - approvedDrafts.length} extra goedgekeurde e-mail${approvedCount - approvedDrafts.length !== 1 ? "s" : ""}`,
      subtitle: "Bekijk alles in Outbound Center",
      href: "/contacts",
      dueAt: now,
      tone: "blue",
    });
  }

  if (failedCount > 0) {
    if (failedDrafts.length === 0) {
      items.push({
        id: "synthetic-failed",
        type: "email_failed",
        title: `${failedCount} mislukte e-mail${failedCount !== 1 ? "s" : ""}`,
        subtitle: "Onderneem actie of verstuur opnieuw",
        href: "/contacts",
        dueAt: now,
        tone: "rose",
      });
    } else {
      for (const draft of failedDrafts) {
        items.push({
          id: `failed-${draft.id}`,
          type: "email_failed",
          title: draft.subject || "Mislukte e-mail",
          subtitle: draft.lead?.companyName ?? draft.toEmail,
          href: `/contacts/drafts/${draft.id}`,
          dueAt: draft.updatedAt,
          tone: "rose",
        });
      }
      if (failedCount > failedDrafts.length) {
        items.push({
          id: "synthetic-failed-more",
          type: "email_failed",
          title: `${failedCount - failedDrafts.length} extra mislukte e-mail${failedCount - failedDrafts.length !== 1 ? "s" : ""}`,
          subtitle: "Bekijk alles in Outbound Center",
          href: "/contacts",
          dueAt: now,
          tone: "rose",
        });
      }
    }
  }

  for (const draft of rejectedDrafts) {
    items.push({
      id: `rejected-${draft.id}`,
      type: "outbound_rejected",
      title: draft.subject || "Afgekeurde e-mail",
      subtitle: `Aanpassen en opnieuw indienen · ${draft.lead?.companyName ?? draft.toEmail}`,
      href: `/contacts/drafts/${draft.id}`,
      dueAt: draft.updatedAt,
      tone: "rose",
    });
  }
  if (rejectedCount > rejectedDrafts.length) {
    items.push({
      id: "synthetic-rejected-more",
      type: "outbound_rejected",
      title: `${rejectedCount - rejectedDrafts.length} extra afgekeurde e-mail${rejectedCount - rejectedDrafts.length !== 1 ? "s" : ""}`,
      subtitle: "Bekijk alles in Outbound Center",
      href: "/contacts",
      dueAt: now,
      tone: "rose",
    });
  }

  if (pendingReviews > 0) {
    items.push({
      id: "synthetic-reviews",
      type: "review_pending",
      title: `${pendingReviews} open reviewverzoek${pendingReviews !== 1 ? "en" : ""}`,
      subtitle: "Wachten op reactie van klant",
      href: "/reviews",
      dueAt: now,
      tone: "yellow",
    });
  }

  if (unreadChats > 0) {
    items.push({
      id: "synthetic-chats",
      type: "chat_unread",
      title: `${unreadChats} ongelezen chat${unreadChats !== 1 ? "s" : ""}`,
      subtitle: "Bezoeker wacht op antwoord",
      href: "/chatbot",
      dueAt: now,
      tone: "indigo",
    });
  }

  items.push(...unified.items);

  for (const domain of expiringDomains) {
    if (!domain.expiresAt) continue;
    items.push({
      id: `domain-${domain.id}`,
      type: "domain_expiring",
      title: `Domein verloopt: ${domain.domainName}`,
      subtitle: `Verloopt op ${domain.expiresAt.toLocaleDateString("nl-BE")}`,
      href: `/domains/${domain.id}`,
      dueAt: domain.expiresAt,
      tone: "orange",
    });
  }

  const seen = new Set<string>();
  const dedupedItems = items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  return { totalCount: dedupedItems.length, items: dedupedItems };
}

/** Count-only path for topbar badge (avoids loading draft rows). */
async function loadAttentionCountOnly(ctx: WorkspaceCtx): Promise<number> {
  const wsId = ctx.user.workspaceId;
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const [draftBuckets, pendingReviews, unreadChats, expiringDomainCount, unified] = await Promise.all([
    ctx.db.emailDraft.groupBy({
      by: ["status"],
      where: { lead: { createdById: wsId } },
      _count: { _all: true },
    }),
    ctx.db.reviewRequest.count({ where: { status: "PENDING", createdById: wsId } }),
    ctx.db.chatSession.count({
      where: { ...ownedChatSessionWhere(wsId, ctx.user.id), isRead: false },
    }),
    ctx.db.domain.count({
      where: {
        createdById: wsId,
        expiresAt: { gte: now, lte: thirtyDaysFromNow },
        status: { in: ["ACTIVE", "EXPIRING"] },
      },
    }),
    loadUnifiedReminders(ctx),
  ]);

  const draftCount = Object.fromEntries(
    draftBuckets.map((bucket) => [bucket.status, bucket._count._all]),
  ) as Record<string, number>;

  const pendingApproval = draftCount.PENDING_APPROVAL ?? 0;
  const approvedCount = draftCount.APPROVED ?? 0;
  const failedCount = draftCount.FAILED ?? 0;
  const rejectedCount = draftCount.REJECTED ?? 0;

  let count = 0;
  count += Math.min(pendingApproval, 20);
  count += Math.min(approvedCount, 10);
  if (approvedCount > 10) count += 1;

  if (failedCount > 0) {
    const shown = Math.min(failedCount, 10);
    count += shown;
    if (failedCount > shown) count += 1;
  }

  count += Math.min(rejectedCount, 10);
  if (rejectedCount > 10) count += 1;

  if (pendingReviews > 0) count += 1;
  if (unreadChats > 0) count += 1;
  count += unified.items.length;
  count += Math.min(expiringDomainCount, 10);

  return count;
}

async function loadKpis(ctx: WorkspaceCtx): Promise<KpiResult> {
  const cacheKey = `getKpis:${ctx.user.workspaceId}`;
  const cached = readDashboardCache<KpiResult>(cacheKey);
  if (cached) return cached;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [
    totalLeads,
    newLeads,
    hotLeads,
    leadStatusBuckets,
    totalCampaigns,
    emailStatusBuckets,
    leadsWithScore,
    activeQuotes,
    totalQuoteValue,
    unreadChats,
    activeCampaignLeadCount,
    pendingReviews,
    quoteStatusBuckets,
  ] = await Promise.all([
    ctx.db.lead.count({ where: { createdById: ctx.user.workspaceId } }),
    ctx.db.lead.count({ where: { createdById: ctx.user.workspaceId, createdAt: { gte: weekAgo } } }),
    ctx.db.lead.count({ where: { createdById: ctx.user.workspaceId, scorePriority: "Hot" } }),
    ctx.db.lead.groupBy({
      by: ["status"],
      where: { createdById: ctx.user.workspaceId },
      _count: { _all: true },
    }),
    ctx.db.campaign.count({ where: { createdById: ctx.user.workspaceId } }),
    ctx.db.emailDraft.groupBy({
      by: ["status"],
      where: { lead: { createdById: ctx.user.workspaceId } },
      _count: { _all: true },
    }),
    ctx.db.lead.aggregate({
      _avg: { overallScore: true },
      where: { createdById: ctx.user.workspaceId, overallScore: { not: null } },
    }),
    ctx.db.quote.count({ where: { createdById: ctx.user.workspaceId, status: { in: ["DRAFT", "SENT", "VIEWED"] } } }),
    ctx.db.quote.aggregate({
      _sum: { total: true },
      where: { createdById: ctx.user.workspaceId, status: { in: ["DRAFT", "SENT", "VIEWED", "ACCEPTED"] } },
    }),
    ctx.db.chatSession.count({ where: { ...ownedChatSessionWhere(ctx.user.workspaceId, ctx.user.id), isRead: false } }),
    ctx.db.campaignLead.count({
      where: {
        campaign: {
          status: "ACTIVE",
          createdById: ctx.user.workspaceId,
        },
      },
    }),
    ctx.db.reviewRequest.count({ where: { status: "PENDING", createdById: ctx.user.workspaceId } }),
    ctx.db.quote.groupBy({
      by: ["status"],
      where: { createdById: ctx.user.workspaceId },
      _count: { _all: true },
    }),
  ]);

  const leadStatusCount = Object.fromEntries(
    leadStatusBuckets.map((item) => [item.status, item._count._all]),
  ) as Record<string, number>;
  const emailStatusCount = Object.fromEntries(
    emailStatusBuckets.map((item) => [item.status, item._count._all]),
  ) as Record<string, number>;
  const quoteStatusCount = Object.fromEntries(
    quoteStatusBuckets.map((item) => [item.status, item._count._all]),
  ) as Record<string, number>;

  const contactedLeads = leadStatusCount.CONTACTED ?? 0;
  const wonLeads = leadStatusCount.WON ?? 0;
  const pendingDrafts = emailStatusCount.PENDING_APPROVAL ?? 0;
  const approvedDrafts = emailStatusCount.APPROVED ?? 0;
  const rejectedDrafts = emailStatusCount.REJECTED ?? 0;
  const sentEmails = emailStatusCount.SENT ?? 0;
  const scheduledEmails = emailStatusCount.SCHEDULED ?? 0;
  const failedEmails = emailStatusCount.FAILED ?? 0;
  const respondedLeads =
    (leadStatusCount.RESPONDED ?? 0) +
    (leadStatusCount.QUALIFIED ?? 0) +
    (leadStatusCount.PROPOSAL_SENT ?? 0) +
    (leadStatusCount.WON ?? 0);
  const contactedAndBeyondLeads =
    (leadStatusCount.CONTACTED ?? 0) +
    (leadStatusCount.RESPONDED ?? 0) +
    (leadStatusCount.QUALIFIED ?? 0) +
    (leadStatusCount.PROPOSAL_SENT ?? 0) +
    (leadStatusCount.WON ?? 0);

  const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
  const responseRate =
    contactedAndBeyondLeads > 0
      ? Math.round((respondedLeads / contactedAndBeyondLeads) * 100)
      : 0;

  const result: KpiResult = {
    totalLeads,
    newLeads,
    hotLeads,
    contactedLeads,
    totalCampaigns,
    pendingDrafts,
    approvedDrafts,
    rejectedDrafts,
    sentEmails,
    wonLeads,
    avgScore: Math.round(leadsWithScore._avg.overallScore ?? 0),
    activeQuotes: activeQuotes || (quoteStatusCount.DRAFT ?? 0) + (quoteStatusCount.SENT ?? 0) + (quoteStatusCount.VIEWED ?? 0),
    totalQuoteValue: totalQuoteValue._sum.total ?? 0,
    unreadChats,
    activeCampaignLeadCount,
    scheduledEmails,
    failedEmails,
    pendingReviews,
    conversionRate,
    responseRate,
  };
  writeDashboardCache(cacheKey, result);
  return result;
}

async function loadRecentActivity(ctx: WorkspaceCtx) {
  return ctx.db.activity.findMany({
    where: {
      OR: [
        { userId: ctx.user.id },
        { lead: { createdById: ctx.user.workspaceId } },
      ],
    },
    take: 20,
    orderBy: { createdAt: "desc" },
    include: {
      lead: { select: { id: true, companyName: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

async function loadPipelineOverview(ctx: WorkspaceCtx) {
  const [stages, leadCounts] = await Promise.all([
    ctx.db.pipelineStage.findMany({
      where: { createdById: ctx.user.workspaceId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, color: true },
    }),
    ctx.db.lead.groupBy({
      by: ["pipelineStageId"],
      _count: { id: true },
      where: { createdById: ctx.user.workspaceId, pipelineStageId: { not: null } },
    }),
  ]);
  const countMap = new Map(
    leadCounts
      .filter((entry) => entry.pipelineStageId)
      .map((entry) => [entry.pipelineStageId as string, entry._count.id]),
  );
  return stages.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    count: countMap.get(s.id) ?? 0,
  }));
}

async function loadTopLeads(ctx: WorkspaceCtx) {
  const rows = await ctx.db.lead.findMany({
    where: { overallScore: { not: null }, createdById: ctx.user.workspaceId },
    orderBy: { overallScore: "desc" },
    take: 24,
    select: {
      id: true,
      companyName: true,
      city: true,
      overallScore: true,
      scorePriority: true,
      status: true,
    },
  });
  const seen = new Set<string>();
  const unique: typeof rows = [];
  for (const row of rows) {
    const key = row.companyName.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
    if (unique.length >= 5) break;
  }
  return unique;
}

async function loadUpcomingBookings(ctx: WorkspaceCtx) {
  const now = new Date();
  return ctx.db.booking.findMany({
    where: {
      createdById: ctx.user.workspaceId,
      date: { gte: now },
      status: { in: ["PENDING", "SCHEDULED", "CONFIRMED"] },
    },
    orderBy: { date: "asc" },
    take: 5,
    select: {
      id: true,
      clientName: true,
      clientEmail: true,
      date: true,
      duration: true,
      status: true,
      notes: true,
    },
  });
}

async function loadExpiringDomains(ctx: WorkspaceCtx) {
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  return ctx.db.domain.findMany({
    where: {
      createdById: ctx.user.workspaceId,
      expiresAt: {
        gte: now,
        lte: thirtyDaysFromNow,
      },
      status: { in: ["ACTIVE", "EXPIRING"] },
    },
    orderBy: { expiresAt: "asc" },
    take: 5,
    select: {
      id: true,
      domainName: true,
      expiresAt: true,
      status: true,
      registrar: true,
    },
  });
}

async function loadOpenChats(ctx: WorkspaceCtx) {
  const sessions = await ctx.db.chatSession.findMany({
    where: {
      ...ownedChatSessionWhere(ctx.user.workspaceId, ctx.user.id),
      status: { in: ["OPEN", "WAITING"] },
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      id: true,
      visitorName: true,
      visitorCompany: true,
      status: true,
      isRead: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, role: true, createdAt: true },
      },
    },
  });

  return sessions.map((s) => ({
    id: s.id,
    visitorName: s.visitorName ?? "Anoniem",
    visitorCompany: s.visitorCompany,
    status: s.status,
    isRead: s.isRead,
    updatedAt: s.updatedAt,
    lastMessage: s.messages[0]?.content ?? null,
    lastMessageAt: s.messages[0]?.createdAt ?? s.updatedAt,
  }));
}

function attentionCountFromOverviewParts(
  kpis: KpiResult,
  reminders: UnifiedRemindersResult,
  expiringDomainCount: number,
): number {
  let count = 0;
  count += Math.min(kpis.pendingDrafts, 20);
  count += Math.min(kpis.approvedDrafts, 10);
  if (kpis.approvedDrafts > 10) count += 1;

  if (kpis.failedEmails > 0) {
    const shown = Math.min(kpis.failedEmails, 10);
    count += shown;
    if (kpis.failedEmails > shown) count += 1;
  }

  count += Math.min(kpis.rejectedDrafts, 10);
  if (kpis.rejectedDrafts > 10) count += 1;

  if (kpis.pendingReviews > 0) count += 1;
  if (kpis.unreadChats > 0) count += 1;
  count += reminders.items.length;
  count += Math.min(expiringDomainCount, 10);
  return count;
}

type DashboardOverviewResult = {
  kpis: KpiResult;
  attentionCount: number;
  recentActivity: Awaited<ReturnType<typeof loadRecentActivity>>;
  topLeads: Awaited<ReturnType<typeof loadTopLeads>>;
  pipelineOverview: Awaited<ReturnType<typeof loadPipelineOverview>>;
  reminders: UnifiedRemindersResult;
  upcomingBookings: Awaited<ReturnType<typeof loadUpcomingBookings>>;
  openChats: Awaited<ReturnType<typeof loadOpenChats>>;
  expiringDomains: Awaited<ReturnType<typeof loadExpiringDomains>>;
};

async function loadDashboardOverview(ctx: WorkspaceCtx): Promise<DashboardOverviewResult> {
  const cacheKey = `getOverview:${ctx.user.workspaceId}`;
  const cached = readDashboardCache<DashboardOverviewResult>(cacheKey);
  if (cached) return cached;

  const [
    kpis,
    recentActivity,
    topLeads,
    pipelineOverview,
    reminders,
    upcomingBookings,
    openChats,
    expiringDomains,
  ] = await Promise.all([
    loadKpis(ctx),
    loadRecentActivity(ctx),
    loadTopLeads(ctx),
    loadPipelineOverview(ctx),
    loadUnifiedReminders(ctx),
    loadUpcomingBookings(ctx),
    loadOpenChats(ctx),
    loadExpiringDomains(ctx),
  ]);

  const result: DashboardOverviewResult = {
    kpis,
    attentionCount: attentionCountFromOverviewParts(kpis, reminders, expiringDomains.length),
    recentActivity,
    topLeads,
    pipelineOverview,
    reminders,
    upcomingBookings,
    openChats,
    expiringDomains,
  };
  writeDashboardCache(cacheKey, result);
  return result;
}

export const dashboardRouter = router({
  getOverview: protectedProcedure.query(async ({ ctx }) => {
    return loadDashboardOverview(asWorkspaceCtx(ctx));
  }),

  getKpis: protectedProcedure.query(async ({ ctx }) => {
    return loadKpis(asWorkspaceCtx(ctx));
  }),

  getRecentActivity: protectedProcedure.query(async ({ ctx }) => {
    return loadRecentActivity(asWorkspaceCtx(ctx));
  }),

  getUnifiedReminders: protectedProcedure.query(async ({ ctx }) => {
    return loadUnifiedReminders(asWorkspaceCtx(ctx));
  }),

  getAttentionQueue: protectedProcedure.query(async ({ ctx }) => {
    const cacheKey = `getAttentionQueue:${ctx.user.workspaceId!}`;
    const cached = readDashboardCache<AttentionQueueResult>(cacheKey);
    if (cached) return cached;
    const result = await buildAttentionQueue(asWorkspaceCtx(ctx));
    writeDashboardCache(cacheKey, result);
    return result;
  }),

  getAttentionSummary: protectedProcedure.query(async ({ ctx }) => {
    const wctx = asWorkspaceCtx(ctx);
    const cacheKey = `getAttentionSummary:${wctx.user.workspaceId}`;
    const cached = readDashboardCache<{ totalCount: number }>(cacheKey);
    if (cached) return cached;

    const queueCache = readDashboardCache<AttentionQueueResult>(`getAttentionQueue:${wctx.user.workspaceId}`);
    const totalCount = queueCache
      ? queueCache.totalCount
      : await loadAttentionCountOnly(wctx);

    const result = { totalCount };
    writeDashboardCache(cacheKey, result);
    return result;
  }),

  getPipelineOverview: protectedProcedure.query(async ({ ctx }) => {
    return loadPipelineOverview(asWorkspaceCtx(ctx));
  }),

  getScoreDistribution: protectedProcedure.query(async ({ ctx }) => {
    const ranges = [
      { range: "0-20", min: 0, max: 20 },
      { range: "21-40", min: 21, max: 40 },
      { range: "41-60", min: 41, max: 60 },
      { range: "61-80", min: 61, max: 80 },
      { range: "81-100", min: 81, max: 100 },
    ];

    const counts = await Promise.all(
      ranges.map((b) =>
        ctx.db.lead.count({ where: { createdById: ctx.user.workspaceId!, overallScore: { gte: b.min, lte: b.max } } })
      )
    );

    return ranges.map((b, i) => ({ range: b.range, count: counts[i]! }));
  }),

  getLeadsByNiche: protectedProcedure.query(async ({ ctx }) => {
    const leads = await ctx.db.lead.groupBy({
      by: ["industry"],
      _count: { id: true },
      where: { industry: { not: null }, createdById: ctx.user.workspaceId! },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    return leads.map((l) => ({
      industry: l.industry || "Unknown",
      count: l._count.id,
    }));
  }),

  getLeadsByLocation: protectedProcedure.query(async ({ ctx }) => {
    const leads = await ctx.db.lead.groupBy({
      by: ["city"],
      _count: { id: true },
      where: { city: { not: null }, createdById: ctx.user.workspaceId! },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    return leads.map((l) => ({
      city: l.city || "Unknown",
      count: l._count.id,
    }));
  }),

  getLeadsNeedingFollowUp: protectedProcedure.query(async ({ ctx }) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const leads = await ctx.db.lead.findMany({
      where: {
        createdById: ctx.user.workspaceId!,
        status: { in: ["CONTACTED", "RESPONDED", "QUALIFIED"] },
        activities: {
          none: {
            createdAt: { gte: sevenDaysAgo },
          },
        },
      },
      select: {
        id: true,
        companyName: true,
        overallScore: true,
        scorePriority: true,
        status: true,
        city: true,
        activities: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true, title: true },
        },
      },
      take: 10,
      orderBy: { updatedAt: "asc" },
    });

    return leads.map((l) => {
      const lastActivity = l.activities[0]?.createdAt ?? new Date();
      const daysSince = Math.floor(
        (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: l.id,
        companyName: l.companyName,
        overallScore: l.overallScore,
        scorePriority: l.scorePriority,
        status: l.status,
        city: l.city,
        lastActivityTitle: l.activities[0]?.title ?? null,
        daysSinceLastContact: daysSince,
      };
    });
  }),

  getSavedSearchCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.db.lead.count({
      where: { source: { not: null }, createdById: ctx.user.workspaceId! },
    });
    return count;
  }),

  getTopLeads: protectedProcedure.query(async ({ ctx }) => {
    return loadTopLeads(asWorkspaceCtx(ctx));
  }),

  getQuoteStats: protectedProcedure.query(async ({ ctx }) => {
    const [draftCount, sentCount, acceptedCount, totalValue] = await Promise.all([
      ctx.db.quote.count({ where: { status: "DRAFT", createdById: ctx.user.workspaceId! } }),
      ctx.db.quote.count({ where: { status: "SENT", createdById: ctx.user.workspaceId! } }),
      ctx.db.quote.count({ where: { status: "ACCEPTED", createdById: ctx.user.workspaceId! } }),
      ctx.db.quote.aggregate({
        _sum: { total: true },
        where: { status: { in: ["DRAFT", "SENT", "VIEWED", "ACCEPTED"] }, createdById: ctx.user.workspaceId! },
      }),
    ]);

    return {
      draftCount,
      sentCount,
      acceptedCount,
      totalValue: totalValue._sum.total ?? 0,
    };
  }),

  getChatStats: protectedProcedure.query(async ({ ctx }) => {
    const [openCount, waitingCount, unreadCount] = await Promise.all([
      ctx.db.chatSession.count({ where: { ...ownedChatSessionWhere(ctx.user.workspaceId!, ctx.user.id), status: "OPEN" } }),
      ctx.db.chatSession.count({ where: { ...ownedChatSessionWhere(ctx.user.workspaceId!, ctx.user.id), status: "WAITING" } }),
      ctx.db.chatSession.count({ where: { ...ownedChatSessionWhere(ctx.user.workspaceId!, ctx.user.id), isRead: false } }),
    ]);

    return { openCount, waitingCount, unreadCount };
  }),

  getUpcomingBookings: protectedProcedure.query(async ({ ctx }) => {
    return loadUpcomingBookings(asWorkspaceCtx(ctx));
  }),

  getExpiringDomains: protectedProcedure.query(async ({ ctx }) => {
    return loadExpiringDomains(asWorkspaceCtx(ctx));
  }),

  getDomainMonitor: protectedProcedure.query(async ({ ctx }) => {
    const domains = await ctx.db.domain.findMany({
      where: { createdById: ctx.user.workspaceId! },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: {
        lead: {
          select: {
            id: true,
            companyName: true,
            enrichmentData: {
              where: {
                OR: [
                  { source: "domain_analysis" },
                  { source: { startsWith: "website_tracker:" } },
                ],
              },
              orderBy: { fetchedAt: "desc" },
              select: { source: true, data: true, fetchedAt: true },
            },
          },
        },
      },
    });

    return domains.map((domain) => {
      const analysis = domain.lead?.enrichmentData.find((item) => item.source === "domain_analysis")?.data as
        | { statusCode?: number; loadTimeMs?: number }
        | undefined;
      const tracker = domain.lead?.enrichmentData.find((item) => item.source === `website_tracker:${domain.id}`)?.data as
        | { summary?: { uniqueVisitors?: number; lastSeen?: string | null } }
        | undefined;

      const statusCode = analysis?.statusCode ?? null;
      const loadTimeMs = analysis?.loadTimeMs ?? null;
      const websiteStatus =
        statusCode === null
          ? "unknown"
          : statusCode >= 200 && statusCode < 400
            ? loadTimeMs && loadTimeMs > 3000
              ? "slow"
              : "online"
            : "offline";

      return {
        id: domain.id,
        domainName: domain.domainName,
        sslStatus: domain.sslStatus,
        websiteStatus,
        statusCode,
        loadTimeMs,
        uniqueVisitors: tracker?.summary?.uniqueVisitors ?? 0,
        lastSeen: tracker?.summary?.lastSeen ?? null,
      };
    });
  }),

  getReviewStats: protectedProcedure.query(async ({ ctx }) => {
    const [pendingCount, sentCount, reviewedCount] = await Promise.all([
      ctx.db.reviewRequest.count({ where: { status: "PENDING", createdById: ctx.user.workspaceId! } }),
      ctx.db.reviewRequest.count({ where: { status: "SENT", createdById: ctx.user.workspaceId! } }),
      ctx.db.reviewRequest.count({ where: { status: "REVIEWED", createdById: ctx.user.workspaceId! } }),
    ]);

    return { pendingCount, sentCount, reviewedCount };
  }),

  getOpenChats: protectedProcedure.query(async ({ ctx }) => {
    return loadOpenChats(asWorkspaceCtx(ctx));
  }),
});
