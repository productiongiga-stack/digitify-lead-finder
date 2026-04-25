import { FactorFunction } from "../types";

export const localSeoFactor: FactorFunction = (lead, enrichment) => {
  let score = 0;
  const issues: string[] = [];

  if (!lead.website) {
    score += 4;
    issues.push("Geen website voor lokale SEO");
  }

  if (lead.gmbRating == null && lead.gmbReviewCount == null) {
    score += 3;
    issues.push("Geen Google Business Profile zichtbaar");
  }

  if (!lead.phone) {
    score += 1.5;
    issues.push("Geen telefoonnummer beschikbaar (NAP incompleet)");
  }

  if (!lead.email) {
    score += 1.5;
    issues.push("Geen e-mail beschikbaar");
  }

  return {
    rawValue: Math.min(score, 10),
    explanation: issues.length > 0 ? issues.join(", ") : "Lokale SEO basis is aanwezig",
    metadata: { issues },
  };
};
