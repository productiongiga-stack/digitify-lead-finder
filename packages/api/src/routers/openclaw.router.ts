import { z } from "zod";
import { router, aiRateLimitedProcedure, protectedProcedure } from "../trpc";
import { OpenClawClient, type OpenClawContext } from "@digitify/openclaw";
import { normalizeAiPlaceholderSyntax } from "../lib/email-utils";
import { type PrismaClient, Prisma } from "@digitify/db";
import { loadWorkspaceSettingRows } from "../lib/workspace-settings";
import { assertLeadAccess } from "../lib/tenant";
import { generateDraftAiRewrite, generateInboxAiMessage } from "../lib/inbox-ai-reply";
import { extractEmailTemplateMetadata } from "../lib/email-content";
import { loadAiProviderConfig } from "../lib/ai-provider-config";
import { businessProfileToContext, loadAiBusinessProfile } from "../lib/ai-business-profile";
import { enqueueLeadAnalysis } from "../lib/lead-analysis";

async function getClient(db: PrismaClient, workspaceId: string): Promise<{ client: OpenClawClient | null; model: string }> {
  const { provider, model, apiKey } = await loadAiProviderConfig(db, workspaceId);
  if (!apiKey) return { client: null, model };
  return {
    client: new OpenClawClient({ apiKey, model, provider }),
    model,
  };
}

function readSettingValue(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string" || typeof parsed === "number" || typeof parsed === "boolean") {
        return String(parsed);
      }
    } catch {
      // keep raw
    }
    return raw;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

async function loadBusinessContext(db: PrismaClient, workspaceId: string) {
  const profile = await loadAiBusinessProfile(db, workspaceId);
  return {
    companyName: profile.companyName,
    profile,
    businessContext: businessProfileToContext(profile),
  };
}

