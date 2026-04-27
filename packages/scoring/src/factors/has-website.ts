import { FactorFunction } from "../types";

export const hasWebsiteFactor: FactorFunction = (lead) => {
  if (!lead.website) {
    return {
      rawValue: 10,
      explanation: "Geen website gevonden — grote kans op webdesign project",
      metadata: { hasWebsite: false },
    };
  }
  return {
    rawValue: 2,
    explanation: "Website aanwezig — minder urgente behoefte aan webdesign",
    metadata: { hasWebsite: true, url: lead.website },
  };
};
