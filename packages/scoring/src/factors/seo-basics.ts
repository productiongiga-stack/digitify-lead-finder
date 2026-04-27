import { FactorFunction } from "../types";

export const seoBasicsFactor: FactorFunction = (lead, enrichment) => {
  if (!lead.website || !enrichment.website_analysis) {
    return { rawValue: 10, explanation: "Geen website — alle SEO ontbreekt" };
  }

  const wa = enrichment.website_analysis;
  let score = 0;
  const issues: string[] = [];

  if (!wa.hasMetaTitle) { score += 3; issues.push("Geen meta title"); }
  if (!wa.hasMetaDescription) { score += 3; issues.push("Geen meta description"); }
  if (!wa.hasH1) { score += 2; issues.push("Geen H1 heading"); }
  if (!wa.hasStructuredData) { score += 2; issues.push("Geen structured data"); }

  return {
    rawValue: Math.min(score, 10),
    explanation: issues.length > 0 ? issues.join(", ") : "SEO basis is in orde",
    metadata: { issues },
  };
};