export const openclawRouter = router({
  leadAnalysisStatus: protectedProcedure
    .input(z.object({ leadId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertLeadAccess(ctx.db, ctx.user.workspaceId!, input.leadId);
      const [run, suggestion] = await Promise.all([
        ctx.db.leadAnalysisRun.findFirst({ where: { workspaceId: ctx.user.workspaceId!, leadId: input.leadId }, orderBy: { createdAt: "desc" } }),
        ctx.db.openClawSuggestion.findFirst({ where: { leadId: input.leadId, type: "OPPORTUNITY_ANALYSIS" }, orderBy: { createdAt: "desc" } }),
      ]);
      return { run, suggestion };
    }),

  queueLeadAnalysis: aiRateLimitedProcedure
    .input(z.object({ leadId: z.string(), force: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      await assertLeadAccess(ctx.db, ctx.user.workspaceId!, input.leadId);
      const run = await enqueueLeadAnalysis(ctx.db, { workspaceId: ctx.user.workspaceId!, leadId: input.leadId, createdById: ctx.user.id, force: input.force });
      return { runId: run.id, status: run.status };
    }),
  chat: aiRateLimitedProcedure
    .input(
      z.object({
        messages: z.array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string(),
          })
        ),
        context: z.object({
          currentPage: z.string().optional(),
          leadId: z.string().optional(),
          campaignId: z.string().optional(),
          assistBookings: z.boolean().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { client, model } = await getClient(ctx.db, ctx.user.workspaceId!);
      if (!client) {
        return {
          response: "OpenClaw is nog niet geconfigureerd. Ga naar Instellingen → Integraties om je API key in te stellen.",
          tokensUsed: 0,
        };
      }

      // Build context from database
      const openclawContext: OpenClawContext = {
        currentPage: input.context.currentPage,
      };
      const businessContextData = await loadBusinessContext(ctx.db, ctx.user.workspaceId!);
      openclawContext.businessContext = businessContextData.businessContext;

      if (input.context.leadId) {
        const lead = await ctx.db.lead.findFirst({
          where: { id: input.context.leadId, createdById: ctx.user.workspaceId! },
          include: { scoringFactors: { include: { scoringWeight: true } } },
        });
        if (lead) {
          const painPoints = lead.scoringFactors
            .filter((f) => f.rawValue >= 6)
            .map((f) => f.explanation).filter((e): e is string => e !== null);
          const suggestedServices = lead.scoringFactors
            .filter((f) => f.rawValue >= 6)
            .map((f) => f.scoringWeight?.label ?? f.scoringWeight?.label ?? "")
            .filter(Boolean);

          openclawContext.leadData = {
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
          };
        }
      }

      if (input.context.campaignId) {
        const campaign = await ctx.db.campaign.findFirst({
          where: { id: input.context.campaignId, createdById: ctx.user.workspaceId! },
        });
        if (campaign) {
          openclawContext.campaignData = {
            name: campaign.name,
            niche: campaign.niche,
            region: campaign.region,
            toneOfVoice: campaign.toneOfVoice,
          };
        }
      }

      // Get settings for OpenClaw behavior
      const settings = await loadWorkspaceSettingRows(
        ctx.db,
        { workspaceId: ctx.user.workspaceId!, memberId: ctx.user.id },
        ["openclaw_aggressiveness", "openclaw_tone", "openclaw_language"],
      );
      const localSettingsMap = new Map(settings.map((item) => [item.key, item.value]));
      openclawContext.settings = {
        aggressiveness: readSettingValue(localSettingsMap.get("openclaw_aggressiveness"), "medium"),
        tone: readSettingValue(localSettingsMap.get("openclaw_tone"), "professional"),
        language: readSettingValue(localSettingsMap.get("openclaw_language"), "nl"),
        companyName: businessContextData.companyName,
      };

      const wantsBookingsAssist =
        input.context.assistBookings ||
        (input.context.currentPage?.includes("/settings/bookings") ?? false);
      if (wantsBookingsAssist) {
        const { buildBookingOpenClawAssistContext } = await import("../lib/booking-openclaw-context");
        openclawContext.bookingsAssist = await buildBookingOpenClawAssistContext(
          ctx.db,
          ctx.user.workspaceId!,
        );
      }

      const response = await client.chat(input.messages, openclawContext);

      // Log token usage
      await ctx.db.openClawLog.create({
        data: {
          userId: ctx.user.id,
          prompt: input.messages.map((m) => `${m.role}: ${m.content}`).join("\n"),
          response,
          model,
          tokensUsed: Math.ceil((input.messages.reduce((sum, m) => sum + m.content.length, 0) + response.length) / 4),
        },
      });

      return { response, tokensUsed: Math.ceil(response.length / 4) };
    }),

  draftEmail: aiRateLimitedProcedure
    .input(
      z.object({
        leadId: z.string(),
        campaignId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { client } = await getClient(ctx.db, ctx.user.workspaceId!);
      if (!client) {
        return { draft: null, error: "API key niet geconfigureerd. Ga naar Instellingen → Integraties." };
      }

      await assertLeadAccess(ctx.db, ctx.user.workspaceId!, input.leadId);
      const lead = await ctx.db.lead.findFirstOrThrow({
        where: { id: input.leadId, createdById: ctx.user.workspaceId! },
        include: { scoringFactors: { include: { scoringWeight: true } } },
      });

      const painPoints = lead.scoringFactors
        .filter((f) => f.rawValue >= 6)
        .map((f) => f.explanation).filter((e): e is string => e !== null);
      const suggestedServices = lead.scoringFactors
        .filter((f) => f.rawValue >= 6)
        .map((f) => f.scoringWeight?.label ?? "")
        .filter(Boolean);

      const openclawContext: OpenClawContext = {
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
      };
      const businessContextData = await loadBusinessContext(ctx.db, ctx.user.workspaceId!);
      openclawContext.businessContext = businessContextData.businessContext;
      openclawContext.settings = {
        aggressiveness: "balanced",
        tone: "professional",
        language: "nl",
        companyName: businessContextData.companyName,
      };

      if (input.campaignId) {
        const campaign = await ctx.db.campaign.findFirst({
          where: { id: input.campaignId, createdById: ctx.user.workspaceId! },
        });
        if (campaign) {
          openclawContext.campaignData = {
            name: campaign.name,
            niche: campaign.niche,
            region: campaign.region,
            toneOfVoice: campaign.toneOfVoice,
          };
        }
      }

      const suggestion = await client.draftEmail(openclawContext);
      const normalizedSuggestion = {
        ...suggestion,
        subject: normalizeAiPlaceholderSyntax(suggestion.subject),
        body: normalizeAiPlaceholderSyntax(suggestion.body),
      };

      // Create the email draft with status DRAFT — NEVER sends
      const draft = await ctx.db.emailDraft.create({
        data: {
          workspaceId: ctx.user.workspaceId!,
          leadId: input.leadId,
          toEmail: lead.email || "",
          subject: normalizedSuggestion.subject,
          body: normalizedSuggestion.body,
          status: "DRAFT",
          authorId: ctx.user.id,
        },
      });

      // Create suggestion record
      await ctx.db.openClawSuggestion.create({
        data: {
          leadId: input.leadId,
          type: "EMAIL_DRAFT",
          title: `E-mail draft: ${normalizedSuggestion.subject}`,
          content: normalizedSuggestion.reasoning,
          status: "PENDING",
          metadata: { draftId: draft.id },
        },
      });

      await ctx.db.activity.create({
        data: {
          leadId: input.leadId,
          userId: ctx.user.id,
          type: "OPENCLAW_SUGGESTION",
          title: `OpenClaw e-mail draft aangemaakt: "${normalizedSuggestion.subject}"`,
        },
      });

      return { draft, suggestion: normalizedSuggestion };
    }),

  rewriteDraft: aiRateLimitedProcedure
    .input(z.object({
      draftId: z.string(),
      style: z.string(),
      subject: z.string().optional(),
      body: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.emailDraft.findFirst({
        where: { id: input.draftId, workspaceId: ctx.user.workspaceId! },
        include: { lead: { select: { companyName: true, city: true, industry: true } } },
      });
      if (!draft) {
        return { rewritten: null, error: "Concept niet gevonden." };
      }

      const storedMeta = extractEmailTemplateMetadata(draft.body);
      const subject = input.subject?.trim() || draft.subject;
      const body = input.body?.trim() || storedMeta.cleanBody;

      return generateDraftAiRewrite(ctx.db, ctx.user.workspaceId!, {
        style: input.style,
        subject,
        body,
        recipientEmail: draft.toEmail,
        lead: draft.lead,
      });
    }),

  rewriteInboxMessage: aiRateLimitedProcedure
    .input(
      z.object({
        purpose: z.enum(["reply", "follow_up", "compose"]),
        style: z.string(),
        subject: z.string().optional(),
        body: z.string().optional(),
        incomingSubject: z.string().optional(),
        incomingBody: z.string().optional(),
        incomingHtml: z.string().optional(),
        recipientEmail: z.string().optional(),
        recipientName: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      generateInboxAiMessage(ctx.db, ctx.user.workspaceId!, {
        purpose: input.purpose,
        style: input.style,
        subject: input.subject,
        draftBody: input.body,
        incomingSubject: input.incomingSubject,
        incomingBody: input.incomingBody,
        incomingHtml: input.incomingHtml,
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName,
      }),
    ),

  analyzeLead: aiRateLimitedProcedure
    .input(z.object({ leadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await getClient(ctx.db, ctx.user.workspaceId!);
      if (!client) {
        return { analysis: null, error: "API key niet geconfigureerd. Ga naar Instellingen → Integraties." };
      }

      await assertLeadAccess(ctx.db, ctx.user.workspaceId!, input.leadId);
      const lead = await ctx.db.lead.findFirstOrThrow({
        where: { id: input.leadId, createdById: ctx.user.workspaceId! },
        include: {
          scoringFactors: { include: { scoringWeight: true } },
          enrichmentData: true,
        },
      });

      const painPoints = lead.scoringFactors
        .filter((f) => f.rawValue >= 6)
        .map((f) => f.explanation).filter((e): e is string => e !== null);
      const suggestedServices = lead.scoringFactors
        .filter((f) => f.rawValue >= 6)
        .map((f) => f.scoringWeight?.label ?? "")
        .filter(Boolean);

      const profileData = await loadBusinessContext(ctx.db, ctx.user.workspaceId!);
      const analysis = await client.analyzeLead({
        businessContext: profileData.businessContext,
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
      });

      const normalizedAnalysis = { ...analysis, confidence: analysis.confidence <= 1 ? analysis.confidence * 100 : analysis.confidence };
      await ctx.db.openClawSuggestion.create({
        data: {
          leadId: input.leadId,
          type: "OPPORTUNITY_ANALYSIS",
          title: `Analyse: ${lead.companyName}`,
          content: analysis.summary,
          confidence: normalizedAnalysis.confidence,
          status: "PENDING",
          metadata: { ...normalizedAnalysis, profileHash: profileData.profile.hash, profileVersion: profileData.profile.version } as unknown as Prisma.InputJsonValue,
        },
      });

      return { analysis: normalizedAnalysis };
    }),
});
