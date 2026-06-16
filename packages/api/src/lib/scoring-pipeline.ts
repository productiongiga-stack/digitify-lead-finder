import type { PrismaClient } from "@digitify/db";
import {
  computeScore,
  type EnrichmentPayload,
  type LeadData,
  type ScoringWeightConfig,
} from "@digitify/scoring";
import { loadMergedScoringWeights } from "./scoring-weights";

type ScoringWeightRow = {
  id: string;
  factorKey: string;
  label: string;
  weight: number;
  maxPoints: number;
  enabled: boolean;
  category: string | null;
};

type ComputedFactor = {
  factorKey: string;
  rawValue: number;
  weightedValue: number;
  explanation: string;
};

type LeadWithEnrichment = {
  id: string;
  companyName: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  gmbRating: unknown;
  gmbReviewCount: number | null;
  gmbCategories: unknown;
  facebookUrl: string | null;
  instagramUrl: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  tiktokUrl: string | null;
  youtubeUrl: string | null;
  enrichmentData?: Array<{ data: unknown }>;
};

export function buildLeadDataFromRecord(lead: LeadWithEnrichment): LeadData {
  return {
    companyName: lead.companyName,
    website: lead.website,
    email: lead.email,
    phone: lead.phone,
    gmbRating: lead.gmbRating ? Number(lead.gmbRating) : null,
    gmbReviewCount: lead.gmbReviewCount,
    gmbCategories: (lead.gmbCategories as string[]) || [],
    facebookUrl: lead.facebookUrl,
    instagramUrl: lead.instagramUrl,
    linkedinUrl: lead.linkedinUrl,
    twitterUrl: lead.twitterUrl,
    tiktokUrl: lead.tiktokUrl,
    youtubeUrl: lead.youtubeUrl,
  };
}

export function buildEnrichmentFromLead(lead: LeadWithEnrichment): EnrichmentPayload {
  const enrichmentRaw = lead.enrichmentData?.[0]?.data as Record<string, unknown> | null;
  return {
    website_analysis: enrichmentRaw?.website_analysis as EnrichmentPayload["website_analysis"],
    social_analysis: enrichmentRaw?.social_analysis as EnrichmentPayload["social_analysis"],
  };
}

export function toWeightConfigs(weights: ScoringWeightRow[]): ScoringWeightConfig[] {
  return weights.map((w) => ({
    factorKey: w.factorKey,
    label: w.label,
    weight: w.weight,
    maxPoints: w.maxPoints,
    enabled: w.enabled,
    category: w.category,
  }));
}

export async function loadEnabledScoringWeights(db: PrismaClient, workspaceId: string) {
  const merged = await loadMergedScoringWeights(db, workspaceId);
  return merged.filter((w) => w.enabled);
}

export async function scoreLeadRecord(
  db: PrismaClient,
  lead: LeadWithEnrichment,
  weights: ScoringWeightRow[],
) {
  const leadData = buildLeadDataFromRecord(lead);
  const enrichment = buildEnrichmentFromLead(lead);
  const weightConfigs = toWeightConfigs(weights);
  return computeScore({ lead: leadData, enrichment, weights: weightConfigs });
}

export async function persistLeadScore(
  db: PrismaClient,
  leadId: string,
  scoreResult: Awaited<ReturnType<typeof computeScore>>,
  factors: ComputedFactor[],
  weights: ScoringWeightRow[],
  upsertFactors: (
    db: PrismaClient,
    leadId: string,
    factors: ComputedFactor[],
    weights: ScoringWeightRow[],
  ) => Promise<void>,
) {
  await db.lead.update({
    where: { id: leadId },
    data: {
      overallScore: scoreResult.overallScore,
      scorePriority: scoreResult.priority,
      scoreComputedAt: new Date(),
    },
  });
  await upsertFactors(db, leadId, factors, weights);
  return scoreResult;
}
