import type { Metadata } from "next";
import {
  resolvePageSeoCopy,
  type MarketingSeoPageKey,
  type PublicSeoConfig,
} from "@digitify/api/src/lib/seo-settings";

export type MarketingPageFallback = {
  title: string;
  description: string;
  path: string;
};

function absoluteUrl(config: PublicSeoConfig, path: string) {
  const base = config.canonicalBaseUrl.replace(/\/$/, "");
  if (path === "/" || path === "") return `${base}/`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function formatTitle(config: PublicSeoConfig, pageTitle: string) {
  const site = config.siteName.trim();
  if (!site) return pageTitle;
  if (pageTitle.toLowerCase().includes(site.toLowerCase())) return pageTitle;
  return `${pageTitle} | ${site}`;
}

export function buildMarketingMetadata(
  config: PublicSeoConfig,
  page: MarketingSeoPageKey,
  fallback: MarketingPageFallback,
): Metadata {
  const copy = resolvePageSeoCopy(config, page, {
    title: fallback.title,
    description: fallback.description,
  });
  const title = formatTitle(config, copy.title);
  const url = absoluteUrl(config, fallback.path);
  const ogImage = config.ogImageUrl.trim();

  const robots =
    config.robotsIndex && config.robotsFollow
      ? { index: true, follow: true }
      : {
          index: config.robotsIndex,
          follow: config.robotsFollow,
          googleBot: {
            index: config.robotsIndex,
            follow: config.robotsFollow,
          },
        };

  const verification: Metadata["verification"] = {};
  if (config.googleSiteVerification) {
    verification.google = config.googleSiteVerification;
  }
  if (config.bingSiteVerification) {
    verification.other = {
      ...(verification.other ?? {}),
      "msvalidate.01": config.bingSiteVerification,
    };
  }
  if (config.yandexVerification) {
    verification.yandex = config.yandexVerification;
  }

  return {
    metadataBase: new URL(config.canonicalBaseUrl),
    title,
    description: copy.description,
    keywords: config.keywords.length ? config.keywords : undefined,
    alternates: { canonical: url },
    robots,
    openGraph: {
      type: "website",
      locale: config.ogLocale.replace("_", "-"),
      url,
      siteName: config.siteName,
      title,
      description: copy.description,
      ...(ogImage ? { images: [{ url: ogImage, alt: config.siteName }] } : {}),
    },
    twitter: {
      card: config.twitterCard,
      title,
      description: copy.description,
      ...(config.twitterSite ? { site: config.twitterSite } : {}),
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    ...(Object.keys(verification).length ? { verification } : {}),
  };
}

export function buildRootMetadata(config: PublicSeoConfig): Metadata {
  return buildMarketingMetadata(config, "home", {
    title: config.defaultTitle,
    description: config.defaultDescription,
    path: "/",
  });
}

export const NOINDEX_METADATA: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};
