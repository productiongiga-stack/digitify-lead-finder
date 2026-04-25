import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { OpenClawClient, type OpenClawContext } from "@digitify/openclaw";
import { type PrismaClient } from "@digitify/db";
import { normalizeAiPlaceholderSyntax } from "../lib/email-utils";
import { sendBrandedEmail } from "../lib/email-sender";
import { getSettingString, settingsRowsToMap } from "../lib/settings";
import { loadUserSettingRows } from "../lib/user-settings";

type DripMode = "lead" | "review";

type DripSequenceRunResult = {
  sequenceId: string;
  sequenceName: string;
  campaignId: string | null;
  campaignName: string;
  mode: DripMode | "unknown";
  due: number;
  sent: number;
  failed: number;
  stopped: number;
  errors: string[];
};

function sequenceName(campaignId: string, campaignName: string, mode: DripMode) {
  return `[${campaignId}] ${campaignName} ${mode === "review" ? "Review" : "Lead"} Drip`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function statusMeansResponded(status: string) {
  return ["RESPONDED", "QUALIFIED", "WON"].includes(status);
}

function parseSequenceMeta(sequenceName: string): {
  campaignId: string | null;
  campaignName: string;
  mode: DripMode | "unknown";
} {
  const match = sequenceName.match(/^\[([^\]]+)\]\s*(.+?)\s+(Review|Lead)\s+Drip$/i);
  if (!match) {
    return {
      campaignId: null,
      campaignName: sequenceName,
      mode: "unknown",
    };
  }

  return {
    campaignId: match[1] || null,
    campaignName: match[2] || sequenceName,
    mode: match[3]?.toLowerCase() === "review" ? "review" : "lead",
  };
}

async function runScheduledSequence(params: {
  db: PrismaClient;
  sequenceId: string;
  sequenceName: string;
  activityUserId?: string;
}) : Promise<DripSequenceRunResult> {
  const { db, sequenceId, sequenceName, activityUserId } = params;
  const sequenceMeta = parseSequenceMeta(sequenceName);
  const now = new Date();
  const dueDrafts = await db.emailDraft.findMany({
    where: {
      sequenceId,
      status: "SCHEDULED",
      sequenceStep: { in: [2, 3] },
      scheduledFor: { lte: now },
    },
    include: {
      lead: {
        select: {
          id: true,
          companyName: true,
          email: true,
          status: true,
          doNotContact: true,
          emailDrafts: {
            where: { sequenceId },
            select: { repliedAt: true, status: true },
          },
        },
      },
    },
  });

  let sent = 0;
  let failed = 0;
  let stopped = 0;
  const errors: string[] = [];

  for (const draft of dueDrafts) {
    const leadResponded =
      statusMeansResponded(draft.lead.status) ||
      draft.lead.emailDrafts.some((item) => item.repliedAt !== null);

    if (draft.lead.doNotContact || leadResponded) {
      await db.emailDraft.update({
        where: { id: draft.id },
        data: {
          status: "REJECTED",
          rejectedAt: now,
          rejectionNote: "Drip gestopt: lead reageerde of niet contacteren",
        },
      });
      stopped += 1;
      continue;
    }

    const toEmail = draft.lead.email || draft.toEmail;
    if (!toEmail) {
      await db.emailDraft.update({
        where: { id: draft.id },
        data: {
          status: "FAILED",
          rejectionNote: "Geen e-mailadres",
        },
      });
      failed += 1;
      errors.push(`${draft.lead.companyName}: geen e-mailadres`);
      continue;
    }

    const sendResult = await sendBrandedEmail(db, {
      toEmail,
      subject: draft.subject,
      body: draft.body,
      recipientCompany: draft.lead.companyName,
      leadId: draft.lead.id,
      userId: activityUserId,
    });

    if (sendResult.success) {
      await db.emailDraft.update({
        where: { id: draft.id },
        data: {
          status: "SENT",
          sentAt: now,
          messageId: sendResult.messageId || null,
          rejectionNote: null,
        },
      });
      sent += 1;
    } else {
      await db.emailDraft.update({
        where: { id: draft.id },
        data: {
          status: "FAILED",
          rejectionNote: sendResult.error || "Verzenden mislukt",
        },
      });
      failed += 1;
      errors.push(`${draft.lead.companyName}: ${sendResult.error || "verzenden mislukt"}`);
    }
  }

  if (activityUserId && dueDrafts.length > 0) {
    await db.activity.create({
      data: {
        userId: activityUserId,
        type: "EMAIL_SENT",
        title: `Drip queue verwerkt (${sequenceMeta.campaignName})`,
        metadata: {
          sequenceId,
          sequenceName,
          due: dueDrafts.length,
          sent,
          failed,
          stopped,
        },
      },
    });
  }

  return {
    sequenceId,
    sequenceName,
    campaignId: sequenceMeta.campaignId,
    campaignName: sequenceMeta.campaignName,
    mode: sequenceMeta.mode,
    due: dueDrafts.length,
    sent,
    failed,
    stopped,
    errors,
  };
}

