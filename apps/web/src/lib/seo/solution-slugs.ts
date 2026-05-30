/** Marketing solution detail routes — keep in sync with SOLUTION_MODULES in marketing-page.tsx */
export const MARKETING_SOLUTION_SLUGS = [
  "lead-search",
  "outreach-ai",
  "rapporten",
  "white-label",
  "offerte-configurator",
  "booking-agenda",
  "chatbot-widget",
  "reviewsysteem",
] as const;

export type MarketingSolutionSlug = (typeof MARKETING_SOLUTION_SLUGS)[number];

export const MARKETING_STATIC_PATHS = [
  "/",
  "/product",
  "/oplossingen",
  "/over-ons",
  "/contact",
] as const;
