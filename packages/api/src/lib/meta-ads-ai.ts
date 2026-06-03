import type { PrismaClient } from "@digitify/db";
import { getSettingString, settingsRowsToMap } from "./settings";
import { loadWorkspaceSettingRows } from "./workspace-settings";

export const META_ADS_AI_TRAINING_KEY = "ads.ai_training_notes";

const VALID_OBJECTIVES = [
  "OUTCOME_TRAFFIC",
  "OUTCOME_LEADS",
  "OUTCOME_SALES",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_AWARENESS",
  "LINK_CLICKS",
  "LEAD_GENERATION",
] as const;

const VALID_CTA_TYPES = [
  "LEARN_MORE",
  "SIGN_UP",
  "CONTACT_US",
  "BOOK_TRAVEL",
  "SHOP_NOW",
  "APPLY_NOW",
  "GET_QUOTE",
] as const;

export async function loadMetaAdsAiTrainingNotes(db: PrismaClient, workspaceId: string) {
  const rows = await loadWorkspaceSettingRows(db, { workspaceId, memberId: workspaceId }, [META_ADS_AI_TRAINING_KEY]);
  const map = settingsRowsToMap(rows);
  return getSettingString(map, META_ADS_AI_TRAINING_KEY, "").slice(0, 4000);
}

export function extractJsonFromAiResponse(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const attempts = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) attempts.push(fenced[1].trim());

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) attempts.push(trimmed.slice(start, end + 1));

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

function normalizeObjective(value: unknown, fallback: string) {
  const objective = String(value || fallback).trim().toUpperCase();
  return (VALID_OBJECTIVES as readonly string[]).includes(objective) ? objective : fallback;
}

function normalizeCtaType(value: unknown, fallback: string) {
  const ctaType = String(value || fallback).trim().toUpperCase();
  return (VALID_CTA_TYPES as readonly string[]).includes(ctaType) ? ctaType : fallback;
}

export function buildMetaCampaignSystemPrompt(trainingNotes: string) {
  return (
    "Je bent een Meta Ads specialist voor Belgische KMO's. " +
    "Je volgt strikt de Meta-hierarchie: Campagne (objective + budget) → Adset (doelgroep, plaatsingen, optimalisatie) → Advertentie (creative). " +
    "Geef ALLEEN geldige JSON terug, zonder markdown of uitleg. " +
    "Gebruik Nederlandse copy, max 125 tekens voor primaryText, max 40 voor headline, max 30 voor description. " +
    "Objective moet een van: OUTCOME_TRAFFIC, OUTCOME_LEADS, OUTCOME_SALES, OUTCOME_ENGAGEMENT, OUTCOME_AWARENESS. " +
    "ctaType moet een van: LEARN_MORE, SIGN_UP, CONTACT_US, BOOK_TRAVEL, SHOP_NOW, APPLY_NOW, GET_QUOTE. " +
    "linkUrl moet https:// zijn. " +
    (trainingNotes.trim() ? `Workspace AI-training:\n${trainingNotes.trim()}\n` : "")
  );
}

export function buildMetaCampaignUserPrompt(input: { product: string; audience?: string; tone?: string }) {
  return (
    `Maak een Meta Ads campagne-draft als JSON met exact deze velden:\n` +
    `{\n` +
    `  "name": string,\n` +
    `  "objective": string,\n` +
    `  "primaryText": string,\n` +
    `  "headline": string,\n` +
    `  "description": string,\n` +
    `  "ctaType": string,\n` +
    `  "ctaLabel": string,\n` +
    `  "linkUrl": string,\n` +
    `  "imageBrief": string,\n` +
    `  "targeting": {\n` +
    `    "geo_locations": { "countries": [] },\n` +
    `    "age_min": number,\n` +
    `    "age_max": number,\n` +
    `    "publisher_platforms": ["facebook", "instagram"],\n` +
    `    "facebook_positions": ["feed"],\n` +
    `    "instagram_positions": ["stream", "story"],\n` +
    `    "adsets": [\n` +
    `      {\n` +
    `        "name": string,\n` +
    `        "geo_locations": { "countries": [] },\n` +
    `        "age_min": number,\n` +
    `        "age_max": number,\n` +
    `        "publisher_platforms": ["facebook", "instagram"],\n` +
    `        "facebook_positions": ["feed"],\n` +
    `        "instagram_positions": ["stream", "story"],\n` +
    `        "interestSignals": string[]\n` +
    `      }\n` +
    `    ]\n` +
    `  }\n` +
    `}\n` +
    `Product/dienst: ${input.product}\n` +
    `Doelgroep: ${input.audience || "niet opgegeven"}\n` +
    `Tone of voice: ${input.tone || "professioneel"}`
  );
}