export async function runAllDueDripsWorker(
  db: PrismaClient,
  activityUserId?: string
): Promise<{
  sequences: number;
  due: number;
  sent: number;
  failed: number;
  stopped: number;
  errors: string[];
  campaigns: DripSequenceRunResult[];
}> {
  const dueSequenceRows = await db.emailDraft.findMany({
    where: {
      status: "SCHEDULED",
      sequenceId: { not: null },
      sequenceStep: { in: [2, 3] },
      scheduledFor: { lte: new Date() },
    },
    select: {
      sequenceId: true,
      sequence: {
        select: {
          name: true,
        },
      },
    },
    distinct: ["sequenceId"],
  });

  const sequenceRows = dueSequenceRows
    .filter(
      (row): row is { sequenceId: string; sequence: { name: string } } =>
        Boolean(row.sequenceId) &&
        Boolean(row.sequence?.name) &&
        parseSequenceMeta(row.sequence!.name).campaignId !== null
    );

  const campaigns: DripSequenceRunResult[] = [];
  let due = 0;
  let sent = 0;
  let failed = 0;
  let stopped = 0;
  const errors: string[] = [];

  for (const row of sequenceRows) {
    const result = await runScheduledSequence({
      db,
      sequenceId: row.sequenceId,
      sequenceName: row.sequence.name,
      activityUserId,
    });
    campaigns.push(result);
    due += result.due;
    sent += result.sent;
    failed += result.failed;
    stopped += result.stopped;
    errors.push(...result.errors);
  }

  return {
    sequences: campaigns.length,
    due,
    sent,
    failed,
    stopped,
    errors,
    campaigns,
  };
}

function buildReviewStep(step: number) {
  if (step === 1) {
    return {
      subject: "Korte vraag over je ervaring met ons",
      body: [
        "Beste {{contactName}},",
        "",
        "Dankjewel voor de samenwerking met {{senderCompany}}.",
        "Ik hoor graag hoe je onze service ervaren hebt.",
        "",
        "Met vriendelijke groeten,",
        "{{senderName}}",
      ].join("\n"),
    };
  }

  if (step === 2) {
    return {
      subject: "Korte opvolging over je ervaring",
      body: [
        "Beste {{contactName}},",
        "",
        "Even een korte opvolging op mijn vorige bericht.",
        "Heb je 1 minuut om je ervaring te delen? Dat helpt ons enorm.",
        "",
        "Alvast bedankt!",
        "{{senderName}}",
      ].join("\n"),
    };
  }

  return {
    subject: "Laatste herinnering",
    body: [
      "Beste {{contactName}},",
      "",
      "Dit is mijn laatste korte herinnering.",
      "Als je even feedback wil delen, hoor ik het heel graag.",
      "",
      "Bedankt voor je tijd.",
      "{{senderName}}",
    ].join("\n"),
  };
}

