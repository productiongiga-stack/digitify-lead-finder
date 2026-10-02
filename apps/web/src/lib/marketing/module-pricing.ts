import type { MarketingSolutionSlug } from "./solution-modules";
import {
  MARKETING_BUNDLES,
  getMarketingBundleForLegacySolution,
  getMarketingBundlesTotal,
} from "./marketing-bundles";

/** @deprecated Use marketing-bundles.ts for the commercial catalog. */
export {
  MARKETING_BUNDLES,
  MARKETING_BUNDLE_SLUGS,
  MARKETING_SUITE_PRICING,
  formatMarketingPrice,
  getMarketingBundle,
  getMarketingBundleForLegacySolution,
  getMarketingBundlesTotal,
  getMarketingSuiteSavings,
  getMarketingTechnicalModuleIds,
} from "./marketing-bundles";

/**
 * Compatibility helpers for legacy internal imports. Public marketing pages
 * use the seven-bundle catalog directly; these helpers deliberately resolve
 * old solution slugs to their new commercial bundle.
 */
export function getMarketingModulePricing(slug: MarketingSolutionSlug) {
  const bundle = getMarketingBundleForLegacySolution(slug);
  return bundle ?? MARKETING_BUNDLES[0];
}

export function getMarketingModulesTotal() {
  return getMarketingBundlesTotal();
}
