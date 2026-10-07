import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@digitify/db";
import {
  loadMarketingPublicSeoConfig,
  mapSettingsToPublicSeoConfig,
  type PublicSeoConfig,
} from "@digitify/api/src/lib/seo-settings";
import { getAppUrl } from "@/lib/config";

const loadCachedPublicSeoConfig = unstable_cache(
  async (fallbackCanonical: string): Promise<PublicSeoConfig> => {
    try {
      return await loadMarketingPublicSeoConfig(prisma, { fallbackCanonical });
    } catch {
      return mapSettingsToPublicSeoConfig({}, { fallbackCanonical });
    }
  },
  ["public-seo-config"],
  { revalidate: 300 },
);

/**
 * Public SEO settings change rarely. Keep them in the Next.js data cache so
 * every page request does not open another database round-trip. The five
 * minute TTL is short enough for normal settings edits to become visible
 * quickly while removing this query from the critical render path.
 */
export const loadPublicSeoConfig = cache(async (): Promise<PublicSeoConfig> =>
  loadCachedPublicSeoConfig(getAppUrl()),
);
