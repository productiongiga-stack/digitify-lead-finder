import { FactorFunction } from "../types";

export const reviewCountFactor: FactorFunction = (lead) => {
  if (lead.gmbReviewCount == null) {
    return { rawValue: 7, explanation: "Geen reviews gevonden" };
  }

  const count = lead.gmbReviewCount;
  let score: number;
  let explanation: string;

  if (count === 0) {
    score = 10;
    explanation = "Geen reviews — grote kans op review management";
  } else if (count < 5) {
    score = 8;
    explanation = `Slechts ${count} reviews — zeer weinig social proof`;
  } else if (count < 15) {
    score = 6;
    explanation = `${count} reviews — onder gemiddeld`;
  } else if (count < 50) {
    score = 4;
    explanation = `${count} reviews — redelijk`;
  } else if (count < 100) {
    score = 2;
    explanation = `${count} reviews — goed`;
  } else {
    score = 1;
    explanation = `${count} reviews — sterke social proof`;
  }

  return { rawValue: score, explanation, metadata: { reviewCount: count } };
};
