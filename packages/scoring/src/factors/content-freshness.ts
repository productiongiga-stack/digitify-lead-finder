import { FactorFunction } from "../types";

export const contentFreshnessFactor: FactorFunction = (lead, enrichment) => {
  if (!lead.website || !enrichment.website_analysis) {
    return { rawValue: 8, explanation: "Geen website — geen content te beoordelen" };
  }

  const wa = enrichment.website_analysis;
  let score = 0;
  const issues: string[] = [];

  if (wa.contentLength < 500) {
    score += 4;
    issues.push("Zeer weinig content op de website");
  } else if (wa.contentLength < 2000) {
    score += 2;
    issues.push("Beperkte content");
  }

  if (wa.lastModified) {
    const lastMod = new Date(wa.lastModified);
    const daysSince = Math.floor((Date.now() - lastMod.getTime()) / 86400000);
    if (daysSince > 365) {
      score += 4;
      issues.push(`Website al meer dan een jaar niet bijgewerkt`);
    } else if (daysSince > 180) {
      score += 2;
      issues.push(`Website al ${daysSince} dagen niet bijgewerkt`);
    }
  } else {
    score += 2;
    issues.push("Laatste update niet detecteerbaar");
  }

  return {
    rawValue: Math.min(score, 10),
    explanation: issues.length > 0 ? issues.join(", ") : "Content is redelijk up-to-date",
    metadata: { issues, contentLength: wa.contentLength },
  };
};
