import type { MarketingSeoPageKey } from "@digitify/api/src/lib/seo-settings";
import type { MarketingPageFallback } from "./build-metadata";

export const MARKETING_PAGE_FALLBACKS: Record<
  Exclude<MarketingSeoPageKey, `solution:${string}`>,
  MarketingPageFallback
> = {
  home: {
    title: "Digitify Lead Finder — Lead generation & outreach platform",
    description:
      "Vind leads, automatiseer outreach met AI, stuur offertes en boek afspraken. Alles in één white-label platform voor groeiende teams.",
    path: "/",
  },
  product: {
    title: "Lead Finder",
    description: "Ontdek hoe Digitify Lead Finder leads, outreach, offertes, afspraken en reviews samenbrengt.",
    path: "/product",
  },
  solutions: {
    title: "Oplossingen",
    description: "Praktische groeiflows voor agencies, sales teams en lokale dienstverleners.",
    path: "/oplossingen",
  },
  about: {
    title: "Over ons",
    description: "Digitify bouwt praktische digitale groeitools voor teams die sneller willen schalen met controle.",
    path: "/over-ons",
  },
  contact: {
    title: "Contact",
    description: "Plan een demo of bespreek hoe Digitify Lead Finder in jouw groeiproces past.",
    path: "/contact",
  },
};
