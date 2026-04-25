import { FactorFunction } from "../types";

export const socialPresenceFactor: FactorFunction = (lead) => {
  const socials = [
    { name: "Facebook", url: lead.facebookUrl },
    { name: "Instagram", url: lead.instagramUrl },
    { name: "LinkedIn", url: lead.linkedinUrl },
    { name: "Twitter/X", url: lead.twitterUrl },
    { name: "TikTok", url: lead.tiktokUrl },
    { name: "YouTube", url: lead.youtubeUrl },
  ];

  const present = socials.filter((s) => s.url).map((s) => s.name);
  const missing = socials.filter((s) => !s.url).map((s) => s.name);

  // Inverse: fewer socials = higher score (more opportunity)
  const presentCount = present.length;
  let score: number;

  if (presentCount === 0) {
    score = 10;
  } else if (presentCount === 1) {
    score = 8;
  } else if (presentCount === 2) {
    score = 6;
  } else if (presentCount === 3) {
    score = 4;
  } else if (presentCount === 4) {
    score = 2;
  } else {
    score = 1;
  }

  const explanation =
    presentCount === 0
      ? "Geen social media profielen gevonden"
      : `${presentCount}/6 socials aanwezig (${present.join(", ")}). Ontbreekt: ${missing.join(", ")}`;

  return { rawValue: score, explanation, metadata: { present, missing } };
};
