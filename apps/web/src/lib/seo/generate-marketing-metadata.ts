import type { Metadata } from "next";
import type { MarketingSeoPageKey } from "@digitify/api/src/lib/seo-settings";
import { buildMarketingMetadata } from "./build-metadata";
import { loadPublicSeoConfig } from "./load-public-seo";
import { MARKETING_PAGE_FALLBACKS } from "./page-fallbacks";

export async function generateMarketingMetadata(
  page: Exclude<MarketingSeoPageKey, `solution:${string}`>,
): Promise<Metadata> {
  const config = await loadPublicSeoConfig();
  return buildMarketingMetadata(config, page, MARKETING_PAGE_FALLBACKS[page]);
}

export async function generateSolutionMetadata(
  slug: string,
  fallback: { title: string; description: string },
): Promise<Metadata> {
  const config = await loadPublicSeoConfig();
  return buildMarketingMetadata(config, `solution:${slug}`, {
    title: fallback.title,
    description: fallback.description,
    path: `/oplossingen/${slug}`,
  });
}
