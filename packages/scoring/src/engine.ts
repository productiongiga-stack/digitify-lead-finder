import { ScoringInput, ScoringResult, ScoringFactorResult, FactorFunction, LeadData, EnrichmentPayload } from "./types";
import { hasWebsiteFactor } from "./factors/has-website";
import { websiteQualityFactor } from "./factors/website-quality";
import { seoBasicsFactor } from "./factors/seo-basics";
import { gmbCompletenessFactor } from "./factors/gmb-completeness";
import { gmbRatingFactor } from "./factors/gmb-rating";
import { reviewCountFactor } from "./factors/review-count";
import { socialPresenceFactor } from "./factors/social-presence";
import { socialActivityFactor } from "./factors/social-activity";
import { contentFreshnessFactor } from "./factors/content-freshness";
import { localSeoFactor } from "./factors/local-seo";

const factorRegistry: Record<string, FactorFunction> = {
  has_website: hasWebsiteFactor,
  website_quality: websiteQualityFactor,
  seo_basics: seoBasicsFactor,
  gmb_completeness: gmbCompletenessFactor,
  gmb_rating: gmbRatingFactor,
  review_count: reviewCountFactor,
  social_presence: socialPresenceFactor,
  social_activity: socialActivityFactor,
  content_freshness: contentFreshnessFactor,
  local_seo: localSeoFactor,
};

function determinePriority(score: number): "Hot" | "Warm" | "Low" {
  if (score >= 75) return "Hot";
  if (score >= 50) return "Warm";
  return "Low";
}

function detectPainPoints(factors: ScoringFactorResult[]): string[] {
  return factors
    .filter((f) => f.rawValue >= 6)
    .sort((a, b) => b.rawValue - a.rawValue)
    .map((f) => f.explanation);
}

function suggestServices(factors: ScoringFactorResult[]): string[] {
  const services: string[] = [];
  const high = (key: string) => factors.find((f) => f.factorKey === key && f.rawValue >= 6);

  if (high("has_website") || high("website_quality")) services.push("Webdesign & Development");
  if (high("seo_basics") || high("local_seo")) services.push("SEO Optimalisatie");
  if (high("social_presence") || high("social_activity")) services.push("Social Media Management");
  if (high("gmb_completeness") || high("gmb_rating")) services.push("Google Business Optimalisatie");
  if (high("review_count")) services.push("Review Management");
  if (high("content_freshness")) services.push("Content Creatie");
  if (high("website_quality")) services.push("Performance Optimalisatie");

  return [...new Set(services)];
}

function determineBestNextAction(priority: string, factors: ScoringFactorResult[], lead: LeadData): string {
  if (priority === "Hot") {
    if (!lead.website) return "Contacteer direct — geen website, grootste kans op webdesign project";
    if (!lead.email) return "Zoek contactgegevens en stuur gepersonaliseerde outreach";
    return "Stuur gepersonaliseerde e-mail met concrete verbeterpunten";
  }
  if (priority === "Warm") {
    return "Voeg toe aan nurture campagne met relevante content";
  }
  return "Monitor en herscoor over 30 dagen";
}

export function computeScore(input: ScoringInput): ScoringResult {
  const { lead, enrichment, weights } = input;
  const enabledWeights = weights.filter((w) => w.enabled);

  const maxPossible = enabledWeights.reduce((sum, w) => sum + w.maxPoints * w.weight, 0);

  const factors: ScoringFactorResult[] = enabledWeights.map((w) => {
    const factorFn = factorRegistry[w.factorKey];
    if (!factorFn) {
      console.warn(`[scoring] Unknown factor key "${w.factorKey}" — skipping (add to factorRegistry)`);
      return {
        factorKey: w.factorKey,
        rawValue: 0,
        weightedValue: 0,
        explanation: `Factor "${w.factorKey}" niet gevonden in registry`,
      };
    }

    let result: ReturnType<FactorFunction>;
    try {
      result = factorFn(lead, enrichment);
    } catch (err) {
      console.error(`[scoring] Factor "${w.factorKey}" threw an error:`, err);
      return {
        factorKey: w.factorKey,
        rawValue: 0,
        weightedValue: 0,
        explanation: `Factor "${w.factorKey}" kon niet worden berekend`,
      };
    }

    const raw = typeof result.rawValue === "number" && isFinite(result.rawValue) ? result.rawValue : 0;
    const clamped = Math.max(0, Math.min(raw, w.maxPoints));

    return {
      factorKey: w.factorKey,
      rawValue: clamped,
      weightedValue: clamped * w.weight,
      explanation: result.explanation,
      metadata: result.metadata,
    };
  });

  const totalWeighted = factors.reduce((sum, f) => sum + f.weightedValue, 0);
  const overallScore = maxPossible > 0 ? Math.round((totalWeighted / maxPossible) * 100) : 0;
  const priority = determinePriority(overallScore);
  const painPoints = detectPainPoints(factors);
  const suggestedServices = suggestServices(factors);
  const bestNextAction = determineBestNextAction(priority, factors, lead);

  return {
    overallScore,
    priority,
    factors,
    painPoints,
    suggestedServices,
    bestNextAction,
    computedAt: new Date(),
  };
}

export function getAvailableFactors(): string[] {
  return Object.keys(factorRegistry);
}
