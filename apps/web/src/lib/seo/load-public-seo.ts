import { cache } from "react";
import { prisma } from "@digitify/db";
import {
  loadMarketingPublicSeoConfig,
  mapSettingsToPublicSeoConfig,
  type PublicSeoConfig,
} from "@digitify/api/src/lib/seo-settings";
import { getAppUrl } from "@/lib/config";

export const loadPublicSeoConfig = cache(async (): Promise<PublicSeoConfig> => {
  const fallbackCanonical = getAppUrl();
  try {
    return await loadMarketingPublicSeoConfig(prisma, { fallbackCanonical });
  } catch {
    return mapSettingsToPublicSeoConfig({}, { fallbackCanonical });
  }
});