function buildLeadFollowUpStep(baseSubject: string, step: number) {
  if (step === 2) {
    return {
      subject: `Opvolging: ${baseSubject}`,
      body: [
        "Beste {{contactName}},",
        "",
        "Ik volg even kort op over mijn eerdere bericht.",
        "Denk je dat dit momenteel relevant is voor {{companyName}}?",
        "",
        "Als je wil, plan ik meteen een kort gesprek in.",
        "",
        "Vriendelijke groeten,",
        "{{senderName}}",
      ].join("\n"),
    };
  }

  return {
    subject: `Laatste opvolging: ${baseSubject}`,
    body: [
      "Beste {{contactName}},",
      "",
      "Ik laat nog één laatste bericht na.",
      "Als dit nu geen prioriteit is, geen probleem.",
      "Laat gerust weten wanneer het beter past voor {{companyName}}.",
      "",
      "Vriendelijke groeten,",
      "{{senderName}}",
    ].join("\n"),
  };
}

async function getOpenClawClient(db: PrismaClient, userId: string): Promise<{ client: OpenClawClient | null }> {
  const rows = await loadUserSettingRows(db, userId, ["api.ai_provider", "openclaw.model", "api.anthropic_key", "api.openai_key"]);
  const settings = settingsRowsToMap(rows);
  const provider = getSettingString(settings, "api.ai_provider", "anthropic");
  const model = getSettingString(settings, "openclaw.model", "claude-sonnet-4-20250514");
  const apiKey =
    provider === "openai"
      ? getSettingString(settings, "api.openai_key", process.env.OPENAI_API_KEY || "")
      : getSettingString(settings, "api.anthropic_key", process.env.ANTHROPIC_API_KEY || "");

  if (!apiKey.trim()) return { client: null };
  return { client: new OpenClawClient({ apiKey: apiKey.trim(), model }) };
}

async function ensureCampaignSequence(
  db: PrismaClient,
  params: { campaignId: string; campaignName: string; mode: DripMode }
) {
  const name = sequenceName(params.campaignId, params.campaignName, params.mode);
  const existing = await db.emailSequence.findFirst({ where: { name } });
  if (existing) return existing;

  return db.emailSequence.create({
    data: {
      name,
      description:
        params.mode === "review"
          ? "Review drip (3 stappen: contact, opvolging, laatste keer)"
          : "Lead drip (3 stappen: contact, opvolging, laatste keer)",
      steps: [
        { step: 1, label: "Contact", delayDays: 0 },
        { step: 2, label: "Opvolging", delayDays: 4 },
        { step: 3, label: "Laatste keer", delayDays: 8 },
      ],
      isActive: true,
    },
  });
}

function buildOpenclawContext(lead: any, campaign: any): OpenClawContext {
  const painPoints = (lead.scoringFactors || [])
    .filter((f: any) => f.rawValue >= 6)
    .map((f: any) => f.explanation)
    .filter((e: any): e is string => Boolean(e));
  const suggestedServices = (lead.scoringFactors || [])
    .filter((f: any) => f.rawValue >= 6)
    .map((f: any) => f.scoringWeight?.label)
    .filter((label: any): label is string => Boolean(label));

  return {
    leadData: {
      companyName: lead.companyName,
      website: lead.website,
      city: lead.city,
      industry: lead.industry,
      overallScore: lead.overallScore,
      scorePriority: lead.scorePriority,
      gmbRating: lead.gmbRating ? Number(lead.gmbRating) : null,
      gmbReviewCount: lead.gmbReviewCount,
      painPoints,
      suggestedServices,
    },
    campaignData: {
      name: campaign.name,
      niche: campaign.niche,
      region: campaign.region,
      toneOfVoice: campaign.toneOfVoice,
    },
  };
}