export function buildMetaVariantSystemPrompt(trainingNotes: string) {
  return (
    "Je bent een Meta Ads copywriter voor Belgische KMO's. " +
    "Schrijf één advertentie-variant (creative) binnen een bestaande adset. " +
    "Geef ALLEEN geldige JSON terug, zonder markdown. " +
    "primaryText max 125 tekens, headline max 40 tekens. linkUrl moet https:// zijn. " +
    "publishAsset moet feed, square of story zijn. " +
    (trainingNotes.trim() ? `Workspace AI-training:\n${trainingNotes.trim()}\n` : "")
  );
}

export function buildMetaVariantUserPrompt(input: {
  product: string;
  audience?: string;
  tone?: string;
  angle?: string;
  landingUrl?: string;
  adsetName?: string;
}) {
  return (
    `Maak een Meta advertentie-variant als JSON:\n` +
    `{\n` +
    `  "adName": string,\n` +
    `  "primaryText": string,\n` +
    `  "headline": string,\n` +
    `  "description": string,\n` +
    `  "ctaType": string,\n` +
    `  "ctaLabel": string,\n` +
    `  "linkUrl": string,\n` +
    `  "publishAsset": "feed" | "square" | "story",\n` +
    `  "angle": string\n` +
    `}\n` +
    `Product/dienst: ${input.product}\n` +
    `Doelgroep: ${input.audience || "niet opgegeven"}\n` +
    `Adset: ${input.adsetName || "Algemene doelgroep"}\n` +
    `Tone: ${input.tone || "professioneel"}\n` +
    `Invalshoek: ${input.angle || "duidelijk voordeel en sterke CTA"}\n` +
    `Landingspagina: ${input.landingUrl || "nog niet opgegeven"}`
  );
}

export function normalizeMetaCampaignSuggestion(
  parsed: Record<string, unknown> | null,
  fallback: Record<string, unknown>,
) {
  if (!parsed) return fallback;

  const targeting = parsed.targeting && typeof parsed.targeting === "object" ? (parsed.targeting as Record<string, unknown>) : {};
  const adsets = Array.isArray(targeting.adsets) && targeting.adsets.length ? targeting.adsets : (fallback.targeting as any)?.adsets;

  return {
    ...fallback,
    ...parsed,
    objective: normalizeObjective(parsed.objective, String(fallback.objective)),
    ctaType: normalizeCtaType(parsed.ctaType, String(fallback.ctaType)),
    linkUrl: String(parsed.linkUrl || fallback.linkUrl || ""),
    targeting: {
      ...(typeof fallback.targeting === "object" ? fallback.targeting : {}),
      ...targeting,
      adsets,
    },
  };
}

export function normalizeMetaVariantSuggestion(
  parsed: Record<string, unknown> | null,
  fallback: Record<string, unknown>,
) {
  if (!parsed) return fallback;

  const publishAsset = String(parsed.publishAsset || fallback.publishAsset || "feed");
  const normalizedPublish = ["feed", "square", "story"].includes(publishAsset) ? publishAsset : "feed";

  return {
    ...fallback,
    ...parsed,
    ctaType: normalizeCtaType(parsed.ctaType, String(fallback.ctaType)),
    linkUrl: String(parsed.linkUrl || fallback.linkUrl || ""),
    publishAsset: normalizedPublish,
  };
}
