import { FactorFunction } from "../types";

export const socialActivityFactor: FactorFunction = (lead, enrichment) => {
  if (!enrichment.social_analysis?.lastPostDate) {
    const hasSocials = lead.facebookUrl || lead.instagramUrl || lead.linkedinUrl;
    if (!hasSocials) {
      return { rawValue: 8, explanation: "Geen social media — geen activiteit meetbaar" };
    }
    return { rawValue: 6, explanation: "Social media aanwezig maar activiteit niet gemeten" };
  }

  const lastPost = new Date(enrichment.social_analysis.lastPostDate);
  const daysSince = Math.floor((Date.now() - lastPost.getTime()) / 86400000);

  let score: number;
  let explanation: string;

  if (daysSince > 180) {
    score = 9;
    explanation = `Laatste post meer dan 6 maanden geleden — inactief`;
  } else if (daysSince > 90) {
    score = 7;
    explanation = `Laatste post ${daysSince} dagen geleden — nauwelijks actief`;
  } else if (daysSince > 30) {
    score = 5;
    explanation = `Laatste post ${daysSince} dagen geleden — matig actief`;
  } else if (daysSince > 7) {
    score = 3;
    explanation = `Laatste post ${daysSince} dagen geleden — redelijk actief`;
  } else {
    score = 1;
    explanation = `Recent gepost (${daysSince} dagen geleden) — actief`;
  }

  return { rawValue: score, explanation, metadata: { daysSinceLastPost: daysSince } };
};
