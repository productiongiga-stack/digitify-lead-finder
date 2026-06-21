export type DigitifyNavKey =
  | "home"
  | "diensten"
  | "cases"
  | "over-ons"
  | "lead-finder"
  | "shop"
  | "designer"
  | "contact";

export type DigitifySiteUrls = {
  wordpress: string;
  shop: string;
  leads: string;
};

export type DigitifyNavChild = {
  key: Extract<DigitifyNavKey, "designer">;
  label: string;
  href: string;
  external?: boolean;
};

export type DigitifyNavItem = {
  key: DigitifyNavKey;
  label: string;
  href: string;
  external?: boolean;
  shopAccent?: boolean;
  children?: DigitifyNavChild[];
};

const trim = (value: string) => value.replace(/\/+$/, "");

/** Canonical slug → production slug when they differ (e.g. over-ons → overons). */
const WP_PAGE_SLUG_ALIASES: Record<string, string> = {
  "over-ons": "overons",
};

const WP_PAGE_SLUG_ENV: Record<string, string | undefined> = {
  "over-ons": process.env.NEXT_PUBLIC_WORDPRESS_SLUG_OVER_ONS,
};

export function wordpressSiteOrigin(wordpressUrl?: string): string {
  const raw = trim(wordpressUrl || process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://digitify.be");
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).origin;
  } catch {
    return raw;
  }
}

export function resolveWordPressPageSlug(pageSlug: string, wordpressUrl?: string): string {
  const envSlug = WP_PAGE_SLUG_ENV[pageSlug];
  if (envSlug) return envSlug;

  const wp = wordpressSiteOrigin(wordpressUrl);
  const useProductionAliases = wp.includes("digitify.be") && !wp.includes("localhost");
  if (useProductionAliases && WP_PAGE_SLUG_ALIASES[pageSlug]) {
    return WP_PAGE_SLUG_ALIASES[pageSlug];
  }

  return pageSlug;
}

export function getWordPressPageUrl(pageSlug: string, urls: DigitifySiteUrls = getDigitifySiteUrls()): string {
  if (!pageSlug || pageSlug === "home") {
    return `${urls.wordpress}/`;
  }
  const slug = resolveWordPressPageSlug(pageSlug, urls.wordpress);
  return `${urls.wordpress}/${slug}/`;
}

export function getWordPressPagePath(path: string, urls: DigitifySiteUrls = getDigitifySiteUrls()): string {
  const raw = String(path || "").trim();
  if (!raw || raw === "/") return `${urls.wordpress}/`;

  const hashIndex = raw.indexOf("#");
  const hash = hashIndex >= 0 ? raw.slice(hashIndex) : "";
  const pathPart = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
  const slug = pathPart.replace(/^\/+|\/+$/g, "");
  if (!slug) return `${urls.wordpress}/${hash}`;

  return `${getWordPressPageUrl(slug, urls).replace(/\/$/, "")}${hash}${hash ? "" : "/"}`;
}

export function getDigitifySiteUrls(): DigitifySiteUrls {
  return {
    wordpress: wordpressSiteOrigin(),
    shop: trim(process.env.NEXT_PUBLIC_SHOP_URL || "https://shop.digitify.be"),
    leads: trim(process.env.NEXT_PUBLIC_APP_URL || "https://leads.digitify.be"),
  };
}

export function getUnifiedNavItems(options: { includeContact?: boolean; site?: "leads" | "shop" | "wordpress" } = {}): DigitifyNavItem[] {
  const urls = getDigitifySiteUrls();
  const site = options.site || "leads";
  const includeContact = options.includeContact ?? true;
  const items: DigitifyNavItem[] = [
    {
      key: "home",
      label: "Home",
      href: site === "leads" ? "/" : `${urls.wordpress}/`,
      external: site === "shop",
    },
    { key: "diensten", label: "Diensten", href: getWordPressPageUrl("diensten", urls), external: site !== "wordpress" },
    { key: "cases", label: "Cases", href: getWordPressPageUrl("cases", urls), external: site !== "wordpress" },
    { key: "over-ons", label: "Over ons", href: getWordPressPageUrl("over-ons", urls), external: site !== "wordpress" },
    {
      key: "lead-finder",
      label: "Lead Finder",
      href: site === "leads" ? "/product" : `${urls.leads}/product`,
      external: site !== "leads",
      shopAccent: true,
    },
    {
      key: "shop",
      label: "Shop",
      href: site === "shop" ? "/" : `${urls.shop}/`,
      external: site !== "shop",
      shopAccent: true,
      children: [
        {
          key: "shop-home",
          label: "Shop",
          href: site === "shop" ? "/" : `${urls.shop}/`,
          external: site !== "shop",
        },
        {
          key: "designer",
          label: "Designer",
          href: site === "shop" ? "/designer" : `${urls.shop}/designer`,
          external: site !== "shop",
        },
      ],
    },
  ];

  if (includeContact) {
    items.push({
      key: "contact",
      label: "Contact",
      href: getWordPressPageUrl("contact", urls),
      external: site !== "wordpress",
    });
  }

  return items;
}

export function pageKeyToNavKey(page: string): DigitifyNavKey | null {
  if (page === "home") return "home";
  if (page === "product") return "lead-finder";
  if (page === "about") return "over-ons";
  if (page === "contact") return "contact";
  return null;
}

export const DIGITIFY_BRAND_SLOGAN = "Partner in Digital Solutions";

export type DigitifyMobileNavChip = {
  label: string;
  href: string;
  external?: boolean;
};

export function getMobileNavChipGroups(urls: DigitifySiteUrls = getDigitifySiteUrls()) {
  return {
    diensten: [
      { label: "Webdesign", href: getWordPressPageUrl("webdesign", urls), external: true },
      { label: "Media", href: getWordPressPageUrl("media", urls), external: true },
      { label: "Marketing", href: getWordPressPageUrl("marketing", urls), external: true },
    ] satisfies DigitifyMobileNavChip[],
    cases: [
      { label: "Webdesign", href: `${getWordPressPageUrl("cases", urls).replace(/\/$/, "")}#webdesign`, external: true },
      { label: "Media", href: `${getWordPressPageUrl("cases", urls).replace(/\/$/, "")}#media`, external: true },
      { label: "Marketing", href: `${getWordPressPageUrl("cases", urls).replace(/\/$/, "")}#marketing`, external: true },
    ] satisfies DigitifyMobileNavChip[],
  };
}
