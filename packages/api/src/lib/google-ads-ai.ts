import type { PrismaClient } from "@digitify/db";
import { getSettingString, settingsRowsToMap } from "./settings";
import { loadWorkspaceSettingRows } from "./workspace-settings";
import { extractJsonFromAiResponse } from "./meta-ads-ai";

export async function loadGoogleAdsAiContext(db: PrismaClient, workspaceId: string) {
  const rows = await loadWorkspaceSettingRows(db, { workspaceId, memberId: workspaceId }, [
    "branding.company_name",
    "company.name",
    "company.website",
    "company.email",
    "chatbot.training_notes",
    "chatbot.response_style",
    "chatbot.knowledge_pages",
    "openclaw.business_context",
  ]);
  const settings = settingsRowsToMap(rows);
  const companyName =
    getSettingString(settings, "branding.company_name") ||
    getSettingString(settings, "company.name", "Digitify");
  const services = getSettingString(settings, "openclaw.business_context", "")
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 30);
  const knowledgePages = getSettingString(settings, "chatbot.knowledge_pages", "")
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);

  return {
    companyName,
    website: getSettingString(settings, "company.website", ""),
    responseStyle: getSettingString(settings, "chatbot.response_style", "professioneel"),
    trainingNotes: getSettingString(settings, "chatbot.training_notes", "").slice(0, 4000),
    businessContext: {
      companyDescription: getSettingString(settings, "chatbot.training_notes", "").slice(0, 2000),
      services,
      website: getSettingString(settings, "company.website", ""),
      contactEmail: getSettingString(settings, "company.email", ""),
      responseStyle: getSettingString(settings, "chatbot.response_style", "professioneel"),
      knowledgePages,
    },
  };
}

export function buildGoogleCampaignSystemPrompt(input: {
  trainingNotes: string;
  responseStyle: string;
  companyName: string;
  campaignType: "SEARCH" | "PERFORMANCE_MAX";
}) {
  return (
    `Je bent een Google Ads specialist voor Belgische KMO's (${input.companyName}). ` +
    `Je schrijft drafts voor ${input.campaignType === "PERFORMANCE_MAX" ? "Performance Max" : "Search"} campagnes. ` +
    "Geef ALLEEN geldige JSON terug, zonder markdown of uitleg. " +
    "Headlines max 30 tekens (min 3, max 15). Descriptions max 90 tekens (min 2). " +
    "Long headlines max 90 tekens voor Performance Max. " +
    "Keywords: relevante Nederlandse zoektermen voor België. " +
    "finalUrl moet https:// zijn. " +
    `Tone of voice: ${input.responseStyle}. ` +
    (input.trainingNotes.trim() ? `Chatbot / workspace training:\n${input.trainingNotes.trim()}\n` : "")
  );
}

export function buildGoogleCampaignUserPrompt(input: {
  product: string;
  audience?: string;
  tone?: string;
  campaignType: "SEARCH" | "PERFORMANCE_MAX";
  website?: string;
}) {
  return (
    `Maak een Google Ads campagne-draft als JSON met exact deze velden:\n` +
    `{\n` +
    `  "name": string,\n` +
    `  "campaignType": "${input.campaignType}",\n` +
    `  "creatives": {\n` +
    `    "finalUrl": string,\n` +
    `    "headlines": string[],\n` +
    `    "descriptions": string[],\n` +
    `    "longHeadlines": string[],\n` +
    `    "path1": string,\n` +
    `    "path2": string\n` +
    `  },\n` +
    `  "targeting": {\n` +
    `    "keywords": string[],\n` +
    `    "negativeKeywords": string[],\n` +
    `    "adGroupName": string,\n` +
    `    "geoTargetConstants": string[],\n` +
    `    "languageConstants": string[]\n` +
    `  },\n` +
    `  "keywordBrief": string,\n` +
    `  "imageBrief": string\n` +
    `}\n` +
    `Product/dienst: ${input.product}\n` +
    `Doelgroep: ${input.audience || "Belgische KMO-eigenaars en zaakvoerders"}\n` +
    `Tone: ${input.tone || "professioneel"}\n` +
    `Website: ${input.website || "https://leads.digitify.be"}`
  );
}