export const campaignRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.campaign.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { campaignLeads: true, templates: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.id },
        include: {
          createdBy: { select: { id: true, name: true } },
          templates: true,
          campaignLeads: {
            include: {
              lead: {
                include: {
                  tags: { include: { tag: true } },
                  emailDrafts: {
                    orderBy: { createdAt: "desc" },
                    select: {
                      id: true,
                      status: true,
                      subject: true,
                      sequenceId: true,
                      sequenceStep: true,
                      scheduledFor: true,
                      sentAt: true,
                      repliedAt: true,
                      createdAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });

      const sequenceIds = (
        await ctx.db.emailSequence.findMany({
          where: { name: { startsWith: `[${campaign.id}]` } },
          select: { id: true },
        })
      ).map((sequence) => sequence.id);

      if (sequenceIds.length === 0) return campaign;
      const sequenceIdSet = new Set(sequenceIds);

      return {
        ...campaign,
        campaignLeads: campaign.campaignLeads.map((campaignLead) => ({
          ...campaignLead,
          lead: {
            ...campaignLead.lead,
            emailDrafts: campaignLead.lead.emailDrafts.filter(
              (draft) => draft.sequenceId && sequenceIdSet.has(draft.sequenceId)
            ),
          },
        })),
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        niche: z.string().optional(),
        region: z.string().optional(),
        targetAudience: z.string().optional(),
        idealScore: z.number().optional(),
        desiredServices: z.array(z.string()).default([]),
        toneOfVoice: z.string().optional(),
        goal: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.db.campaign.create({
        data: {
          ...input,
          createdById: ctx.user.id,
        },
      });

      await ctx.db.activity.create({
        data: {
          userId: ctx.user.id,
          type: "CAMPAIGN_CREATED",
          title: `Campagne "${campaign.name}" aangemaakt`,
        },
      });

      return campaign;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        niche: z.string().nullable().optional(),
        region: z.string().nullable().optional(),
        targetAudience: z.string().nullable().optional(),
        idealScore: z.number().nullable().optional(),
        desiredServices: z.array(z.string()).optional(),
        toneOfVoice: z.string().nullable().optional(),
        goal: z.string().nullable().optional(),
        status: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.campaign.update({ where: { id }, data: data as any });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.campaign.delete({ where: { id: input.id } });
      return { success: true };
    }),

  addLeads: protectedProcedure
    .input(z.object({ campaignId: z.string(), leadIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.campaignLead.createMany({
        data: input.leadIds.map((leadId) => ({
          campaignId: input.campaignId,
          leadId,
        })),
        skipDuplicates: true,
      });
      return { added: result.count };
    }),

  removeLeads: protectedProcedure
    .input(z.object({ campaignId: z.string(), leadIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db.campaignLead.deleteMany({
        where: {
          campaignId: input.campaignId,
          leadId: { in: input.leadIds },
        },
      });
      return { removed: deleted.count };
    }),

  getStats: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.id },
        include: {
          campaignLeads: {
            include: {
              lead: {
                select: {
                  id: true,
                  overallScore: true,
                  status: true,
                  emailDrafts: {
                    select: { id: true, status: true, sequenceStep: true, sequenceId: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });

      const sequenceIds = (
        await ctx.db.emailSequence.findMany({
          where: {
            name: {
              startsWith: `[${campaign.id}]`,
            },
          },
          select: { id: true },
        })
      ).map((s) => s.id);

      const sequenceIdSet = new Set(sequenceIds);
      const leads = campaign.campaignLeads.map((cl) => cl.lead);
      const totalLeads = leads.length;
      const scores = leads
        .map((l) => l.overallScore)
        .filter((s): s is number => s !== null);
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

      const allDrafts = leads
        .flatMap((l) => l.emailDrafts)
        .filter((d) => !d.sequenceId || sequenceIdSet.size === 0 || sequenceIdSet.has(d.sequenceId));

      const emailsDraft = allDrafts.filter((d) => d.status === "DRAFT").length;
      const emailsScheduled = allDrafts.filter((d) => d.status === "SCHEDULED").length;
      const emailsSent = allDrafts.filter((d) => d.status === "SENT").length;
      const emailsFailed = allDrafts.filter((d) => d.status === "FAILED").length;
      const emailsApproved = allDrafts.filter((d) => d.status === "APPROVED").length;

      const stepBreakdown = {
        step1: allDrafts.filter((d) => d.sequenceStep === 1).length,
        step2: allDrafts.filter((d) => d.sequenceStep === 2).length,
        step3: allDrafts.filter((d) => d.sequenceStep === 3).length,
      };

      const statusBreakdown: Record<string, number> = {};
      leads.forEach((l) => {
        statusBreakdown[l.status] = (statusBreakdown[l.status] || 0) + 1;
      });

      return {
        totalLeads,
        avgScore: Math.round(avgScore),
        emailsDraft,
        emailsScheduled,
        emailsSent,
        emailsFailed,
        emailsApproved,
        stepBreakdown,
        statusBreakdown,
      };
    }),

  generateDrafts: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        mode: z.enum(["lead", "review"]).default("lead"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const mode = input.mode as DripMode;
      const { client } = await getOpenClawClient(ctx.db, ctx.user.id);
      if (mode === "lead" && !client) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "API key niet geconfigureerd. Ga naar Instellingen -> Integraties.",
        });
      }

      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.campaignId },
        include: {
          campaignLeads: {
            include: {
              lead: {
                include: {
                  emailDrafts: {
                    select: { id: true, sequenceId: true, sequenceStep: true },
                  },
                  scoringFactors: { include: { scoringWeight: true } },
                },
              },
            },
          },
        },
      });

      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
      if (campaign.createdById !== ctx.user.id && !["OWNER", "ADMIN"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Geen toegang tot deze campagne." });
      }
      const sequence = await ensureCampaignSequence(ctx.db, {
        campaignId: campaign.id,
        campaignName: campaign.name,
        mode,
      });

      let generated = 0;
      let skippedExisting = 0;
      const errors: string[] = [];

      for (const campaignLead of campaign.campaignLeads) {
        const lead = campaignLead.lead;
        if (!lead.email) {
          errors.push(`${lead.companyName}: geen e-mailadres`);
          continue;
        }

        const existingStep1 = lead.emailDrafts.find(
          (draft) => draft.sequenceId === sequence.id && draft.sequenceStep === 1
        );
        if (existingStep1) {
          skippedExisting += 1;
          continue;
        }

        try {
          let subject = "";
          let body = "";

          if (mode === "review") {
            const review = buildReviewStep(1);
            subject = review.subject;
            body = review.body;
          } else {
            const suggestion = await client!.draftEmail(buildOpenclawContext(lead, campaign));
            subject = normalizeAiPlaceholderSyntax(suggestion.subject);
            body = normalizeAiPlaceholderSyntax(suggestion.body);
          }

          await ctx.db.emailDraft.create({
            data: {
              leadId: lead.id,
              toEmail: lead.email,
              subject,
              body,
              status: "DRAFT",
              authorId: ctx.user.id,
              sequenceId: sequence.id,
              sequenceStep: 1,
              scheduledFor: new Date(),
            },
          });

          await ctx.db.activity.create({
            data: {
              leadId: lead.id,
              userId: ctx.user.id,
              type: "EMAIL_DRAFTED",
              title: `Stap 1 draft aangemaakt via campagne "${campaign.name}"`,
            },
          });
          generated += 1;
        } catch (err: any) {
          errors.push(`${lead.companyName}: ${err.message}`);
        }
      }

      return {
        generated,
        skippedExisting,
        total: campaign.campaignLeads.length,
        errors,
      };
    }),

  activateAll: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        mode: z.enum(["lead", "review"]).default("lead"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const mode = input.mode as DripMode;
      const { client } = await getOpenClawClient(ctx.db, ctx.user.id);

      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.campaignId },
        include: {
          campaignLeads: {
            include: {
              lead: {
                include: {
                  scoringFactors: { include: { scoringWeight: true } },
                  emailDrafts: {
                    select: {
                      id: true,
                      status: true,
                      subject: true,
                      body: true,
                      toEmail: true,
                      sequenceId: true,
                      sequenceStep: true,
                      sentAt: true,
                      repliedAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
      if (campaign.createdById !== ctx.user.id && !["OWNER", "ADMIN"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Geen toegang tot deze campagne." });
      }
      const sequence = await ensureCampaignSequence(ctx.db, {
        campaignId: campaign.id,
        campaignName: campaign.name,
        mode,
      });

      const now = new Date();
      let generatedStep1 = 0;
      let generatedStep2 = 0;
      let generatedStep3 = 0;
      let sentStep1 = 0;
      let failed = 0;
      let skippedResponded = 0;
      const errors: string[] = [];

      for (const campaignLead of campaign.campaignLeads) {
        const lead = campaignLead.lead;
        if (!lead.email || lead.doNotContact) {
          errors.push(`${lead.companyName}: geen geldig e-mailadres of niet contacteren`);
          continue;
        }

        const leadResponded =
          statusMeansResponded(lead.status) ||
          lead.emailDrafts.some(
            (d) => d.sequenceId === sequence.id && (d.repliedAt !== null || d.status === "BOUNCED")
          );

        if (leadResponded) {
          skippedResponded += 1;
          continue;
        }

        const sequenceDrafts = lead.emailDrafts.filter((d) => d.sequenceId === sequence.id);
        let step1Draft = sequenceDrafts.find((d) => d.sequenceStep === 1);
        let step2Draft = sequenceDrafts.find((d) => d.sequenceStep === 2);
        let step3Draft = sequenceDrafts.find((d) => d.sequenceStep === 3);

        if (!step1Draft) {
          try {
            let subject = "";
            let body = "";
            if (mode === "review") {
              const review = buildReviewStep(1);
              subject = review.subject;
              body = review.body;
            } else if (client) {
              const aiDraft = await client.draftEmail(buildOpenclawContext(lead, campaign));
              subject = normalizeAiPlaceholderSyntax(aiDraft.subject);
              body = normalizeAiPlaceholderSyntax(aiDraft.body);
            } else {
              subject = `Even kennismaken met ${lead.companyName}`;
              body = [
                "Beste {{contactName}},",
                "",
                "Ik neem graag kort contact op om te bekijken hoe we {{companyName}} kunnen helpen.",
                "Past een kort gesprek deze week?",
                "",
                "Vriendelijke groeten,",
                "{{senderName}}",
              ].join("\n");
            }

            step1Draft = await ctx.db.emailDraft.create({
              data: {
                leadId: lead.id,
                toEmail: lead.email,
                subject,
                body,
                status: "DRAFT",
                authorId: ctx.user.id,
                sequenceId: sequence.id,
                sequenceStep: 1,
                scheduledFor: now,
              },
            });
            generatedStep1 += 1;
          } catch (error: any) {
            errors.push(`${lead.companyName} (stap 1): ${error.message}`);
            failed += 1;
            continue;
          }
        }

        const baseSubject = step1Draft.subject || `Contact: ${lead.companyName}`;

        if (!step2Draft) {
          const step2 =
            mode === "review" ? buildReviewStep(2) : buildLeadFollowUpStep(baseSubject, 2);
          await ctx.db.emailDraft.create({
            data: {
              leadId: lead.id,
              toEmail: lead.email,
              subject: step2.subject,
              body: step2.body,
              status: "SCHEDULED",
              authorId: ctx.user.id,
              sequenceId: sequence.id,
              sequenceStep: 2,
              scheduledFor: addDays(now, 4),
            },
          });
          generatedStep2 += 1;
        }

        if (!step3Draft) {
          const step3 =
            mode === "review" ? buildReviewStep(3) : buildLeadFollowUpStep(baseSubject, 3);
          await ctx.db.emailDraft.create({
            data: {
              leadId: lead.id,
              toEmail: lead.email,
              subject: step3.subject,
              body: step3.body,
              status: "SCHEDULED",
              authorId: ctx.user.id,
              sequenceId: sequence.id,
              sequenceStep: 3,
              scheduledFor: addDays(now, 8),
            },
          });
          generatedStep3 += 1;
        }

        // Atomically claim the draft for sending — prevents race condition if activateAll runs concurrently
        const claimed = await ctx.db.emailDraft.updateMany({
          where: { id: step1Draft.id, status: { notIn: ["SENT", "SENDING"] } },
          data: { status: "SENDING" },
        });

        if (claimed.count > 0) {
          const sendResult = await sendBrandedEmail(ctx.db, {
            toEmail: lead.email,
            subject: step1Draft.subject,
            body: step1Draft.body,
            recipientCompany: lead.companyName,
            leadId: lead.id,
            userId: ctx.user.id,
          });

          if (sendResult.success) {
            await ctx.db.emailDraft.update({
              where: { id: step1Draft.id },
              data: {
                status: "SENT",
                sentAt: now,
                messageId: sendResult.messageId || null,
                rejectionNote: null,
              },
            });
            sentStep1 += 1;
          } else {
            await ctx.db.emailDraft.update({
              where: { id: step1Draft.id },
              data: {
                status: "FAILED",
                rejectionNote: sendResult.error || "Verzenden mislukt",
              },
            });
            failed += 1;
            errors.push(`${lead.companyName} (verzenden stap 1): ${sendResult.error || "mislukt"}`);
          }
        }
      }

      await ctx.db.campaign.update({
        where: { id: campaign.id },
        data: { status: "ACTIVE" },
      });

      await ctx.db.activity.create({
        data: {
          userId: ctx.user.id,
          type: "CAMPAIGN_CREATED",
          title: `Campagne "${campaign.name}" geactiveerd (${mode} drip)`,
          metadata: {
            generatedStep1,
            generatedStep2,
            generatedStep3,
            sentStep1,
            failed,
            skippedResponded,
            totalLeads: campaign.campaignLeads.length,
          },
        },
      });

      return {
        totalLeads: campaign.campaignLeads.length,
        generatedStep1,
        generatedStep2,
        generatedStep3,
        sentStep1,
        failed,
        skippedResponded,
        errors,
      };
    }),

  runDueDrip: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        mode: z.enum(["lead", "review"]).default("lead"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const mode = input.mode as DripMode;
      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.campaignId },
        select: { id: true, name: true },
      });
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });

      const sequence = await ensureCampaignSequence(ctx.db, {
        campaignId: campaign.id,
        campaignName: campaign.name,
        mode,
      });

      const result = await runScheduledSequence({
        db: ctx.db,
        sequenceId: sequence.id,
        sequenceName: sequence.name,
        activityUserId: ctx.user.id,
      });

      return {
        due: result.due,
        sent: result.sent,
        failed: result.failed,
        stopped: result.stopped,
        errors: result.errors,
      };
    }),

  runAllDueDrip: protectedProcedure.mutation(async ({ ctx }) => {
    return runAllDueDripsWorker(ctx.db, ctx.user.id);
  }),

  searchLeads: protectedProcedure
    .input(z.object({ query: z.string().min(1), excludeCampaignId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const leads = await ctx.db.lead.findMany({
        where: {
          companyName: { contains: input.query, mode: "insensitive" },
          ...(input.excludeCampaignId
            ? {
                campaignLeads: {
                  none: { campaignId: input.excludeCampaignId },
                },
              }
            : {}),
        },
        take: 30,
        select: {
          id: true,
          companyName: true,
          city: true,
          overallScore: true,
          status: true,
          email: true,
        },
        orderBy: { companyName: "asc" },
      });
      return leads;
    }),
});
