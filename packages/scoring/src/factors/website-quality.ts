import { FactorFunction } from "../types";

export const websiteQualityFactor: FactorFunction = (lead, enrichment) => {
  if (!lead.website || !enrichment.website_analysis) {
    return { rawValue: 10, explanation: "Geen website om te analyseren — maximale opportuniteit" };
  }

  const wa = enrichment.website_analysis;
  let score = 0;
  const issues: string[] = [];

  if (!wa.hasSSL) { score += 2; issues.push("Geen SSL certificaat"); }
  if (!wa.isMobileFriendly) { score += 2.5; issues.push("Niet mobielvriendelijk"); }
  if (wa.loadTimeMs > 3000) { score += 2; issues.push(`Trage laadtijd (${(wa.loadTimeMs / 1000).toFixed(1)}s)`); }
  else if (wa.loadTimeMs > 1500) { score += 1; issues.push("Matige laadtijd"); }
  if (!wa.hasFavicon) { score += 0.5; issues.push("Geen favicon"); }
  if (!wa.hasCTA) { score += 1.5; issues.push("Geen duidelijke call-to-action"); }
  if (!wa.hasAnalytics) { score += 1.5; issues.push("Geen analytics/tracking gedetecteerd"); }

  return {
    rawValue: Math.min(score, 10),
    explanation: issues.length > 0 ? issues.join(", ") : "Website kwaliteit is goed",
    metadata: { issues, ...wa },
  };
};
