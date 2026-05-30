import type { MetadataRoute } from "next";
import { loadPublicSeoConfig } from "@/lib/seo/load-public-seo";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const config = await loadPublicSeoConfig();
  const base = config.canonicalBaseUrl.replace(/\/$/, "");

  if (!config.robotsIndex) {
    return {
      rules: { userAgent: "*", disallow: "/" },
      sitemap: `${base}/sitemap.xml`,
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/leads",
          "/campaigns",
          "/contacts",
          "/quotes",
          "/invoices",
          "/reports",
          "/crm",
          "/tasks",
          "/templates",
          "/audit",
          "/bookings",
          "/domains",
          "/reviews",
          "/chatbot",
          "/notifications",
          "/settings",
          "/login",
          "/register",
          "/embed/",
          "/book/",
          "/client-portal/",
          "/bookings/manage/",
          "/api/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
