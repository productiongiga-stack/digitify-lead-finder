import { FactorFunction } from "../types";

export const gmbRatingFactor: FactorFunction = (lead) => {
  if (lead.gmbRating == null) {
    return { rawValue: 5, explanation: "Geen Google rating beschikbaar" };
  }

  // Inverse: low rating = high opportunity
  const rating = lead.gmbRating;
  let score: number;
  let explanation: string;

  if (rating < 3.0) {
    score = 10;
    explanation = `Rating ${rating}/5 — ernstige reputatieproblemen, grote kans op hulp`;
  } else if (rating < 3.5) {
    score = 8;
    explanation = `Rating ${rating}/5 — onder gemiddeld, ruimte voor verbetering`;
  } else if (rating < 4.0) {
    score = 6;
    explanation = `Rating ${rating}/5 — gemiddeld, kan beter`;
  } else if (rating < 4.5) {
    score = 3;
    explanation = `Rating ${rating}/5 — goed maar niet top`;
  } else {
    score = 1;
    explanation = `Rating ${rating}/5 — uitstekend, weinig urgentie`;
  }

  return { rawValue: score, explanation, metadata: { rating } };
};
