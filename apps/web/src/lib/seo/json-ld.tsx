import type { PublicSeoConfig } from "@digitify/api/src/lib/seo-settings";

type JsonLdProps = {
  config: PublicSeoConfig;
  path?: string;
};

function absoluteUrl(config: PublicSeoConfig, path = "/") {
  const base = config.canonicalBaseUrl.replace(/\/$/, "");
  if (path === "/" || path === "") return `${base}/`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function MarketingJsonLd({ config, path = "/" }: JsonLdProps) {
  if (!config.structuredDataEnabled) return null;

  const url = absoluteUrl(config, path);
  const logo = config.organizationLogoUrl.trim() || config.ogImageUrl.trim() || undefined;

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: config.organizationName || config.siteName,
    url: config.canonicalBaseUrl,
    ...(logo ? { logo } : {}),
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: config.siteName,
    url: config.canonicalBaseUrl,
    description: config.defaultDescription,
    publisher: { "@type": "Organization", name: config.organizationName || config.siteName },
    inLanguage: config.ogLocale.replace("_", "-"),
  };

  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: config.siteName,
    url,
    isPartOf: { "@type": "WebSite", url: config.canonicalBaseUrl },
    inLanguage: config.ogLocale.replace("_", "-"),
  };

  const payload = [organization, website, webPage];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
