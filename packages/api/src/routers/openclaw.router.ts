import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { OpenClawClient, type OpenClawContext } from "@digitify/openclaw";
import { normalizeAiPlaceholderSyntax } from "../lib/email-utils";
import { type PrismaClient } from "@digitify/db";
import { getSettingString, settingsRowsToMap } from "../lib/settings";
import { loadUserSettingRows } from "../lib/user-settings";
import { assertLeadAccess } from "../lib/tenant";

async function getClient(db: PrismaClient, userId: string): Promise<{ client: OpenClawClient | null; model: string }> {
  const rows = await loadUserSettingRows(db, userId, ["api.ai_provider", "openclaw.model", "api.anthropic_key", "api.openai_key"]);
  const settings = settingsRowsToMap(rows);
  const provider = getSettingString(settings, "api.ai_provider", "anthropic");
  const model = getSettingString(settings, "openclaw.model", "claude-sonnet-4-20250514");
  const apiKey =
    provider === "openai"
      ? getSettingString(settings, "api.openai_key", process.env.OPENAI_API_KEY || "")
      : getSettingString(settings, "api.anthropic_key", process.env.ANTHROPIC_API_KEY || "");

  if (!apiKey.trim()) return { client: null, model };
  return { client: new OpenClawClient({ apiKey: apiKey.trim(), model }), model };
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

function splitLines(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function loadBusinessContext(db: PrismaClient, userId: string) {
  const rows = await loadUserSettingRows(db, userId, [
    "branding.company_name",
    "company.name",
    "company.niche",
    "company.website",
    "company.email",
    "company.phone",
    "chatbot.training_notes",
    "chatbot.knowledge_pages",
    "chatbot.response_style",
    "openclaw.business_context",
  ]);
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const companyName =
    readSettingValue(map.get("branding.company_name")) ||
    readSettingValue(map.get("company.name")) ||
    "Digitify";

  const services = splitLines(readSettingValue(map.get("openclaw.business_context"))).slice(0, 30);
  const knowledgePages = splitLines(readSettingValue(map.get("chatbot.knowledge_pages"))).slice(0, 20);

  return {
    companyName,
    businessContext: {
      companyDescription: readSettingValue(map.get("chatbot.training_notes")).slice(0, 2000),
      services,
      website: readSettingValue(map.get("company.website")).slice(0, 200),
      contactEmail: readSettingValue(map.get("company.email")).slice(0, 254),
      contactPhone: readSettingValue(map.get("company.phone")).slice(0, 50),
      niche: readSettingValue(map.get("company.niche")).slice(0, 200),
      responseStyle: readSettingValue(map.get("chatbot.response_style")).slice(0, 500),
      knowledgePages,
    },
  };
}

export const openclawRouter = router({
  chat: protectedProcedure
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
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { client, model } = await getClient(ctx.db, ctx.user.id);
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
      const businessContextData = await loadBusinessContext(ctx.db, ctx.user.id);
      openclawContext.businessContext = businessContextData.businessContext;

      if (input.context.leadId) {
        const lead = await ctx.db.lead.findFirst({
          where: { id: input.context.leadId, createdById: ctx.user.id },
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
          where: { id: input.context.campaignId, createdById: ctx.user.id },
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
      const settings = await loadUserSettingRows(ctx.db, ctx.user.id, ["openclaw_aggressiveness", "openclaw_tone", "openclaw_language"]);
      const localSettingsMap = new Map(settings.map((item) => [item.key, item.value]));
      openclawContext.settings = {
        aggressiveness: readSettingValue(localSettingsMap.get("openclaw_aggressiveness"), "medium"),
        tone: readSettingValue(localSettingsMap.get("openclaw_tone"), "professional"),
        language: readSettingValue(localSettingsMap.get("openclaw_language"), "nl"),
        companyName: businessContextData.companyName,
      };

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

  draftEmail: protectedProcedure
    .input(
      z.object({
        leadId: z.string(),
        campaignId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { client } = await getClient(ctx.db, ctx.user.id);
      if (!client) {
        return { draft: null, error: "API key niet geconfigureerd. Ga naar Instellingen → Integraties." };
      }

      await assertLeadAccess(ctx.db, ctx.user.id, input.leadId);
      const lead = await ctx.db.lead.findFirstOrThrow({
        where: { id: input.leadId, createdById: ctx.user.id },
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
      const businessContextData = await loadBusinessContext(ctx.db, ctx.user.id);
      openclawContext.businessContext = businessContextData.businessContext;
      openclawContext.settings = {
        aggressiveness: "balanced",
        tone: "professional",
        language: "nl",
        companyName: businessContextData.companyName,
      };

      if (input.campaignId) {
        const campaign = await ctx.db.campaign.findFirst({
          where: { id: input.campaignId, createdById: ctx.user.id },
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

  rewriteDraft: protectedProcedure
    .input(z.object({
      draftId: z.string(),
      style: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await getClient(ctx.db, ctx.user.id);
      if (!client) {
        return { rewritten: null, error: "API key niet geconfigureerd." };
      }

      const draft = await ctx.db.emailDraft.findFirstOrThrow({
        where: { id: input.draftId, lead: { createdById: ctx.user.id } },
        include: { lead: { select: { companyName: true, city: true, industry: true } } },
      });

      const prompt = `Herschrijf deze e-mail in een "${input.style}" stijl.

Huidige onderwerp: ${draft.subject}
Huidige body:
${draft.body}

Lead context: ${draft.lead.companyName} uit ${draft.lead.city || "onbekend"}, sector: ${draft.lead.industry || "onbekend"}.

BELANGRIJK:
- Behoud de kernboodschap
- Behoud bestaande {{...}} placeholders exact zoals ze al in de tekst staan
- Gebruik voor afzendergegevens indien nodig alleen: {{senderName}}, {{senderTitle}}, {{senderCompany}}, {{senderEmail}}, {{senderPhone}}
- Gebruik GEEN legacy placeholders zoals [Je naam] of [Je functie]
- Schrijf de volledige tekst klaar voor verzending
- Geef je antwoord in dit formaat:
ONDERWERP: [nieuwe onderwerpregel]
---
[nieuwe e-mail body]
---`;

      const response = await client.chat(
        [{ role: "user", content: prompt }],
        {
          leadData: {
            companyName: draft.lead.companyName,
            website: null,
            city: draft.lead.city,
            industry: draft.lead.industry,
            overallScore: null,
            scorePriority: null,
            gmbRating: null,
            gmbReviewCount: null,
          },
          businessContext: (await loadBusinessContext(ctx.db, ctx.user.id)).businessContext,
        }
      );

      const subjectMatch = response.match(/ONDERWERP:\s*(.+)/);
      const bodyMatch = response.match(/---\n([\s\S]*?)\n---/);

      return {
        rewritten: {
          subject: normalizeAiPlaceholderSyntax(subjectMatch?.[1]?.trim() || draft.subject),
          body: normalizeAiPlaceholderSyntax(bodyMatch?.[1]?.trim() || response),
        },
        error: null,
      };
    }),

  analyzeLead: protectedProcedure
    .input(z.object({ leadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { client } = await getClient(ctx.db, ctx.user.id);
      if (!client) {
        return { analysis: null, error: "API key niet geconfigureerd. Ga naar Instellingen → Integraties." };
      }

      await assertLeadAccess(ctx.db, ctx.user.id, input.leadId);
      const lead = await ctx.db.lead.findFirstOrThrow({
        where: { id: input.leadId, createdById: ctx.user.id },
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

      const analysis = await client.analyzeLead({
        businessContext: (await loadBusinessContext(ctx.db, ctx.user.id)).businessContext,
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

      await ctx.db.openClawSuggestion.create({
        data: {
          leadId: input.leadId,
          type: "OPPORTUNITY_ANALYSIS",
          title: `Analyse: ${lead.companyName}`,
          content: analysis.summary,
          confidence: analysis.confidence,
          status: "PENDING",
          metadata: analysis as any,
        },
      });

      return { analysis };
    }),
});
