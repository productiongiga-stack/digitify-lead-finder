import { FactorFunction } from "../types";

export const gmbCompletenessFactor: FactorFunction = (lead) => {
  let score = 0;
  const issues: string[] = [];

  if (!lead.gmbRating && !lead.gmbReviewCount) {
    return { rawValue: 8, explanation: "Geen Google Business Profile data — kans op GBP optimalisatie" };
  }

  if (!lead.gmbCategories || lead.gmbCategories.length === 0) {
    score += 3;
    issues.push("Geen GBP categorieën ingesteld");
  }

  if (lead.phone == null) {
    score += 2;
    issues.push("Geen telefoonnummer in GBP");
  }

  if (!lead.website) {
    score += 3;
    issues.push("Geen website link in GBP");
  }

  if (lead.email == null) {
    score += 2;
    issues.push("Geen e-mail beschikbaar");
  }

  return {
    rawValue: Math.min(score, 10),
    explanation: issues.length > 0 ? issues.join(", ") : "GBP profiel is redelijk compleet",
    metadata: { issues },
  };
};
