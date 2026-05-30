import type { MetadataRoute } from "next";
import { loadPublicSeoConfig } from "@/lib/seo/load-public-seo";
import { MARKETING_SOLUTION_SLUGS, MARKETING_STATIC_PATHS } from "@/lib/seo/solution-slugs";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = await loadPublicSeoConfig();
  if (!config.robotsIndex) return [];

  const base = config.canonicalBaseUrl.replace(/\/$/, "");
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = MARKETING_STATIC_PATHS.map((path) => ({
    url: path === "/" ? `${base}/` : `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.8,
  }));

  const solutionEntries: MetadataRoute.Sitemap = MARKETING_SOLUTION_SLUGS.map((slug) => ({
    url: `${base}/oplossingen/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticEntries, ...solutionEntries];
}