function asStringArray(value: unknown, maxItems: number, maxChars?: number) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return source
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map((item) => (maxChars ? item.slice(0, maxChars) : item))
    .slice(0, maxItems);
}

export function normalizeGoogleCampaignSuggestion(
  parsed: Record<string, unknown> | null,
  fallback: Record<string, unknown>,
) {
  if (!parsed) return { payload: fallback, aiUsed: false };

  const creativesRaw = parsed.creatives && typeof parsed.creatives === "object" ? (parsed.creatives as Record<string, unknown>) : {};
  const targetingRaw = parsed.targeting && typeof parsed.targeting === "object" ? (parsed.targeting as Record<string, unknown>) : {};
  const fallbackCreatives = (fallback.creatives || {}) as Record<string, unknown>;
  const fallbackTargeting = (fallback.targeting || {}) as Record<string, unknown>;

  const creatives = {
    ...fallbackCreatives,
    ...creativesRaw,
    finalUrl: String(creativesRaw.finalUrl || creativesRaw.linkUrl || fallbackCreatives.finalUrl || "https://leads.digitify.be"),
    headlines: asStringArray(creativesRaw.headlines || creativesRaw.headline, 15, 30),
    descriptions: asStringArray(creativesRaw.descriptions || creativesRaw.description, 5, 90),
    longHeadlines: asStringArray(creativesRaw.longHeadlines || creativesRaw.longHeadline, 5, 90),
    path1: String(creativesRaw.path1 || "").slice(0, 15),
    path2: String(creativesRaw.path2 || "").slice(0, 15),
  };

  if (creatives.headlines.length < 3) {
    creatives.headlines = asStringArray(fallbackCreatives.headlines, 15, 30);
  }
  if (creatives.descriptions.length < 2) {
    creatives.descriptions = asStringArray(fallbackCreatives.descriptions, 5, 90);
  }

  const targeting = {
    ...fallbackTargeting,
    ...targetingRaw,
    keywords: asStringArray(targetingRaw.keywords || targetingRaw.keyword, 80),
    negativeKeywords: asStringArray(targetingRaw.negativeKeywords, 80),
    adGroupName: String(targetingRaw.adGroupName || fallbackTargeting.adGroupName || "").trim(),
    geoTargetConstants: asStringArray(targetingRaw.geoTargetConstants, 10),
    languageConstants: asStringArray(targetingRaw.languageConstants, 10),
  };

  if (!targeting.keywords.length) {
    targeting.keywords = asStringArray(fallbackTargeting.keywords, 80);
  }
  if (!targeting.geoTargetConstants.length) {
    targeting.geoTargetConstants = asStringArray(fallbackTargeting.geoTargetConstants, 10);
  }
  if (!targeting.languageConstants.length) {
    targeting.languageConstants = asStringArray(fallbackTargeting.languageConstants, 10);
  }

  return {
    aiUsed: true,
    payload: {
      ...fallback,
      ...parsed,
      name: String(parsed.name || fallback.name || "Google Ads campagne"),
      campaignType: parsed.campaignType === "PERFORMANCE_MAX" ? "PERFORMANCE_MAX" : "SEARCH",
      creatives,
      targeting,
      keywordBrief: String(parsed.keywordBrief || ""),
      imageBrief: String(parsed.imageBrief || ""),
    },
  };
}

export function buildAudienceSignalsSystemPrompt(input: {
  trainingNotes: string;
  responseStyle: string;
  companyName: string;
}) {
  return (
    `Je bent een Google Ads Performance Max specialist voor Belgische en Nederlandse KMO's (${input.companyName}). ` +
    "Je stelt richtinggevende audience signals voor (rollen, interesses, sectoren). " +
    "Geef ALLEEN geldige JSON terug: { \"audienceSignals\": string[] }. " +
    "Elk signaal max 80 tekens, Nederlands, geen nummering. " +
    `Tone of voice: ${input.responseStyle}. ` +
    (input.trainingNotes.trim() ? `Workspace training:\n${input.trainingNotes.trim()}\n` : "")
  );
}

