import { cache } from "react";
import { prisma } from "@digitify/db";
import {
  loadMarketingPublicSeoConfig,
  type PublicSeoConfig,
} from "@digitify/api/src/lib/seo-settings";
import { getAppUrl } from "@/lib/config";

export const loadPublicSeoConfig = cache(async (): Promise<PublicSeoConfig> => {
  return loadMarketingPublicSeoConfig(prisma, { fallbackCanonical: getAppUrl() });
});
