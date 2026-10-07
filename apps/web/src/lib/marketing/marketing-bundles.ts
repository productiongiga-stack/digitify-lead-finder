import type { MarketingSolutionSlug } from "@/lib/marketing/solution-modules";

export const MARKETING_BUNDLE_SLUGS = [
  "lead-engine",
  "outreach-hub",
  "sales-workspace",
  "marketing-studio",
  "website-growth",
  "customer-experience",
  "automation-insights",
] as const;

export type MarketingBundleSlug = (typeof MARKETING_BUNDLE_SLUGS)[number];

export type MarketingBundleDefinition = {
  slug: MarketingBundleSlug;
  label: string;
  eyebrow: string;
  shortLabel: string;
  description: string;
  audience: string;
  monthly: number;
  chipClass: string;
  included: string[];
  technicalModuleIds: string[];
  routes: string[];
  legacySolutionSlugs: MarketingSolutionSlug[];
  detailIntro: string;
  detailSteps: string[];
  detailImpact: string[];
};

export const MARKETING_BUNDLES: MarketingBundleDefinition[] = [
  {
    slug: "lead-engine",
    label: "Lead Engine",
    eyebrow: "Prospectie & scoring",
    shortLabel: "Vind de juiste leads",
    description: "Van eerste zoekopdracht tot commerciële prioriteit: alle prospectie start in één overzichtelijke flow.",
    audience: "Voor agencies, salesteams en lokale bedrijven die gericht nieuwe kansen willen vinden.",
    monthly: 99,
    chipClass: "border-[#f9ae5a]/30 bg-[#fff8ee] text-[#b66d1e]",
    included: ["Leads en leads zoeken", "Campagneprofielen", "Commerciële scoring", "Leadfilters en prioriteiten"],
    technicalModuleIds: ["campaigns"],
    routes: ["/leads", "/leads/search", "/campaigns", "/settings/scoring"],
    legacySolutionSlugs: ["lead-search"],
    detailIntro: "Lead Engine brengt lokale prospectie, campagnecontext en commerciële scoring samen voordat je team aan opvolging begint.",
    detailSteps: [
      "Kies niche, regio en zoekcriteria voor je prospectie.",
      "Verzamel leads en verrijk de commerciële context.",
      "Gebruik scoring, tags en campagneprofielen om prioriteit te bepalen.",
      "Stuur geselecteerde leads door naar Outreach Hub of Sales Workspace.",
    ],
    detailImpact: ["Minder ruwe lijsten", "Sneller prioriteiten bepalen", "Een duidelijk startpunt voor elke commerciële flow"],
  },
  {
    slug: "outreach-hub",
    label: "Outreach Hub",
    eyebrow: "Communicatie & opvolging",
    shortLabel: "Houd elk contact in beweging",
    description: "Verstuur, beheer en keur communicatie goed vanuit één centrale inbox met herbruikbare templates.",
    audience: "Voor teams die veel leads opvolgen en controle willen houden over timing, kwaliteit en tone of voice.",
    monthly: 89,
    chipClass: "border-[#06b6d4]/25 bg-[#06b6d4]/10 text-[#0f7b8f]",
    included: ["Outbound en inbox", "AI-outreachcontext", "Standaard berichten", "Goedkeuringsflow"],
    technicalModuleIds: ["contacts", "templates"],
    routes: ["/contacts", "/contacts/inbox", "/contacts/compose", "/contacts/approval", "/templates"],
    legacySolutionSlugs: ["outreach-ai"],
    detailIntro: "Outreach Hub maakt opvolging schaalbaar zonder dat gesprekken, templates of goedkeuringen over losse tools verspreid raken.",
    detailSteps: [
      "Selecteer leads en kies de juiste doelgroepcontext.",
      "Werk vanuit templates en AI-drafts in jouw tone of voice.",
      "Laat berichten goedkeuren waar je team dat nodig heeft.",
      "Volg replies en volgende acties op vanuit dezelfde inbox.",
    ],
    detailImpact: ["Consistentere communicatie", "Minder gemiste opvolging", "Meer controle over uitgaande campagnes"],
  },
  {
    slug: "sales-workspace",
    label: "Sales Workspace",
    eyebrow: "Verkoop & uitvoering",
    shortLabel: "Van kans naar opdracht",
    description: "Beheer pipeline, taken, offertes, betalingen en uitvoering zonder de context van je lead kwijt te raken.",
    audience: "Voor teams die prospectie willen verbinden met offertes, planning en de eerste stappen na verkoop.",
    monthly: 129,
    chipClass: "border-[#e85d3a]/25 bg-[#e85d3a]/10 text-[#b94d2f]",
    included: ["CRM en pipeline", "Taken en agenda", "Offertes, facturen en betalingen", "Projecten en contracten"],
    technicalModuleIds: ["crm", "tasks", "agenda", "quotes", "invoices", "payments", "projects", "contracts"],
    routes: ["/crm", "/tasks", "/agenda", "/quotes", "/invoices", "/payments", "/projects", "/contracts"],
    legacySolutionSlugs: ["offerte-configurator"],
    detailIntro: "Sales Workspace houdt commerciële kansen, verkoopdocumenten, planning en uitvoering bij elkaar in één werkruimte.",
    detailSteps: [
      "Beweeg leads door je pipeline met duidelijke statussen.",
      "Plan taken, gesprekken en volgende acties zonder contextverlies.",
      "Bouw offertes en volg facturatie of betalingen op.",
      "Zet gewonnen werk door naar projecten en contracten.",
    ],
    detailImpact: ["Minder overdrachtsmomenten", "Snellere offerte-opvolging", "Duidelijkheid van lead tot uitvoering"],
  },
  {
    slug: "marketing-studio",
    label: "Marketing Studio",
    eyebrow: "Content & advertenties",
    shortLabel: "Maak en verspreid je merk",
    description: "Plan content, maak creatives en werk campagnes uit voor social, Meta en Google vanuit dezelfde omgeving.",
    audience: "Voor agencies en marketingteams die creatie, publicatie en advertentieplanning willen verbinden.",
    monthly: 119,
    chipClass: "border-[#10b981]/25 bg-[#10b981]/10 text-[#0f7f5b]",
    included: ["Social Planner", "Creative Studio", "Meta Ads en Google Ads", "White-label branding"],
    technicalModuleIds: ["social", "creativeStudio", "metaAds", "googleAds", "presentations"],
    routes: ["/social", "/creative-studio", "/meta-ads", "/google-ads", "/settings/branding"],
    legacySolutionSlugs: ["white-label"],
    detailIntro: "Marketing Studio brengt merkassets, contentplanning en advertentievoorbereiding samen zonder je commerciële context te verliezen.",
    detailSteps: [
      "Bewaar bestanden, merkassets en stijlafspraken op één plek.",
      "Maak campagnes en contentvarianten voor verschillende kanalen.",
      "Plan publicatie en bereid Meta- of Google-campagnes voor.",
      "Bewaar je branding consistent in app, widgets en exports.",
    ],
    detailImpact: ["Minder toolwissels", "Consistentere merkuitvoering", "Snellere overgang van idee naar campagne"],
  },
  {
    slug: "website-growth",
    label: "Website Growth",
    eyebrow: "Website & inbound",
    shortLabel: "Laat je website beter werken",
    description: "Beheer domeinen, SEO en formulieren zodat je website niet alleen zichtbaar is, maar ook nieuwe leads oplevert.",
    audience: "Voor lokale dienstverleners en agencies die websitegroei willen koppelen aan leadopvolging.",
    monthly: 69,
    chipClass: "border-[#3b82f6]/25 bg-[#3b82f6]/10 text-[#245bb7]",
    included: ["Domeinen", "SEO-tracking", "Websiteformulieren", "Inbound lead capture"],
    technicalModuleIds: ["domains", "seo", "forms"],
    routes: ["/domains", "/seo", "/forms", "/settings/seo"],
    legacySolutionSlugs: [],
    detailIntro: "Website Growth koppelt de technische basis van je website aan formulieren en SEO-opvolging die commerciële kansen zichtbaar maakt.",
    detailSteps: [
      "Beheer domeinen en websitecontext per workspace.",
      "Volg zoekwoorden en technische SEO-signalen.",
      "Publiceer formulieren die aanvragen rechtstreeks als leads ontvangen.",
      "Stuur inbound aanvragen door naar Outreach Hub of Sales Workspace.",
    ],
    detailImpact: ["Meer controle over inbound", "Minder verloren formulieraanvragen", "Een duidelijkere link tussen website en pipeline"],
  },
  {
    slug: "customer-experience",
    label: "Customer Experience",
    eyebrow: "Bookings & reputatie",
    shortLabel: "Maak contact eenvoudig",
    description: "Laat bezoekers boeken, stel vragen en reviews verzamelen via herkenbare klantflows die met je pipeline verbonden zijn.",
    audience: "Voor lokale bedrijven, agencies en teams die meer uit elk contactmoment willen halen.",
    monthly: 99,
    chipClass: "border-[#ec4899]/25 bg-[#ec4899]/10 text-[#b93c79]",
    included: ["Boekingen en agenda-sync", "Chatbotwidget", "Reviews", "Klantgerichte intakeflows"],
    technicalModuleIds: ["bookings", "chatbot", "reviews"],
    routes: ["/bookings", "/chatbot", "/reviews", "/settings/bookings", "/settings/chatbot", "/settings/reviews"],
    legacySolutionSlugs: ["booking-agenda", "chatbot-widget", "reviewsysteem"],
    detailIntro: "Customer Experience maakt van websitebezoekers en bestaande klanten concrete afspraken, gesprekken en feedbackmomenten.",
    detailSteps: [
      "Stel beschikbaarheid, intake en widgetgedrag in.",
      "Laat bezoekers een afspraak boeken of een vraag stellen.",
      "Routeer relevante gesprekken naar je team en pipeline.",
      "Vraag feedback en volg reputatie-opvolging centraal op.",
    ],
    detailImpact: ["Meer concrete contactmomenten", "Minder handmatige planning", "Betere opvolging na oplevering"],
  },
  {
    slug: "automation-insights",
    label: "Automation & Insights",
    eyebrow: "Inzicht & automatisering",
    shortLabel: "Stuur op ritme en data",
    description: "Maak rapporten, automatiseer terugkerend werk en geef je team één kennis- en activiteitenlaag bovenop de dagelijkse flow.",
    audience: "Voor teams die willen opschalen met duidelijke rapportage, herhaalbare workflows en gedeelde kennis.",
    monthly: 89,
    chipClass: "border-[#8b5cf6]/25 bg-[#8b5cf6]/10 text-[#6d3dc2]",
    included: ["Rapportage en website-auditor", "Workflows", "Activiteitenlog", "Kennisbank en bestanden"],
    technicalModuleIds: ["reports", "automations", "activityLog", "knowledge", "files"],
    routes: ["/reports", "/reports/overview", "/automations", "/activity", "/knowledge", "/files"],
    legacySolutionSlugs: ["rapporten"],
    detailIntro: "Automation & Insights geeft je team zicht op wat gebeurt, wat terugkerend is en welke kennis beschikbaar moet zijn voor de volgende actie.",
    detailSteps: [
      "Bekijk rapportage, website-audits en commerciële voortgang.",
      "Leg terugkerende acties vast als workflow.",
      "Gebruik activiteitenlog en kennisbank als gedeelde context.",
      "Verbeter je proces op basis van patronen en opvolgdata.",
    ],
    detailImpact: ["Minder repetitief werk", "Betere managementinzichten", "Meer continuïteit binnen het team"],
  },
];

export const MARKETING_SUITE_PRICING = {
  monthly: 499,
  label: "Complete Lead Finder Suite",
};

export function getMarketingBundle(slug: string) {
  return MARKETING_BUNDLES.find((bundle) => bundle.slug === slug);
}

export function getMarketingBundleForLegacySolution(slug: MarketingSolutionSlug) {
  return MARKETING_BUNDLES.find((bundle) => bundle.legacySolutionSlugs.includes(slug));
}

export function getMarketingBundlesTotal() {
  return MARKETING_BUNDLES.reduce((total, bundle) => total + bundle.monthly, 0);
}

export function getMarketingSuiteSavings() {
  return getMarketingBundlesTotal() - MARKETING_SUITE_PRICING.monthly;
}

export function getMarketingTechnicalModuleIds() {
  return MARKETING_BUNDLES.flatMap((bundle) => bundle.technicalModuleIds);
}

export function formatMarketingPrice(amount: number) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}