export function buildAudienceSignalsUserPrompt(input: {
  product: string;
  audience?: string;
  tone?: string;
  existingSignals?: string[];
}) {
  const existing = (input.existingSignals || []).filter(Boolean).slice(0, 25);
  return (
    `Genereer 6–10 nieuwe audience signals voor Performance Max.\n` +
    `JSON: { "audienceSignals": string[] }\n` +
    `Product/dienst: ${input.product}\n` +
    `Doelgroep: ${input.audience || "Belgische KMO-eigenaars en marketingbeslissers"}\n` +
    `Tone: ${input.tone || "professioneel"}\n` +
    (existing.length
      ? `Bestaande signalen (niet herhalen): ${existing.join(", ")}\n`
      : "Er zijn nog geen signalen — start met brede maar relevante rollen en interesses.\n") +
    "Focus op functies (zaakvoerder, marketing manager), sectoren en koopintentie."
  );
}

export function buildSearchKeywordsSystemPrompt(input: {
  trainingNotes: string;
  responseStyle: string;
  companyName: string;
}) {
  return (
    `Je bent een Google Ads Search specialist voor Belgische KMO's (${input.companyName}). ` +
    "Je stelt zoekwoorden en uitsluitende termen voor in het Nederlands (België). " +
    'Geef ALLEEN geldige JSON: { "keywords": string[], "negativeKeywords": string[], "adGroupName": string }. ' +
    "Keywords: koopintentie, max 80 tekens. Negatieven: vermijd gratis-zoekers, vacatures, fraude. " +
    `Tone: ${input.responseStyle}. ` +
    (input.trainingNotes.trim() ? `Training:\n${input.trainingNotes.trim()}\n` : "")
  );
}

export function buildSearchKeywordsUserPrompt(input: {
  product: string;
  audience?: string;
  tone?: string;
  existingKeywords?: string[];
  existingNegativeKeywords?: string[];
}) {
  return (
    `Genereer 8–15 zoekwoorden en 4–8 uitsluitende zoekwoorden voor een Search-campagne.\n` +
    `JSON: { "keywords": string[], "negativeKeywords": string[], "adGroupName": string }\n` +
    `Product: ${input.product}\n` +
    `Doelgroep: ${input.audience || "Belgische KMO's"}\n` +
    (input.existingKeywords?.length
      ? `Bestaande keywords (niet herhalen): ${input.existingKeywords.join(", ")}\n`
      : "") +
    (input.existingNegativeKeywords?.length
      ? `Bestaande uitsluitingen (niet herhalen): ${input.existingNegativeKeywords.join(", ")}\n`
      : "") +
    "adGroupName: korte interne naam voor de advertentiegroep (max 80 tekens)."
  );
}

export function normalizeSearchKeywordsSuggestion(
  parsed: Record<string, unknown> | null,
  existingKeywords: string[],
  existingNegativeKeywords: string[],
) {
  const keywords = asStringArray(parsed?.keywords || parsed?.keyword, 80, 80);
  const negativeKeywords = asStringArray(
    parsed?.negativeKeywords || parsed?.negative_keywords,
    80,
    80,
  );
  const mergeUnique = (base: string[], extra: string[]) => {
    const merged = [...base.map((item) => item.trim()).filter(Boolean)];
    for (const item of extra) {
      if (!merged.some((entry) => entry.toLowerCase() === item.toLowerCase())) {
        merged.push(item);
      }
    }
    return merged;
  };
  return {
    aiUsed: keywords.length > 0 || negativeKeywords.length > 0,
    keywords: mergeUnique(existingKeywords, keywords).slice(0, 80),
    negativeKeywords: mergeUnique(existingNegativeKeywords, negativeKeywords).slice(0, 80),
    adGroupName: String(parsed?.adGroupName || "").trim().slice(0, 80),
  };
}

export function normalizeAudienceSignalsSuggestion(
  parsed: Record<string, unknown> | null,
  existingSignals: string[],
) {
  const fromAi = asStringArray(
    parsed?.audienceSignals || parsed?.signals || parsed?.audience_signals,
    25,
    80,
  );
  const merged = [...existingSignals.map((item) => item.trim()).filter(Boolean)];
  for (const signal of fromAi) {
    if (!merged.some((item) => item.toLowerCase() === signal.toLowerCase())) {
      merged.push(signal);
    }
  }
  return {
    aiUsed: fromAi.length > 0,
    audienceSignals: merged.slice(0, 25),
  };
}

export { extractJsonFromAiResponse };
