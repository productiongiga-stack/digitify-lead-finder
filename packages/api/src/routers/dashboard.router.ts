import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { loadUserSettingRows } from "../lib/user-settings";
import { ownedChatSessionWhere } from "../lib/tenant";

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

export const dashboardRouter = router({
  getKpis: protectedProcedure.query(async ({ ctx }) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [
      totalLeads,
      newLeads,
      hotLeads,
      contactedLeads,
      totalCampaigns,
      pendingDrafts,
      sentEmails,
      wonLeads,
      leadsWithScore,
      activeQuotes,
      totalQuoteValue,
      unreadChats,
      activeCampaignLeadCount,
      scheduledEmails,
      failedEmails,
      pendingReviews,
      contactedAndBeyondLeads,
      respondedLeads,
    ] = await Promise.all([
      ctx.db.lead.count({ where: { createdById: ctx.user.id } }),
      ctx.db.lead.count({ where: { createdById: ctx.user.id, createdAt: { gte: weekAgo } } }),
      ctx.db.lead.count({ where: { createdById: ctx.user.id, scorePriority: "Hot" } }),
      ctx.db.lead.count({ where: { createdById: ctx.user.id, status: "CONTACTED" } }),
      ctx.db.campaign.count({ where: { createdById: ctx.user.id } }),
      ctx.db.emailDraft.count({
        where: { status: "PENDING_APPROVAL", lead: { createdById: ctx.user.id } },
      }),
      ctx.db.emailDraft.count({ where: { status: "SENT", lead: { createdById: ctx.user.id } } }),
      ctx.db.lead.count({ where: { createdById: ctx.user.id, status: "WON" } }),
      ctx.db.lead.aggregate({
        _avg: { overallScore: true },
        where: { createdById: ctx.user.id, overallScore: { not: null } },
      }),
      ctx.db.quote.count({ where: { createdById: ctx.user.id, status: { in: ["DRAFT", "SENT", "VIEWED"] } } }),
      ctx.db.quote.aggregate({
        _sum: { total: true },
        where: { createdById: ctx.user.id, status: { in: ["DRAFT", "SENT", "VIEWED", "ACCEPTED"] } },
      }),
      ctx.db.chatSession.count({ where: { ...ownedChatSessionWhere(ctx.user.id), isRead: false } }),
      ctx.db.campaignLead.count({
        where: {
          campaign: {
            status: "ACTIVE",
            createdById: ctx.user.id,
          },
        },
      }),
      ctx.db.emailDraft.count({ where: { status: "SCHEDULED", lead: { createdById: ctx.user.id } } }),
      ctx.db.emailDraft.count({ where: { status: "FAILED", lead: { createdById: ctx.user.id } } }),
      ctx.db.reviewRequest.count({ where: { status: "PENDING", createdById: ctx.user.id } }),
      ctx.db.lead.count({
        where: {
          createdById: ctx.user.id,
          status: { in: ["CONTACTED", "RESPONDED", "QUALIFIED", "PROPOSAL_SENT", "WON"] },
        },
      }),
      ctx.db.lead.count({
        where: {
          createdById: ctx.user.id,
          status: { in: ["RESPONDED", "QUALIFIED", "PROPOSAL_SENT", "WON"] },
        },
      }),
    ]);

    const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
    const responseRate =
      contactedAndBeyondLeads > 0
        ? Math.round((respondedLeads / contactedAndBeyondLeads) * 100)
        : 0;

    return {
      totalLeads,
      newLeads,
      hotLeads,
      contactedLeads,
      totalCampaigns,
      pendingDrafts,
      sentEmails,
      wonLeads,
      avgScore: Math.round(leadsWithScore._avg.overallScore ?? 0),
      activeQuotes,
      totalQuoteValue: totalQuoteValue._sum.total ?? 0,
      unreadChats,
      activeCampaignLeadCount,
      scheduledEmails,
      failedEmails,
      pendingReviews,
      conversionRate,
      responseRate,
    };
  }),

  getRecentActivity: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.activity.findMany({
      where: {
        OR: [
          { userId: ctx.user.id },
          { lead: { createdById: ctx.user.id } },
        ],
      },
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        lead: { select: { id: true, companyName: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }),

  getUnifiedReminders: protectedProcedure.query(async ({ ctx }) => {
    const settings = await loadUserSettingRows(ctx.db, ctx.user.id, ["email.followup_days"]);
    const followupDays = Math.max(
      1,
      Number.parseInt(getSettingString(settings, "email.followup_days", "3"), 10) || 3,
    );
    const emailThreshold = new Date(Date.now() - followupDays * 24 * 60 * 60 * 1000);
    const quoteThreshold = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const quoteValidThreshold = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

    const [drafts, pendingBookings, staleQuotes, leadFollowUps] = await Promise.all([
      ctx.db.emailDraft.findMany({
        where: {
          status: "SENT",
          sentAt: { lte: emailThreshold },
          lead: {
            createdById: ctx.user.id,
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
          createdById: ctx.user.id,
          OR: [
            { status: "PENDING" },
            {
              status: { in: ["SCHEDULED", "CONFIRMED"] },
              date: { lte: new Date(Date.now() + 24 * 60 * 60 * 1000) },
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
          createdById: ctx.user.id,
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
          createdById: ctx.user.id,
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
        subtitle: `Status ${lead.status.toLowerCase()} vraagt nieuwe actie`,
        href: `/leads/${lead.id}`,
        dueAt: lead.updatedAt,
        tone: "rose",
      })),
    ]
      .sort((left, right) => new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime())
      .slice(0, 12);

    return { followupDays, items };
  }),

  getPipelineOverview: protectedProcedure.query(async ({ ctx }) => {
    const [stages, leadCounts] = await Promise.all([
      ctx.db.pipelineStage.findMany({
        where: { createdById: ctx.user.id },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, color: true },
      }),
      ctx.db.lead.groupBy({
        by: ["pipelineStageId"],
        _count: { id: true },
        where: { createdById: ctx.user.id, pipelineStageId: { not: null } },
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
        ctx.db.lead.count({ where: { createdById: ctx.user.id, overallScore: { gte: b.min, lte: b.max } } })
      )
    );

    return ranges.map((b, i) => ({ range: b.range, count: counts[i]! }));
  }),

  getLeadsByNiche: protectedProcedure.query(async ({ ctx }) => {
    const leads = await ctx.db.lead.groupBy({
      by: ["industry"],
      _count: { id: true },
      where: { industry: { not: null }, createdById: ctx.user.id },
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
      where: { city: { not: null }, createdById: ctx.user.id },
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
        createdById: ctx.user.id,
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
      where: { source: { not: null }, createdById: ctx.user.id },
    });
    return count;
  }),

  getTopLeads: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.lead.findMany({
      where: { overallScore: { not: null }, createdById: ctx.user.id },
      orderBy: { overallScore: "desc" },
      take: 5,
      select: {
        id: true,
        companyName: true,
        city: true,
        overallScore: true,
        scorePriority: true,
        status: true,
      },
    });
  }),

  getQuoteStats: protectedProcedure.query(async ({ ctx }) => {
    const [draftCount, sentCount, acceptedCount, totalValue] = await Promise.all([
      ctx.db.quote.count({ where: { status: "DRAFT", createdById: ctx.user.id } }),
      ctx.db.quote.count({ where: { status: "SENT", createdById: ctx.user.id } }),
      ctx.db.quote.count({ where: { status: "ACCEPTED", createdById: ctx.user.id } }),
      ctx.db.quote.aggregate({
        _sum: { total: true },
        where: { status: { in: ["DRAFT", "SENT", "VIEWED", "ACCEPTED"] }, createdById: ctx.user.id },
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
      ctx.db.chatSession.count({ where: { ...ownedChatSessionWhere(ctx.user.id), status: "OPEN" } }),
      ctx.db.chatSession.count({ where: { ...ownedChatSessionWhere(ctx.user.id), status: "WAITING" } }),
      ctx.db.chatSession.count({ where: { ...ownedChatSessionWhere(ctx.user.id), isRead: false } }),
    ]);

    return { openCount, waitingCount, unreadCount };
  }),

  getUpcomingBookings: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    return ctx.db.booking.findMany({
      where: {
        createdById: ctx.user.id,
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
  }),

  getExpiringDomains: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    return ctx.db.domain.findMany({
      where: {
        createdById: ctx.user.id,
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
  }),

  getDomainMonitor: protectedProcedure.query(async ({ ctx }) => {
    const domains = await ctx.db.domain.findMany({
      where: { createdById: ctx.user.id },
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
      ctx.db.reviewRequest.count({ where: { status: "PENDING", createdById: ctx.user.id } }),
      ctx.db.reviewRequest.count({ where: { status: "SENT", createdById: ctx.user.id } }),
      ctx.db.reviewRequest.count({ where: { status: "REVIEWED", createdById: ctx.user.id } }),
    ]);

    return { pendingCount, sentCount, reviewedCount };
  }),

  getOpenChats: protectedProcedure.query(async ({ ctx }) => {
    const sessions = await ctx.db.chatSession.findMany({
      where: {
        ...ownedChatSessionWhere(ctx.user.id),
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
  }),
});
