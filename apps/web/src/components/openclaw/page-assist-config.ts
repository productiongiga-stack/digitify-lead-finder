export type OpenClawPageAssistConfig = {
  title: string;
  description: string;
  assistBookings: boolean;
  starterPrompts: string[];
};

export const OPENCLAW_PAGE_ASSIST: Record<string, OpenClawPageAssistConfig> = {
  "/settings/bookings": {
    title: "AI-hulp voor boekingswidget",
    description:
      "OpenClaw leest je weekuren, Google Agenda-koppeling en embed-status om te verklaren waarom slots ontbreken.",
    assistBookings: true,
    starterPrompts: [
      "Waarom toont mijn embed geen beschikbare dagen? Geef een checklist op basis van mijn huidige configuratie.",
      "Controleer of Google Agenda correct gekoppeld is en wat ik moet fixen in Integraties.",
      "Leg uit hoe weekuren, timezone en maximumHorizonDays samenwerken voor de publieke embed.",
      "Welke stappen moet ik doen als alle dagen rood/vol zijn door Google-blokkering?",
      "Hoe stel ik de publieke tenant token en embed-code correct in?",
    ],
  },
  "/settings/seo": {
    title: "AI-hulp voor SEO",
    description: "OpenClaw helpt met titels, meta descriptions, indexering en zoekmachine-verificatie.",
    assistBookings: false,
    starterPrompts: [
      "Geef een SEO-checklist voor onze marketingpagina's op basis van best practices.",
      "Schrijf een sterke meta description voor de homepagina (max. 155 tekens).",
      "Welke keywords passen bij een B2B lead generation platform in België?",
      "Hoe dien ik sitemap.xml in bij Google Search Console?",
    ],
  },
};

export function resolveOpenClawPageAssist(pathname: string): OpenClawPageAssistConfig | null {
  const entries = Object.entries(OPENCLAW_PAGE_ASSIST).sort((a, b) => b[0].length - a[0].length);
  for (const [prefix, config] of entries) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return config;
  }
  return null;
}
