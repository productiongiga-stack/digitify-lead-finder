"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Copy,
  FileText,
  GripVertical,
  Info,
  Layers,
  ListOrdered,
  MousePointer2,
  Package,
  Palette,
  Plus,
  Receipt,
  Save,
  Settings2,
  Smile,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@digitify/ui";
import { trpc } from "@/lib/trpc/client";
import { SETTINGS_PAGE_QUERY_OPTS } from "@/lib/settings-query-options";
import { useToast } from "@/components/feedback/toast-provider";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { getAppUrl } from "@/lib/config";
import {
  normalizeKey,
  parseEmojiMap,
  parseIconLibrary,
  stringifyEmojiMap,
  stringifyIconLibrary,
  type QuoteIconLibraryItem,
} from "@/lib/quote-configurator-utils";
import { QuoteIconLibraryPanel, QuoteIconPicker } from "@/components/quotes/quote-icon-picker";
import { ConfiguratorIcon } from "@/components/quotes/quote-embed-layout";
import type {
  PackageOption as BuilderPackage,
  ProductSpecConfig as BuilderSpec,
  SpecOption as BuilderOption,
  SpecOptionSection as BuilderOptionSection,
  SpecQuestion as BuilderQuestion,
  SpecQuestionType as BuilderQuestionType,
  SpecSlider as BuilderSlider,
  SpecsByProduct as BuilderSpecsMap,
} from "@/lib/quote-configurator-specs";

type EditableService = {
  id?: string;
  category: string;
  name: string;
  description: string;
  basePrice: number;
  unit: string;
  sortOrder: number;
  isActive: boolean;
};

type ReusableBlockTemplateType = "web" | "media" | "marketing" | "addons";
type PreviewViewport = "desktop" | "tablet" | "mobile";
type SettingsTab = "studio" | "config" | "catalog" | "all";
type ConfiguratorInfoTab = "general" | "branding" | "colors" | "steps" | "icons" | "pdf";
type PreviewSelectionState = {
  currentStep: number;
  selectedCategory: string;
  selectedProductId: string;
};

type QuotePreviewPayload = {
  settings: {
    title: string;
    description: string;
    color: string;
    badge: string;
    disclaimer: string;
    ctaLabel: string;
    embedMode: "simple" | "advanced";
    darkColor: string;
    bgColor: string;
    companyName: string;
    companyTagline: string;
    logoUrl: string;
    footerContact: string;
    footerPhone: string;
    footerWebsite: string;
    stepServiceLabel: string;
    stepProductLabel: string;
    stepSpecsLabel: string;
    stepDetailsLabel: string;
    stepServiceHint: string;
    stepProductHint: string;
    stepSpecsHint: string;
    stepDetailsHint: string;
    categoryIconsJson: string;
    productIconsJson: string;
    iconLibraryJson: string;
    serviceTitle: string;
    productTitle: string;
    specsTitle: string;
    detailsTitle: string;
    productSpecsJson: string;
  };
  studio: {
    viewport: PreviewViewport;
    syncBuilderWithPreview: boolean;
    canUndo: boolean;
    canRedo: boolean;
    autosaveState: "idle" | "saving" | "saved" | "error";
    publishState: "draft" | "published";
    hasUnpublishedChanges: boolean;
    lastPublishedAt: string | null;
  };
  services: Array<{
    id: string;
    category: string;
    name: string;
    description?: string | null;
    basePrice: number;
    unit?: string | null;
  }>;
};

type StudioSnapshot = {
  configMode: "simple" | "advanced";
  title: string;
  description: string;
  badge: string;
  disclaimer: string;
  ctaLabel: string;
  color: string;
  darkColor: string;
  bgColor: string;
  companyName: string;
  companyTagline: string;
  logoUrl: string;
  footerContact: string;
  footerPhone: string;
  footerWebsite: string;
  stepServiceLabel: string;
  stepProductLabel: string;
  stepSpecsLabel: string;
  stepDetailsLabel: string;
  stepServiceHint: string;
  stepProductHint: string;
  stepSpecsHint: string;
  stepDetailsHint: string;
  serviceTitle: string;
  productTitle: string;
  specsTitle: string;
  detailsTitle: string;
  categoryIconsJson: string;
  productIconsJson: string;
  iconLibraryJson: string;
  services: EditableService[];
  builderSpecsMap: BuilderSpecsMap;
};

type StudioHistoryEntry = {
  snapshot: StudioSnapshot;
  timestamp: number;
};

const SERVICE_TEMPLATES: Record<string, EditableService[]> = {
  "Digital Agency": [
    { category: "Strategie", name: "Strategische intake", description: "Kick-off, positionering en roadmap.", basePrice: 450, unit: "per traject", sortOrder: 0, isActive: true },
    { category: "Web", name: "Landingspagina", description: "Conversiegerichte pagina met copy en CTA.", basePrice: 950, unit: "per pagina", sortOrder: 1, isActive: true },
    { category: "SEO", name: "SEO basisoptimalisatie", description: "Meta, structuur, snelheid en indexatie.", basePrice: 650, unit: "per site", sortOrder: 2, isActive: true },
    { category: "Ads", name: "Campagne opstart", description: "Tracking, advertentie-setup en eerste tests.", basePrice: 850, unit: "per kanaal", sortOrder: 3, isActive: true },
  ],
  "Zonnepanelen installateur": [
    { category: "Leads", name: "Offerte landingspagina", description: "Pagina voor offerte-aanvragen met vertrouwen en cases.", basePrice: 1200, unit: "per pagina", sortOrder: 0, isActive: true },
    { category: "Leads", name: "Leadformulier integratie", description: "Koppeling naar CRM of inbox.", basePrice: 350, unit: "eenmalig", sortOrder: 1, isActive: true },
    { category: "Local SEO", name: "Google Business optimalisatie", description: "Maps-profiel, reviews en lokale zichtbaarheid.", basePrice: 490, unit: "per maand", sortOrder: 2, isActive: true },
    { category: "Ads", name: "Google Ads leadcampagne", description: "Zoekcampagnes voor regio en type installatie.", basePrice: 950, unit: "per maand", sortOrder: 3, isActive: true },
  ],
  "Horeca / Restaurant": [
    { category: "Website", name: "Menu- en reservatiepagina", description: "Mobielvriendelijke pagina met reservatieflow.", basePrice: 890, unit: "per pagina", sortOrder: 0, isActive: true },
    { category: "Reviews", name: "Review funnel setup", description: "Interne feedbackflow en reviewdoorsturing.", basePrice: 420, unit: "eenmalig", sortOrder: 1, isActive: true },
    { category: "Social", name: "Social contentpakket", description: "Postsjablonen en promotiecampagnes.", basePrice: 650, unit: "per maand", sortOrder: 2, isActive: true },
    { category: "Mail", name: "Nieuwsbrief campagne", description: "Automatische mailflow voor acties en events.", basePrice: 390, unit: "per maand", sortOrder: 3, isActive: true },
  ],
};

function isHexColor(value: string) {
  return /^#([0-9A-Fa-f]{6})$/.test(value.trim());
}

function hexToRgb(hex: string) {
  const fallback = { r: 230, g: 169, b: 74 };
  if (!isHexColor(hex)) return fallback;
  const clean = hex.replace("#", "");
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((item) => item.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function shouldUseTravelByService(service: { category: string; name: string }) {
  const value = `${service.category} ${service.name}`.toLowerCase();
  return ["media", "video", "film", "event", "foto", "shoot", "drone"].some((token) =>
    value.includes(token),
  );
}

function inferTemplateType(service?: { category: string; name: string }): ReusableBlockTemplateType {
  if (!service) return "addons";
  const value = `${service.category} ${service.name}`.toLowerCase();
  if (["web", "website", "shop", "landingspagina"].some((token) => value.includes(token))) return "web";
  if (["media", "video", "film", "foto", "aftermovie", "brand"].some((token) => value.includes(token))) return "media";
  if (["marketing", "ads", "seo", "meta", "social"].some((token) => value.includes(token))) return "marketing";
  return "addons";
}

function uniqueKey(base: string, used: Set<string>) {
  const clean = normalizeKey(base) || "product";
  if (!used.has(clean)) {
    used.add(clean);
    return clean;
  }
  let index = 2;
  while (used.has(`${clean}-${index}`)) index += 1;
  const result = `${clean}-${index}`;
  used.add(result);
  return result;
}

function buildDefaultQuestions(): BuilderQuestion[] {
  return [
    {
      key: "planning",
      label: "Wanneer wilt u starten?",
      type: "select",
      options: ["Zo snel mogelijk", "Binnen 2 weken", "Binnen 1 maand", "Nog te bepalen"],
      required: true,
    },
    {
      key: "budget-known",
      label: "Heeft u al een budgetindicatie?",
      type: "checkbox",
      helpText: "Ja, ik heb al een budget in gedachten.",
      required: false,
    },
    {
      key: "focus",
      label: "Wat is uw belangrijkste doel?",
      type: "text",
      placeholder: "Meer leads, sterkere branding, snellere website...",
      required: false,
    },
  ];
}

function buildProductSpecsTemplate(services: EditableService[]) {
  const activeServices = services
    .filter((service) => service.isActive)
    .filter((service) => service.name.trim().length > 0);
  const grouped = new Map<string, EditableService[]>();
  activeServices.forEach((service) => {
    const category = service.category.trim() || "Algemeen";
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category)!.push(service);
  });

  const usedKeys = new Set<string>();
  const products = Object.fromEntries(
    activeServices.map((service) => {
      const category = service.category.trim() || "Algemeen";
      const categoryItems = grouped.get(category) || [];
      const siblingExtras = categoryItems.filter((item) => item.id !== service.id && item.name !== service.name);
      const base = Math.max(1, Number(service.basePrice) || 0);
      const key = service.id || uniqueKey(`${category}-${service.name}`, usedKeys);
      return [
        key,
        {
          headline: `${service.name} - Specificaties`,
          subheadline: service.description || `Configuratie voor ${service.name}`,
          packageSectionTitle: "PAKKET / SERVICE",
          packages: [
            {
              key: "basic",
              label: "Basis",
              subtitle: service.description || "Startpakket",
              price: Math.round(base),
              features: ["Kick-off", "Standaard oplevering", "1 revisieronde"],
              defaultSelected: true,
            },
            {
              key: "pro",
              label: "Pro",
              subtitle: service.description || "Uitgebreid pakket",
              price: Math.round(base * 1.6),
              features: ["Alles van Basis", "Uitgebreide scope", "Snellere oplevering"],
            },
            {
              key: "premium",
              label: "Premium",
              subtitle: service.description || "Volledig maatwerk",
              price: Math.round(base * 2.2),
              features: ["Alles van Pro", "Volledige begeleiding", "Prioritaire support"],
            },
          ],
          optionSections: [
            {
              title: "EXTRA OPTIES",
              options: siblingExtras.map((extra) => ({
                key: normalizeKey(extra.name) || "optie",
                label: extra.name,
                price: Math.max(0, Number(extra.basePrice) || 0),
                unit: extra.unit ? `/${extra.unit}` : "",
                description: extra.description || "",
              })),
            },
          ],
          sliders: shouldUseTravelByService(service)
            ? [
                {
                  key: "travel",
                  label: "Verplaatsing",
                  min: 1,
                  max: 1000,
                  step: 10,
                  included: 50,
                  pricePerUnit: 0.35,
                  unitLabel: "km",
                  hint: "0km inbegrepen, daarna EUR0,35/km",
                  defaultValue: 1,
                },
              ]
            : [],
          questionsCard: {
            title: "Vragen voor een nauwkeurige offerte",
            subtitle: "Antwoorden verbeteren de prijsinschatting.",
          },
          questions: buildDefaultQuestions(),
          notesPlaceholder: "Extra info, specifieke wensen of vragen...",
        },
      ];
    }),
  );

  return JSON.stringify({ products }, null, 2);
}

function parseBuilderSpecsMap(raw: string): BuilderSpecsMap {
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const root = parsed as Record<string, unknown>;
    const source =
      root.products && typeof root.products === "object" && !Array.isArray(root.products)
        ? (root.products as Record<string, unknown>)
        : root;
    const entries = Object.entries(source).filter(
      ([, value]) => value && typeof value === "object" && !Array.isArray(value),
    );
    return Object.fromEntries(entries) as BuilderSpecsMap;
  } catch {
    return {};
  }
}

function serializeBuilderSpecsMap(map: BuilderSpecsMap) {
  return JSON.stringify({ products: map }, null, 2);
}

function buildReusableBlockTemplate(
  templateType: ReusableBlockTemplateType,
  service: Pick<EditableService, "name" | "description" | "basePrice" | "category">,
): BuilderSpec {
  const base = Math.max(1, Number(service.basePrice) || 0);
  const titleBase = service.name || "Product";

  if (templateType === "web") {
    return {
      headline: `${titleBase} - Specificaties`,
      subheadline: service.description || "Website op maat met uitbreidbare functies",
      packageSectionTitle: "PAKKET",
      packages: [
        { key: "basis", label: "Basis", subtitle: "Startsite", price: Math.round(base), features: ["Mobielvriendelijk", "Contactformulier"], defaultSelected: true },
        { key: "pro", label: "Pro", subtitle: "Groeipakket", price: Math.round(base * 1.6), features: ["Alles van Basis", "SEO-basis", "Snellere pagina's"] },
        { key: "premium", label: "Premium", subtitle: "Volledig maatwerk", price: Math.round(base * 2.2), features: ["Alles van Pro", "Maatwerk componenten", "Prioritaire support"] },
      ],
      optionSections: [
        {
          title: "HOSTING & INFRASTRUCTUUR",
          options: [
            { key: "hosting", label: "Hosting", price: 80, unit: "/jaar" },
            { key: "domain", label: "Domeinnaam", price: 20, unit: "/jaar" },
            { key: "business-mail", label: "Zakelijke e-mail", price: 30, unit: "/jaar" },
          ],
        },
        {
          title: "EXTRA FUNCTIONALITEITEN",
          options: [
            { key: "booking", label: "Online boekingssysteem", price: 120, unit: " eenmalig" },
            { key: "chatbot", label: "Livechat / chatbot", price: 180, unit: "/jaar" },
            { key: "crm", label: "CRM-integratie", price: 250, unit: " eenmalig" },
          ],
        },
      ],
      sliders: [],
      questionsCard: { title: "Vragen voor een nauwkeurige offerte", subtitle: "Antwoorden helpen de scope te verfijnen." },
      questions: buildDefaultQuestions(),
      notesPlaceholder: "Extra info, specifieke wensen of vragen...",
    };
  }

  if (templateType === "media") {
    return {
      headline: `${titleBase} - Specificaties`,
      subheadline: service.description || "Video/foto pakket met optionele uitbreidingen",
      packageSectionTitle: "TYPE / DUUR",
      packages: [
        { key: "compact", label: "Compact", subtitle: "Korte opname", price: Math.round(base), features: ["1 locatie", "Kleurcorrectie"], defaultSelected: true },
        { key: "extended", label: "Extended", subtitle: "Halve dag opname", price: Math.round(base * 1.65), features: ["2 locaties", "Sound design", "2 revisies"] },
        { key: "premium", label: "Premium", subtitle: "Volledige dag", price: Math.round(base * 2.4), features: ["3 locaties", "Social snippets", "Prioritaire montage"] },
      ],
      optionSections: [
        {
          title: "EXTRA OPTIES",
          options: [
            { key: "drone", label: "Drone-luchtbeelden", price: 350 },
            { key: "voice-over", label: "Professionele voice-over", price: 120 },
            { key: "subtitle", label: "Ondertiteling", price: 80 },
          ],
        },
      ],
      sliders: [
        { key: "travel", label: "Verplaatsing", min: 1, max: 1000, step: 10, included: 50, pricePerUnit: 0.35, unitLabel: "km", hint: "50km inbegrepen, daarna EUR0,35/km", defaultValue: 1 },
      ],
      questionsCard: { title: "Vragen voor een nauwkeurige offerte", subtitle: "Beschrijf locatie, duur en gewenste stijl." },
      questions: buildDefaultQuestions(),
      notesPlaceholder: "Extra info over planning, locatie, stijl...",
    };
  }

  if (templateType === "marketing") {
    return {
      headline: `${titleBase} - Specificaties`,
      subheadline: service.description || "Campagnepakketten met duidelijke deliverables",
      packageSectionTitle: "PAKKET / SERVICE",
      packages: [
        { key: "setup", label: "Setup", subtitle: "Technische opstart", price: Math.round(base), features: ["Tracking setup", "Structuur campagne"], defaultSelected: true },
        { key: "starter", label: "Starter", subtitle: "Lopend beheer", price: Math.round(base * 1.3), features: ["Wekelijkse optimalisatie", "Kernrapportage"] },
        { key: "growth", label: "Growth", subtitle: "Actieve groei", price: Math.round(base * 1.9), features: ["Meerdere kanalen", "Uitgebreide rapportering", "A/B testing"] },
      ],
      optionSections: [
        {
          title: "EXTRA MARKETING OPTIES",
          options: [
            { key: "creative", label: "Creatives pakket", price: 180, unit: "/maand" },
            { key: "landing-page", label: "Landingspagina optimalisatie", price: 220, unit: " eenmalig" },
            { key: "monthly-meeting", label: "Strategiemeeting", price: 95, unit: "/maand" },
          ],
        },
      ],
      sliders: [],
      questionsCard: { title: "Vragen voor een nauwkeurige offerte", subtitle: "Doel, budget en timing geven een realistischer voorstel." },
      questions: buildDefaultQuestions(),
      notesPlaceholder: "KPI's, budget, doelgroepen...",
    };
  }

  return {
    headline: `${titleBase} - Specificaties`,
    subheadline: service.description || `${service.category} uitbreidingen en add-ons`,
    packageSectionTitle: "PAKKET",
    packages: [
      { key: "basis", label: "Basis", subtitle: "Startpakket", price: Math.round(base), features: ["Standaard oplevering"], defaultSelected: true },
      { key: "pro", label: "Pro", subtitle: "Uitgebreid", price: Math.round(base * 1.5), features: ["Meer functionaliteiten", "Extra begeleiding"] },
    ],
    optionSections: [
      {
        title: "ADD-ONS",
        options: [
          { key: "priority", label: "Priority support", price: 120, unit: "/maand" },
          { key: "training", label: "Workshop / opleiding", price: 350, unit: " per sessie" },
        ],
      },
    ],
    sliders: [],
    questionsCard: { title: "Vragen voor een nauwkeurige offerte", subtitle: "Geef extra context voor een nauwkeuriger voorstel." },
    questions: buildDefaultQuestions(),
    notesPlaceholder: "Extra info, specifieke wensen of vragen...",
  };
}

function buildDigitifyScreenshotPreset() {
  const products = {
    "onepage-website": {
      headline: "Onepage Website - Specificaties",
      subheadline: "Ideaal voor freelancers en kleine bedrijven",
      packageSectionTitle: "PAKKET",
      packages: [
        {
          key: "basis",
          label: "Basis",
          subtitle: "Tot 5 secties, contactformulier",
          price: 750,
          features: ["SSL-certificaat", "GDPR cookiebanner", "Google Analytics 4", "Mobiele weergave"],
          defaultSelected: true,
        },
        {
          key: "pro",
          label: "Pro",
          subtitle: "Tot 8 secties, animaties, SEO-basis",
          price: 1200,
          features: ["Alles van Basis", "SEO-basis optimalisatie", "Paginasnelheid optimalisatie", "1 revisieronde"],
        },
        {
          key: "premium",
          label: "Premium",
          subtitle: "Volledig op maat, animaties, SEO, support",
          price: 1800,
          features: ["Alles van Pro", "Maatwerk animaties", "1 maand gratis support", "Google Search Console"],
        },
      ],
      optionSections: [
        {
          title: "HOSTING & INFRASTRUCTUUR",
          options: [
            { key: "hosting", label: "Hosting", price: 80, unit: "/jaar" },
            { key: "domein", label: "Domeinnaam (.be of .com)", price: 20, unit: "/jaar" },
            { key: "mail", label: "Zakelijke e-mailadres", price: 30, unit: "/jaar" },
          ],
        },
        {
          title: "EXTRA FUNCTIONALITEITEN",
          options: [
            { key: "reservering", label: "Reserveringssysteem", price: 120, unit: " eenmalig" },
            { key: "bookings", label: "Online boekingssysteem", price: 120, unit: " eenmalig" },
            { key: "catalogus", label: "Productcatalogus", price: 80, unit: " eenmalig" },
            { key: "crm", label: "CRM-integratie", price: 250, unit: " eenmalig" },
            { key: "chatbot", label: "Livechat / chatbot", price: 180, unit: "/jaar" },
            { key: "reviews", label: "Reviewsysteem", price: 20, unit: " eenmalig" },
          ],
        },
      ],
      sliders: [],
      questionsCard: {
        title: "Vragen voor een nauwkeurige offerte",
        subtitle: "6 vragen - beantwoord voor een betere prijsopgave",
      },
      questions: buildDefaultQuestions(),
      notesPlaceholder: "Extra info, specifieke wensen of vragen...",
    },
    "logo-huisstijl": {
      headline: "Logo & Huisstijl - Specificaties",
      subheadline: "Logo-ontwerp en volledige huisstijl",
      packageSectionTitle: "BRANDINGPAKKET",
      packages: [
        {
          key: "logo",
          label: "Logo ontwerp",
          subtitle: "Professioneel logo + vectorbestanden",
          price: 150,
          features: ["3 initiële concepten", "Vectorbestanden", "PNG + JPG versie", "Kleur- en zwart-wit variant"],
          defaultSelected: true,
        },
        {
          key: "huisstijl",
          label: "Huisstijl",
          subtitle: "Logo + kleurenpalet + brandguide",
          price: 350,
          features: ["Logo ontwerp", "Kleurenpalet", "Typografieselectie", "Brandguide PDF"],
        },
        {
          key: "full-branding",
          label: "Full branding",
          subtitle: "Visitekaartjes + stationerie + stijlgids",
          price: 750,
          features: ["Huisstijl inbegrepen", "Briefpapier", "Visitekaartje ontwerp", "E-mailhandtekening"],
        },
        {
          key: "rebranding",
          label: "Rebranding",
          subtitle: "Herpositionering + nieuwe merkidentiteit",
          price: 1200,
          features: ["Brand audit", "Positioning sessie", "Volledig nieuwe identiteit", "3 revisierondes"],
        },
      ],
      optionSections: [],
      sliders: [],
      questionsCard: {
        title: "Vragen voor een nauwkeurige offerte",
        subtitle: "5 vragen - beantwoord voor een betere prijsopgave",
      },
      questions: buildDefaultQuestions(),
      notesPlaceholder: "Extra info, specifieke wensen of vragen...",
    },
    "google-ads": {
      headline: "Google Ads - Specificaties",
      subheadline: "Zoekcampagnes, display en MAX campagnes",
      packageSectionTitle: "PAKKET / SERVICE",
      packages: [
        {
          key: "setup-only",
          label: "Setup only",
          subtitle: "Campagne-opzet + tracking + conversiedoelen",
          price: 380,
          features: [],
          defaultSelected: true,
        },
        {
          key: "starter",
          label: "Starter",
          subtitle: "Setup + beheer, budget tot EUR500/m",
          price: 280,
          features: [],
        },
        {
          key: "growth",
          label: "Growth",
          subtitle: "Setup + beheer, budget tot EUR2000/m",
          price: 550,
          features: [],
        },
        {
          key: "premium",
          label: "Premium",
          subtitle: "Setup + full service, onbeperkt budget",
          price: 950,
          features: [],
        },
      ],
      optionSections: [],
      sliders: [],
      questionsCard: {
        title: "Vragen voor een nauwkeurige offerte",
        subtitle: "7 vragen - beantwoord voor een betere prijsopgave",
      },
      questions: buildDefaultQuestions(),
      notesPlaceholder: "Extra info, specifieke wensen of vragen...",
    },
    "promovideo-brand-film": {
      headline: "Promovideo / Brand film - Specificaties",
      subheadline: "Merkverhaal dat vertrouwen opbouwt",
      packageSectionTitle: "TYPE / DUUR",
      packages: [
        {
          key: "2u",
          label: "2 uur opname",
          subtitle: "Compact shoot - korte video",
          price: 450,
          features: ["1 locatie", "Kleurcorrectie", "Muzieklicentie", "1 revisieronde"],
          defaultSelected: true,
        },
        {
          key: "4u",
          label: "4 uur opname",
          subtitle: "Halve dag - meer shots en scenes",
          price: 750,
          features: ["2 locaties", "Kleurcorrectie", "Sound design", "2 revisierondes"],
        },
        {
          key: "8u",
          label: "8 uur opname",
          subtitle: "Volledige dag - uitgebreide productie",
          price: 1200,
          features: ["3 locaties", "Kleurcorrectie", "Sound design", "2 revisierondes"],
        },
        {
          key: "12u",
          label: "12 uur opname",
          subtitle: "Groot project - complete shoot",
          price: 1800,
          features: ["4 locaties", "Kleurcorrectie", "Sound design", "Voice-over mogelijk"],
        },
      ],
      optionSections: [
        {
          title: "EXTRA OPTIES",
          options: [
            { key: "drone", label: "Drone-luchtbeelden", price: 350 },
            { key: "acteur", label: "Acteur/model (per persoon)", price: 120, unit: "/st." },
            { key: "script", label: "Script & storyboard", price: 180 },
            { key: "voice", label: "Professionele voice-over", price: 120 },
            { key: "ondertiteling", label: "Ondertiteling", price: 80 },
          ],
        },
      ],
      sliders: [
        {
          key: "travel",
          label: "Verplaatsing",
          min: 1,
          max: 1000,
          step: 10,
          included: 50,
          pricePerUnit: 0.35,
          unitLabel: "km",
          hint: "0km inbegrepen, daarna EUR0,35/km",
          defaultValue: 1,
        },
      ],
      questionsCard: {
        title: "Vragen voor een nauwkeurige offerte",
        subtitle: "6 vragen - beantwoord voor een betere prijsopgave",
      },
      questions: buildDefaultQuestions(),
      notesPlaceholder: "Extra info, specifieke wensen of vragen...",
    },
    "aftermovie-eventvideo": {
      headline: "Aftermovie / Eventvideo - Specificaties",
      subheadline: "Sfeervolle samenvatting van uw event",
      packageSectionTitle: "TYPE / DUUR",
      packages: [
        {
          key: "compact",
          label: "Compact",
          subtitle: "Korte samenvatting met highlights",
          price: 550,
          features: ["1 locatie", "Kleurcorrectie", "Muzieklicentie", "1 revisieronde"],
          defaultSelected: true,
        },
        {
          key: "extended",
          label: "Extended",
          subtitle: "Meer cameratijd en langere montage",
          price: 850,
          features: ["2 locaties", "Kleurcorrectie", "Sound design", "2 revisierondes"],
        },
        {
          key: "premium",
          label: "Premium",
          subtitle: "Volledige coverage + social snippets",
          price: 1250,
          features: ["2 camera operators", "Sound design", "Social snippets", "2 revisierondes"],
        },
      ],
      optionSections: [
        {
          title: "EXTRA OPTIES",
          options: [
            { key: "drone", label: "Drone-luchtbeelden", price: 350 },
            { key: "teaser", label: "Teaser cut (15-30 sec)", price: 150 },
            { key: "subs", label: "Ondertiteling", price: 80 },
          ],
        },
      ],
      sliders: [
        {
          key: "travel",
          label: "Verplaatsing",
          min: 1,
          max: 1000,
          step: 10,
          included: 50,
          pricePerUnit: 0.35,
          unitLabel: "km",
          hint: "0km inbegrepen, daarna EUR0,35/km",
          defaultValue: 1,
        },
      ],
      questionsCard: {
        title: "Vragen voor een nauwkeurige offerte",
        subtitle: "6 vragen - beantwoord voor een betere prijsopgave",
      },
      questions: buildDefaultQuestions(),
      notesPlaceholder: "Extra info, specifieke wensen of vragen...",
    },
  };

  return JSON.stringify({ products }, null, 2);
}

function parseJsonEditorValue(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false as const, error: "JSON moet een object zijn met productconfiguraties." };
    }
    return { ok: true as const, normalized: JSON.stringify(parsed, null, 2) };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Ongeldige JSON",
    };
  }
}

const DEFAULT_PDF_SERVICES_CARDS_JSON = JSON.stringify(
  [
    {
      title: "Webdesign",
      subtitle: "Snelle, conversiegerichte websites en webshops op maat.",
      bullets: ["Custom design", "Responsive", "SEO-gericht", "Conversie-optimalisatie"],
      color: "#E5A948",
    },
    {
      title: "Media",
      subtitle: "Sterke beelden met impact: social clips, fotoshoots en video.",
      bullets: ["Professionele montage", "Platform-specifieke output", "Kleurcorrectie", "Drone mogelijk"],
      color: "#6B4CD8",
    },
    {
      title: "Marketing",
      subtitle: "Datagedreven campagnes voor meetbare groei.",
      bullets: ["Google & Meta Ads", "Heldere rapportering", "Continue optimalisatie", "Online + offline"],
      color: "#3E63D8",
    },
    {
      title: "Extra's & Add-ons",
      subtitle: "Aanvullende services voor schaalbare groei.",
      bullets: ["Hosting & domein", "SEO-upgrades", "Onderhoud", "Branding"],
      color: "#499D66",
    },
  ],
  null,
  2,
);

const DEFAULT_PDF_PROCESS_STEPS_JSON = JSON.stringify(
  [
    { title: "Discover", text: "Kennismaking, briefing en doelstellingen scherpstellen." },
    { title: "Create", text: "Strategie en concept op maat van uw merk." },
    { title: "Build", text: "Uitwerken, testen en opleveren met kwaliteitscontrole." },
    { title: "Grow", text: "Meten, bijsturen en verder schalen op data." },
  ],
  null,
  2,
);

const DEFAULT_PDF_TIPS_JSON = JSON.stringify(
  [
    { title: "Eerste 3 seconden tellen", text: "Start met een sterke opening. Zo houdt u de aandacht vast." },
    { title: "Consistentie wint", text: "Regelmatige publicatie presteert beter dan losse campagnes." },
    { title: "Hergebruik content", text: "Maak van een video meerdere snippets per platform." },
    { title: "Doelgroep centraal", text: "Focus op het probleem van de klant, niet op uzelf." },
    { title: "Ondertiteling verhoogt bereik", text: "Veel video wordt zonder geluid bekeken, captions helpen." },
    { title: "Format per platform", text: "Pas aspect ratio en lengte aan op elk kanaal." },
  ],
  null,
  2,
);

const DEFAULT_PDF_NEXT_STEPS_JSON = JSON.stringify(
  [
    "Lees de offerte volledig na en verzamel eventuele vragen.",
    "Onderteken digitaal of op papier en bezorg ons een kopie.",
    "Wij plannen de onboarding en projectstart in.",
    "We starten de uitvoering en rapporteren stap voor stap.",
  ],
  null,
  2,
);

export function QuoteSettingsPageInner() {
  const { data: settings, isLoading } = trpc.settings.getQuotesConfiguratorSettings.useQuery(
    undefined,
    SETTINGS_PAGE_QUERY_OPTS,
  );
  const servicesQuery = trpc.quote.getServices.useQuery();
  const utils = trpc.useUtils();
  const { showToast } = useToast();
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("Stel uw pakket samen");
  const [description, setDescription] = useState("Kies de diensten die voor uw bedrijf relevant zijn en vraag daarna een offerte op maat aan.");
  const [color, setColor] = useState("#f9ae5a");
  const [badge, setBadge] = useState("Offerte Configurator");
  const [disclaimer, setDisclaimer] = useState("Niets wordt automatisch verstuurd. Uw aanvraag komt eerst intern binnen voor goedkeuring.");
  const [ctaLabel, setCtaLabel] = useState("Vraag offerte aan");
  const [darkColor, setDarkColor] = useState("#14171d");
  const [bgColor, setBgColor] = useState("#f3f2ec");
  const [configMode, setConfigMode] = useState<"simple" | "advanced">("simple");
  const [companyName, setCompanyName] = useState("Digitify");
  const [companyTagline, setCompanyTagline] = useState("Partner in Digital Solutions");
  const [logoUrl, setLogoUrl] = useState("");
  const [footerContact, setFooterContact] = useState("contact@digitify.be");
  const [footerPhone, setFooterPhone] = useState("+32 (0) 486 51 57 73");
  const [footerWebsite, setFooterWebsite] = useState("www.digitify.be");
  const [stepServiceLabel, setStepServiceLabel] = useState("DIENST");
  const [stepProductLabel, setStepProductLabel] = useState("PRODUCT");
  const [stepSpecsLabel, setStepSpecsLabel] = useState("SPECIFICATIES");
  const [stepDetailsLabel, setStepDetailsLabel] = useState("GEGEVENS");
  const [stepServiceHint, setStepServiceHint] = useState("Selecteer eerst een categorie met de dienst die u nodig hebt.");
  const [stepProductHint, setStepProductHint] = useState("Kies daarna exact welk product binnen die categorie past.");
  const [stepSpecsHint, setStepSpecsHint] = useState("Configureer uw pakket, opties en eventuele variabele parameters.");
  const [stepDetailsHint, setStepDetailsHint] = useState("Vul tenslotte uw gegevens in om de offerteaanvraag te versturen.");
  const [serviceTitle, setServiceTitle] = useState("Welke dienst zoekt u?");
  const [productTitle, setProductTitle] = useState("Kies uw product");
  const [specsTitle, setSpecsTitle] = useState("Specificaties");
  const [detailsTitle, setDetailsTitle] = useState("Uw gegevens");
  const [pdfBrandName, setPdfBrandName] = useState("Digitify");
  const [pdfBrandTagline, setPdfBrandTagline] = useState("Partner in Digital Solutions");
  const [pdfLogoUrl, setPdfLogoUrl] = useState("");
  const [pdfHeaderBgColor, setPdfHeaderBgColor] = useState("#0A0D12");
  const [pdfAccentColor, setPdfAccentColor] = useState("#F6AD49");
  const [pdfPageBgColor, setPdfPageBgColor] = useState("#ECECEE");
  const [pdfFooterText, setPdfFooterText] = useState("");
  const [pdfIntroTitle, setPdfIntroTitle] = useState("Beste {{clientName}},");
  const [pdfIntroText, setPdfIntroText] = useState("Bedankt voor uw vertrouwen. Hieronder vindt u een gepersonaliseerde offerte op maat van uw doelstellingen.");
  const [pdfAboutTitle, setPdfAboutTitle] = useState("Over ons");
  const [pdfAboutText, setPdfAboutText] = useState("Wij bouwen digitale oplossingen met focus op resultaat, schaalbaarheid en kwaliteit.");
  const [pdfServicesTitle, setPdfServicesTitle] = useState("Onze diensten & aanpak");
  const [pdfServicesCardsJson, setPdfServicesCardsJson] = useState(DEFAULT_PDF_SERVICES_CARDS_JSON);
  const [pdfProcessTitle, setPdfProcessTitle] = useState("Ons proces - van idee tot resultaat");
  const [pdfProcessStepsJson, setPdfProcessStepsJson] = useState(DEFAULT_PDF_PROCESS_STEPS_JSON);
  const [pdfTipsTitle, setPdfTipsTitle] = useState("Tips & tricks - haal het meeste uit uw investering");
  const [pdfTipsJson, setPdfTipsJson] = useState(DEFAULT_PDF_TIPS_JSON);
  const [pdfNextStepsTitle, setPdfNextStepsTitle] = useState("Volgende stappen");
  const [pdfNextStepsJson, setPdfNextStepsJson] = useState(DEFAULT_PDF_NEXT_STEPS_JSON);
  const [pdfSignatureClientTitle, setPdfSignatureClientTitle] = useState("Voor akkoord - Klant");
  const [pdfSignatureCompanyTitle, setPdfSignatureCompanyTitle] = useState("Voor akkoord - {{brandName}}");
  const [pdfSignatureCompanySigner, setPdfSignatureCompanySigner] = useState("Klim Gaikalov");
  const [pdfSignatureCompanyRole, setPdfSignatureCompanyRole] = useState("Creative Director");
  const [productSpecsJson, setProductSpecsJson] = useState("{}");
  const [productSpecsError, setProductSpecsError] = useState<string | null>(null);
  const [productSpecsInfo, setProductSpecsInfo] = useState<string | null>(null);
  const [categoryIconsJson, setCategoryIconsJson] = useState("{}");
  const [productIconsJson, setProductIconsJson] = useState("{}");
  const [iconLibraryJson, setIconLibraryJson] = useState("[]");
  const [iconsError, setIconsError] = useState<string | null>(null);
  const [iconsInfo, setIconsInfo] = useState<string | null>(null);
  const [builderSpecsMap, setBuilderSpecsMap] = useState<BuilderSpecsMap>({});
  const [activeBuilderKey, setActiveBuilderKey] = useState("");
  const [selectedReusableTemplate, setSelectedReusableTemplate] = useState<ReusableBlockTemplateType>("web");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("studio");
  const [configInfoTab, setConfigInfoTab] = useState<ConfiguratorInfoTab>("general");
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>("desktop");
  const [previewFrameReady, setPreviewFrameReady] = useState(0);
  const [syncBuilderWithPreview, setSyncBuilderWithPreview] = useState(true);
  const [previewSelection, setPreviewSelection] = useState<PreviewSelectionState>({
    currentStep: 1,
    selectedCategory: "",
    selectedProductId: "",
  });
  const [draggedPackageIndex, setDraggedPackageIndex] = useState<number | null>(null);
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null);
  const [services, setServices] = useState<EditableService[]>([]);
  const [copied, setCopied] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [syncingCatalog, setSyncingCatalog] = useState(false);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [historyPast, setHistoryPast] = useState<StudioHistoryEntry[]>([]);
  const [historyFuture, setHistoryFuture] = useState<StudioHistoryEntry[]>([]);
  const [publishedSnapshot, setPublishedSnapshot] = useState<StudioSnapshot | null>(null);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [pendingTemplateKey, setPendingTemplateKey] = useState<keyof typeof SERVICE_TEMPLATES | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const applyingHistoryRef = useRef(false);
  const lastSnapshotRef = useRef<string>("");
  const isMountedRef = useRef(false);
  const initialPublishedSnapshotSetRef = useRef(false);
  const studioOnlyMode = true;

  const batchUpdate = trpc.settings.batchUpdate.useMutation({
    onSuccess: () => {
      utils.settings.getQuotesConfiguratorSettings.invalidate();
    },
    onError: (error) =>
      showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });
  const upsertService = trpc.quote.upsertService.useMutation();
  const deleteService = trpc.quote.deleteService.useMutation();

  useEffect(() => {
    if (!hasUnpublishedChanges) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnpublishedChanges]);

  useEffect(() => {
    if (!settings || loaded) return;
    const getStringSetting = (key: string, fallback = "") => {
      const value = settings[key];
      if (value === null || value === undefined) return fallback;
      if (typeof value !== "string") return String(value);
      const trimmed = value.trim();
      if (!trimmed) return fallback;
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === "string") return parsed;
      } catch {
        return value;
      }
      return value;
    };
    const getJsonSetting = (key: string, fallback = "{}") => {
      const value = settings[key];
      if (value === null || value === undefined) return fallback;
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return fallback;
        try {
          const parsed = JSON.parse(trimmed);
          if (typeof parsed === "string") {
            try {
              return JSON.stringify(JSON.parse(parsed), null, 2);
            } catch {
              return parsed;
            }
          }
          if (parsed && typeof parsed === "object") {
            return JSON.stringify(parsed, null, 2);
          }
        } catch {
          return value;
        }
        return value;
      }
      if (value && typeof value === "object") return JSON.stringify(value, null, 2);
      return String(value);
    };
    setTitle(getStringSetting("quotes.embed_title", title));
    setDescription(getStringSetting("quotes.embed_description", description));
    setColor(getStringSetting("quotes.embed_color", color));
    setBadge(getStringSetting("quotes.embed_badge", badge));
    setDisclaimer(getStringSetting("quotes.embed_disclaimer", disclaimer));
    setCtaLabel(getStringSetting("quotes.embed_cta_label", ctaLabel));
    setDarkColor(getStringSetting("quotes.embed_dark_color", darkColor));
    setBgColor(getStringSetting("quotes.embed_bg_color", bgColor));
    setConfigMode(
      getStringSetting("quotes.embed_mode", configMode) === "advanced"
        ? "advanced"
        : "simple",
    );
    setCompanyName(getStringSetting("quotes.embed_company_name", companyName));
    setCompanyTagline(getStringSetting("quotes.embed_company_tagline", companyTagline));
    setLogoUrl(getStringSetting("quotes.embed_logo_url", logoUrl));
    setFooterContact(getStringSetting("quotes.embed_footer_contact", footerContact));
    setFooterPhone(getStringSetting("quotes.embed_footer_phone", footerPhone));
    setFooterWebsite(getStringSetting("quotes.embed_footer_website", footerWebsite));
    setStepServiceLabel(getStringSetting("quotes.embed_step_service_label", stepServiceLabel));
    setStepProductLabel(getStringSetting("quotes.embed_step_product_label", stepProductLabel));
    setStepSpecsLabel(getStringSetting("quotes.embed_step_specs_label", stepSpecsLabel));
    setStepDetailsLabel(getStringSetting("quotes.embed_step_details_label", stepDetailsLabel));
    setStepServiceHint(getStringSetting("quotes.embed_step_service_hint", stepServiceHint));
    setStepProductHint(getStringSetting("quotes.embed_step_product_hint", stepProductHint));
    setStepSpecsHint(getStringSetting("quotes.embed_step_specs_hint", stepSpecsHint));
    setStepDetailsHint(getStringSetting("quotes.embed_step_details_hint", stepDetailsHint));
    setServiceTitle(getStringSetting("quotes.embed_service_title", serviceTitle));
    setProductTitle(getStringSetting("quotes.embed_product_title", productTitle));
    setSpecsTitle(getStringSetting("quotes.embed_specs_title", specsTitle));
    setDetailsTitle(getStringSetting("quotes.embed_details_title", detailsTitle));
    setPdfBrandName(getStringSetting("quotes.pdf_brand_name", pdfBrandName));
    setPdfBrandTagline(getStringSetting("quotes.pdf_brand_tagline", pdfBrandTagline));
    setPdfLogoUrl(getStringSetting("quotes.pdf_logo_url", pdfLogoUrl));
    setPdfHeaderBgColor(getStringSetting("quotes.pdf_header_bg_color", pdfHeaderBgColor));
    setPdfAccentColor(getStringSetting("quotes.pdf_accent_color", pdfAccentColor));
    setPdfPageBgColor(getStringSetting("quotes.pdf_page_bg_color", pdfPageBgColor));
    setPdfFooterText(getStringSetting("quotes.pdf_footer_text", pdfFooterText));
    setPdfIntroTitle(getStringSetting("quotes.pdf_intro_title", pdfIntroTitle));
    setPdfIntroText(getStringSetting("quotes.pdf_intro_text", pdfIntroText));
    setPdfAboutTitle(getStringSetting("quotes.pdf_about_title", pdfAboutTitle));
    setPdfAboutText(getStringSetting("quotes.pdf_about_text", pdfAboutText));
    setPdfServicesTitle(getStringSetting("quotes.pdf_services_title", pdfServicesTitle));
    setPdfServicesCardsJson(getJsonSetting("quotes.pdf_services_cards_json", DEFAULT_PDF_SERVICES_CARDS_JSON));
    setPdfProcessTitle(getStringSetting("quotes.pdf_process_title", pdfProcessTitle));
    setPdfProcessStepsJson(getJsonSetting("quotes.pdf_process_steps_json", DEFAULT_PDF_PROCESS_STEPS_JSON));
    setPdfTipsTitle(getStringSetting("quotes.pdf_tips_title", pdfTipsTitle));
    setPdfTipsJson(getJsonSetting("quotes.pdf_tips_json", DEFAULT_PDF_TIPS_JSON));
    setPdfNextStepsTitle(getStringSetting("quotes.pdf_next_steps_title", pdfNextStepsTitle));
    setPdfNextStepsJson(getJsonSetting("quotes.pdf_next_steps_json", DEFAULT_PDF_NEXT_STEPS_JSON));
    setPdfSignatureClientTitle(getStringSetting("quotes.pdf_signature_client_title", pdfSignatureClientTitle));
    setPdfSignatureCompanyTitle(getStringSetting("quotes.pdf_signature_company_title", pdfSignatureCompanyTitle));
    setPdfSignatureCompanySigner(getStringSetting("quotes.pdf_signature_company_signer", pdfSignatureCompanySigner));
    setPdfSignatureCompanyRole(getStringSetting("quotes.pdf_signature_company_role", pdfSignatureCompanyRole));
    setProductSpecsJson(getJsonSetting("quotes.embed_product_specs_json", "{}"));
    setCategoryIconsJson(getJsonSetting("quotes.embed_category_icons_json", "{}"));
    setProductIconsJson(getJsonSetting("quotes.embed_product_icons_json", "{}"));
    setIconLibraryJson(getJsonSetting("quotes.embed_icon_library_json", "[]"));
    setLoaded(true);
  }, [
    settings,
    loaded,
    title,
    description,
    color,
    badge,
    disclaimer,
    ctaLabel,
    darkColor,
    bgColor,
    configMode,
    companyName,
    companyTagline,
    logoUrl,
    footerContact,
    footerPhone,
    footerWebsite,
    stepServiceLabel,
    stepProductLabel,
    stepSpecsLabel,
    stepDetailsLabel,
    stepServiceHint,
    stepProductHint,
    stepSpecsHint,
    stepDetailsHint,
    serviceTitle,
    productTitle,
    specsTitle,
    detailsTitle,
    pdfBrandName,
    pdfBrandTagline,
    pdfLogoUrl,
    pdfHeaderBgColor,
    pdfAccentColor,
    pdfPageBgColor,
    pdfFooterText,
    pdfIntroTitle,
    pdfIntroText,
    pdfAboutTitle,
    pdfAboutText,
    pdfServicesTitle,
    pdfProcessTitle,
    pdfTipsTitle,
    pdfNextStepsTitle,
    pdfSignatureClientTitle,
    pdfSignatureCompanyTitle,
    pdfSignatureCompanySigner,
    pdfSignatureCompanyRole,
    productSpecsJson,
    categoryIconsJson,
    productIconsJson,
    iconLibraryJson,
  ]);

  useEffect(() => {
    if (!servicesQuery.data) return;
    setServices(
      servicesQuery.data.map((service) => ({
        id: service.id,
        category: service.category,
        name: service.name,
        description: service.description || "",
        basePrice: service.basePrice,
        unit: service.unit || "per stuk",
        sortOrder: service.sortOrder,
        isActive: service.isActive,
      }))
    );
  }, [servicesQuery.data]);

  const tenantToken = useMemo(() => {
    const value = settings?.["chatbot.public_tenant_token"];
    return typeof value === "string" ? value.trim() : "";
  }, [settings]);

  const embedCode = useMemo(
    () => `<iframe
  src="${getAppUrl()}/embed/quotes${tenantToken ? `?tenant=${encodeURIComponent(tenantToken)}` : ""}"
  width="100%"
  height="900"
  style="border:0;border-radius:24px;overflow:hidden"
  loading="lazy"
></iframe>`,
    [tenantToken]
  );

  const builderProductChoices = useMemo(
    () =>
      services
        .filter((service) => service.name.trim())
        .map((service) => ({
          key: service.id || normalizeKey(`${service.category}-${service.name}`),
          label: `${service.category} - ${service.name}`,
          service,
        })),
    [services],
  );
  const activeBuilderService = builderProductChoices.find((item) => item.key === activeBuilderKey)?.service;
  const suggestedTemplateType = useMemo(
    () => inferTemplateType(activeBuilderService),
    [activeBuilderService],
  );
  const previewServices = useMemo(
    () => {
      const usedIds = new Set<string>();
      return services
        .filter((service) => service.isActive)
        .filter((service) => service.name.trim().length > 0)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((service, index) => {
          const baseId = service.id || getBuilderProductKey(service) || `service-${index + 1}`;
          let resolvedId = baseId;
          let suffix = 2;
          while (usedIds.has(resolvedId)) {
            resolvedId = `${baseId}-${suffix}`;
            suffix += 1;
          }
          usedIds.add(resolvedId);
          return {
            id: resolvedId,
            category: service.category || "Algemeen",
            name: service.name,
            description: service.description || null,
            basePrice: Number(service.basePrice) || 0,
            unit: service.unit || null,
          };
        });
    },
    [services],
  );
  const previewPayload = useMemo<QuotePreviewPayload>(
    () => ({
      settings: {
        title,
        description,
        color,
        badge,
        disclaimer,
        ctaLabel,
        embedMode: configMode,
        darkColor,
        bgColor,
        companyName,
        companyTagline,
        logoUrl,
        footerContact,
        footerPhone,
        footerWebsite,
        stepServiceLabel,
        stepProductLabel,
        stepSpecsLabel,
        stepDetailsLabel,
        stepServiceHint,
        stepProductHint,
        stepSpecsHint,
        stepDetailsHint,
        categoryIconsJson,
        productIconsJson,
        iconLibraryJson,
        serviceTitle,
        productTitle,
        specsTitle,
        detailsTitle,
        productSpecsJson,
      },
      studio: {
        viewport: previewViewport,
        syncBuilderWithPreview,
        canUndo: historyPast.length > 0,
        canRedo: historyFuture.length > 0,
        autosaveState,
        publishState: hasUnpublishedChanges ? "draft" : "published",
        hasUnpublishedChanges,
        lastPublishedAt,
      },
      services: previewServices,
    }),
    [
      title,
      description,
      color,
      badge,
      disclaimer,
      ctaLabel,
      configMode,
      darkColor,
      bgColor,
      companyName,
      companyTagline,
      logoUrl,
      footerContact,
      footerPhone,
      footerWebsite,
      stepServiceLabel,
      stepProductLabel,
      stepSpecsLabel,
      stepDetailsLabel,
      stepServiceHint,
      stepProductHint,
      stepSpecsHint,
      stepDetailsHint,
      categoryIconsJson,
      productIconsJson,
      iconLibraryJson,
      serviceTitle,
      productTitle,
      specsTitle,
      detailsTitle,
      productSpecsJson,
      previewViewport,
      syncBuilderWithPreview,
      historyPast.length,
      historyFuture.length,
      autosaveState,
      hasUnpublishedChanges,
      lastPublishedAt,
      previewServices,
    ],
  );

  const activeBuilderSpec = activeBuilderKey ? builderSpecsMap[activeBuilderKey] : undefined;
  const inlineStudioIssues = useMemo(
    () => collectInlineStudioIssues(builderSpecsMap),
    [services, builderSpecsMap],
  );
  const selectedPreviewService = useMemo(
    () => getServiceByPreviewProductId(previewSelection.selectedProductId),
    [previewSelection.selectedProductId, services],
  );
  const selectedPreviewBuilderKey = useMemo(
    () => resolveBuilderKeyFromPreviewProductId(previewSelection.selectedProductId),
    [previewSelection.selectedProductId, services],
  );
  const selectedPreviewSpec = selectedPreviewBuilderKey ? builderSpecsMap[selectedPreviewBuilderKey] : undefined;
  const accentRgb = hexToRgb(color);
  const darkRgb = hexToRgb(darkColor);
  const bgRgb = hexToRgb(bgColor);
  const categoryIconsMap = useMemo(() => parseEmojiMap(categoryIconsJson), [categoryIconsJson]);
  const productIconsMap = useMemo(() => parseEmojiMap(productIconsJson), [productIconsJson]);
  const iconLibrary = useMemo(() => parseIconLibrary(iconLibraryJson), [iconLibraryJson]);

  useEffect(() => {
    const parsed = parseJsonEditorValue(productSpecsJson);
    if (!parsed.ok) return;
    const map = parseBuilderSpecsMap(parsed.normalized);
    setBuilderSpecsMap(map);
    if (!activeBuilderKey || !map[activeBuilderKey]) {
      const firstFromMap = Object.keys(map)[0];
      if (firstFromMap) {
        setActiveBuilderKey(firstFromMap);
        return;
      }
      if (builderProductChoices[0]) setActiveBuilderKey(builderProductChoices[0].key);
    }
  }, [productSpecsJson, activeBuilderKey, builderProductChoices]);

  useEffect(() => {
    if (!activeBuilderService) return;
    setSelectedReusableTemplate(inferTemplateType(activeBuilderService));
  }, [activeBuilderService?.category, activeBuilderService?.name]);

  useEffect(() => {
    const targetWindow = previewIframeRef.current?.contentWindow;
    if (!targetWindow) return;
    targetWindow.postMessage(
      {
        type: "digitify-quote-preview",
        payload: previewPayload,
      },
      window.location.origin,
    );
  }, [previewPayload, previewFrameReady]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const raw = event.data as { type?: string; payload?: unknown } | null;
      if (!raw || !raw.type) return;

      if (raw.type === "digitify-quote-preview-state") {
        if (!raw.payload || typeof raw.payload !== "object") return;
        const payload = raw.payload as Record<string, unknown>;
        const currentStep = typeof payload.currentStep === "number" ? payload.currentStep : 1;
        const selectedCategory = typeof payload.selectedCategory === "string" ? payload.selectedCategory : "";
        const selectedProductId = typeof payload.selectedProductId === "string" ? payload.selectedProductId : "";
        setPreviewSelection({
          currentStep,
          selectedCategory,
          selectedProductId,
        });
        return;
      }

      if (raw.type === "digitify-quote-preview-action") {
        if (!raw.payload || typeof raw.payload !== "object") return;
        const payload = raw.payload as Record<string, unknown>;
        const actionType = typeof payload.action === "string" ? payload.action : "";
        const productId = typeof payload.productId === "string" ? payload.productId : "";
        const category = typeof payload.category === "string" ? payload.category : "";
        if (actionType === "set-viewport") {
          const viewport = payload.viewport;
          if (viewport === "desktop" || viewport === "tablet" || viewport === "mobile") {
            setPreviewViewport(viewport);
          }
          return;
        }
        if (actionType === "set-sync") {
          setSyncBuilderWithPreview(Boolean(payload.value));
          return;
        }
        if (actionType === "undo") {
          runUndo();
          return;
        }
        if (actionType === "redo") {
          runRedo();
          return;
        }
        if (actionType === "set-mode") {
          const mode = payload.mode;
          setConfigMode(mode === "advanced" ? "advanced" : "simple");
          return;
        }
        if (actionType === "set-setting") {
          const key = typeof payload.key === "string" ? payload.key : "";
          const value = typeof payload.value === "string" ? payload.value : "";
          if (!key) return;
          if (key === "quotes.embed_title") setTitle(value);
          if (key === "quotes.embed_description") setDescription(value);
          if (key === "quotes.embed_badge") setBadge(value);
          if (key === "quotes.embed_cta_label") setCtaLabel(value);
          if (key === "quotes.embed_company_name") setCompanyName(value);
          if (key === "quotes.embed_company_tagline") setCompanyTagline(value);
          if (key === "quotes.embed_footer_contact") setFooterContact(value);
          if (key === "quotes.embed_footer_phone") setFooterPhone(value);
          if (key === "quotes.embed_footer_website") setFooterWebsite(value);
          if (key === "quotes.embed_color") setColor(value);
          if (key === "quotes.embed_dark_color") setDarkColor(value);
          if (key === "quotes.embed_bg_color") setBgColor(value);
          return;
        }
        if (actionType === "set-category-icon") {
          const categoryName = typeof payload.category === "string" ? payload.category.trim() : "";
          const emoji = typeof payload.emoji === "string" ? payload.emoji.trim() : "";
          if (!categoryName) return;
          setCategoryIconsJson((current) => {
            const map = parseEmojiMap(current);
            if (emoji) map[categoryName] = emoji;
            else delete map[categoryName];
            return stringifyEmojiMap(map);
          });
          return;
        }
        if (actionType === "set-product-icon") {
          const emoji = typeof payload.emoji === "string" ? payload.emoji.trim() : "";
          const service = getServiceByPreviewProductId(productId);
          if (!service) return;
          const key = getProductIconKey(service);
          if (!key) return;
          setProductIconsJson((current) => {
            const map = parseEmojiMap(current);
            if (emoji) map[key] = emoji;
            else delete map[key];
            return stringifyEmojiMap(map);
          });
          return;
        }
        if (actionType === "add-category") {
          const categoryName = category.trim() || "Nieuwe dienst";
          const firstProductName =
            typeof payload.firstProductName === "string" && payload.firstProductName.trim().length > 0
              ? payload.firstProductName.trim()
              : "Nieuw product";
          const firstProductPrice =
            typeof payload.firstProductPrice === "number" && Number.isFinite(payload.firstProductPrice)
              ? Math.max(0, payload.firstProductPrice)
              : 0;
          const categoryEmoji = typeof payload.categoryEmoji === "string" ? payload.categoryEmoji.trim() : "";
          const productEmoji = typeof payload.productEmoji === "string" ? payload.productEmoji.trim() : "";
          setServices((current) => [
            ...current,
            {
              category: categoryName,
              name: firstProductName,
              description: "",
              basePrice: firstProductPrice,
              unit: "per stuk",
              sortOrder: current.length,
              isActive: true,
            },
          ]);
          if (categoryEmoji) {
            setCategoryIconsJson((current) => {
              const map = parseEmojiMap(current);
              map[categoryName] = categoryEmoji;
              return stringifyEmojiMap(map);
            });
          }
          if (productEmoji) {
            const productIconKey = normalizeKey(`${categoryName}:${firstProductName}`);
            if (productIconKey) {
              setProductIconsJson((current) => {
                const map = parseEmojiMap(current);
                map[productIconKey] = productEmoji;
                return stringifyEmojiMap(map);
              });
            }
          }
          return;
        }
        if (actionType === "rename-category") {
          const oldCategory = typeof payload.oldCategory === "string" ? payload.oldCategory.trim() : "";
          const nextCategory = typeof payload.newCategory === "string" ? payload.newCategory.trim() : "";
          if (!oldCategory || !nextCategory || oldCategory === nextCategory) return;
          const affectedServices = services.filter((service) => service.category === oldCategory);
          setServices((current) =>
            current.map((service) =>
              service.category === oldCategory
                ? {
                    ...service,
                    category: nextCategory,
                  }
                : service,
            ),
          );
          setCategoryIconsJson((current) => {
            const map = parseEmojiMap(current);
            if (map[oldCategory]) {
              map[nextCategory] = map[oldCategory]!;
              delete map[oldCategory];
            }
            return stringifyEmojiMap(map);
          });
          setProductIconsJson((current) => {
            const map = parseEmojiMap(current);
            affectedServices.forEach((service) => {
              const oldFallback = normalizeKey(`${oldCategory}:${service.name}`);
              const nextFallback = normalizeKey(`${nextCategory}:${service.name}`);
              if (oldFallback && nextFallback && map[oldFallback] && !map[nextFallback]) {
                map[nextFallback] = map[oldFallback]!;
              }
            });
            return stringifyEmojiMap(map);
          });
          return;
        }
        if (actionType === "remove-category") {
          const categoryName = category.trim();
          if (!categoryName) return;
          const removedServices = services.filter((service) => service.category === categoryName);
          if (!removedServices.length) return;
          setServices((current) => current.filter((service) => service.category !== categoryName));
          removeBuilderSpecsForServices(removedServices);
          setCategoryIconsJson((current) => {
            const map = parseEmojiMap(current);
            delete map[categoryName];
            return stringifyEmojiMap(map);
          });
          setProductIconsJson((current) => {
            const map = parseEmojiMap(current);
            removedServices.forEach((service) => {
              const directKey = getProductIconKey(service);
              const fallbackKey = normalizeKey(`${service.category}:${service.name}`);
              if (directKey) delete map[directKey];
              if (fallbackKey) delete map[fallbackKey];
            });
            return stringifyEmojiMap(map);
          });
          return;
        }
        if (actionType === "update-product") {
          const patch = payload.patch && typeof payload.patch === "object"
            ? (payload.patch as Record<string, unknown>)
            : {};
          updateServiceByPreviewId(productId, (service) => ({
            ...service,
            name: typeof patch.name === "string" ? patch.name : service.name,
            description: typeof patch.description === "string" ? patch.description : service.description,
            category: typeof patch.category === "string" ? patch.category : service.category,
            unit: typeof patch.unit === "string" ? patch.unit : service.unit,
            basePrice:
              typeof patch.basePrice === "number" && Number.isFinite(patch.basePrice)
                ? patch.basePrice
                : service.basePrice,
          }));
          return;
        }
        if (actionType === "save-all") {
          void publishDraft({ showToast: true });
          return;
        }
        if (actionType === "restore-published") {
          restorePublishedDraft();
          return;
        }
        if (actionType === "add-product") {
          const nextCategory = category.trim() || previewSelection.selectedCategory.trim() || "Algemeen";
          const nextName =
            typeof payload.name === "string" && payload.name.trim().length > 0
              ? payload.name.trim()
              : "Nieuw product";
          const nextDescription = typeof payload.description === "string" ? payload.description : "";
          const nextPrice =
            typeof payload.basePrice === "number" && Number.isFinite(payload.basePrice)
              ? payload.basePrice
              : 0;
          const nextUnit =
            typeof payload.unit === "string" && payload.unit.trim().length > 0
              ? payload.unit
              : "per stuk";
          const categoryEmoji = typeof payload.categoryEmoji === "string" ? payload.categoryEmoji.trim() : "";
          const productEmoji = typeof payload.productEmoji === "string" ? payload.productEmoji.trim() : "";
          setServices((current) => [
            ...current,
            {
              category: nextCategory,
              name: nextName,
              description: nextDescription,
              basePrice: nextPrice,
              unit: nextUnit,
              sortOrder: current.length,
              isActive: true,
            },
          ]);
          if (categoryEmoji) {
            setCategoryIconsJson((current) => {
              const map = parseEmojiMap(current);
              map[nextCategory] = categoryEmoji;
              return stringifyEmojiMap(map);
            });
          }
          if (productEmoji) {
            const productIconKey = normalizeKey(`${nextCategory}:${nextName}`);
            if (productIconKey) {
              setProductIconsJson((current) => {
                const map = parseEmojiMap(current);
                map[productIconKey] = productEmoji;
                return stringifyEmojiMap(map);
              });
            }
          }
          return;
        }
        if (actionType === "remove-product") {
          if (!productId) return;
          const index = services.findIndex((service) => {
            if (service.id && service.id === productId) return true;
            const builderKey = getBuilderProductKey(service);
            return builderKey === productId || productId.startsWith(`${builderKey}-`);
          });
          if (index >= 0) void removeService(index);
          return;
        }
        const builderKey = resolveBuilderKeyFromPreviewProductId(productId);
        if (!builderKey) return;
        if (actionType === "add-package") {
          addBuilderPackageForKey(builderKey);
          return;
        }
        if (actionType === "add-option") {
          addBuilderOptionForKey(builderKey);
          return;
        }
        if (actionType === "add-slider") {
          addBuilderSliderForKey(builderKey);
          return;
        }
        if (actionType === "add-question") {
          const type = payload.questionType;
          addBuilderQuestionForKey(
            builderKey,
            type === "select" || type === "checkbox" || type === "text" ? type : "text",
          );
          return;
        }
        if (actionType === "add-package-feature") {
          addBuilderPackageFeatureForKey(builderKey, typeof payload.targetKey === "string" ? payload.targetKey : "");
          return;
        }
        if (actionType === "add-question-option") {
          addBuilderQuestionOptionForKey(builderKey, typeof payload.targetKey === "string" ? payload.targetKey : "");
          return;
        }
        if (actionType === "update-package") {
          const patch = payload.patch && typeof payload.patch === "object"
            ? (payload.patch as Record<string, unknown>)
            : {};
          updateBuilderPackageForKey(builderKey, typeof payload.targetKey === "string" ? payload.targetKey : "", {
            label: typeof patch.label === "string" ? patch.label : undefined,
            subtitle: typeof patch.subtitle === "string" ? patch.subtitle : undefined,
            features: Array.isArray(patch.features)
              ? patch.features
                  .filter((feature): feature is string => typeof feature === "string")
                  .map((feature) => feature.trim())
                  .filter((feature) => feature.length > 0)
              : undefined,
            price:
              typeof patch.price === "number" && Number.isFinite(patch.price)
                ? patch.price
                : undefined,
          });
          return;
        }
        if (actionType === "update-option") {
          const patch = payload.patch && typeof payload.patch === "object"
            ? (payload.patch as Record<string, unknown>)
            : {};
          updateBuilderOptionForKey(builderKey, typeof payload.targetKey === "string" ? payload.targetKey : "", {
            label: typeof patch.label === "string" ? patch.label : undefined,
            description: typeof patch.description === "string" ? patch.description : undefined,
            unit: typeof patch.unit === "string" ? patch.unit : undefined,
            price:
              typeof patch.price === "number" && Number.isFinite(patch.price)
                ? patch.price
                : undefined,
          });
          return;
        }
        if (actionType === "update-slider") {
          const patch = payload.patch && typeof payload.patch === "object"
            ? (payload.patch as Record<string, unknown>)
            : {};
          updateBuilderSliderForKey(builderKey, typeof payload.targetKey === "string" ? payload.targetKey : "", {
            label: typeof patch.label === "string" ? patch.label : undefined,
            hint: typeof patch.hint === "string" ? patch.hint : undefined,
            unitLabel: typeof patch.unitLabel === "string" ? patch.unitLabel : undefined,
            min: typeof patch.min === "number" && Number.isFinite(patch.min) ? patch.min : undefined,
            max: typeof patch.max === "number" && Number.isFinite(patch.max) ? patch.max : undefined,
            step: typeof patch.step === "number" && Number.isFinite(patch.step) ? patch.step : undefined,
            included:
              typeof patch.included === "number" && Number.isFinite(patch.included)
                ? patch.included
                : undefined,
            pricePerUnit:
              typeof patch.pricePerUnit === "number" && Number.isFinite(patch.pricePerUnit)
                ? patch.pricePerUnit
                : undefined,
          });
          return;
        }
        if (actionType === "update-package-feature") {
          const featureIndex =
            typeof payload.featureIndex === "number" && Number.isFinite(payload.featureIndex)
              ? payload.featureIndex
              : -1;
          const value = typeof payload.value === "string" ? payload.value : "";
          if (featureIndex < 0) return;
          updateBuilderPackageFeatureForKey(
            builderKey,
            typeof payload.targetKey === "string" ? payload.targetKey : "",
            featureIndex,
            value,
          );
          return;
        }
        if (actionType === "update-questions-card") {
          const patch = payload.patch && typeof payload.patch === "object"
            ? (payload.patch as Record<string, unknown>)
            : {};
          const current = builderSpecsMap[builderKey];
          if (!current) return;
          updateBuilderMap({
            ...builderSpecsMap,
            [builderKey]: {
              ...current,
              questionsCard: {
                ...(current.questionsCard || {}),
                title: typeof patch.title === "string" ? patch.title : current.questionsCard?.title,
                subtitle:
                  typeof patch.subtitle === "string" ? patch.subtitle : current.questionsCard?.subtitle,
              },
            },
          });
          setActiveBuilderKey(builderKey);
          return;
        }
        if (actionType === "update-question") {
          const patch = payload.patch && typeof payload.patch === "object"
            ? (payload.patch as Record<string, unknown>)
            : {};
          const options = Array.isArray(patch.options)
            ? patch.options
                .filter((item): item is string => typeof item === "string")
                .map((item) => item.trim())
                .filter((item) => item.length > 0)
            : undefined;
          updateBuilderQuestionForKey(
            builderKey,
            typeof payload.targetKey === "string" ? payload.targetKey : "",
            {
              label: typeof patch.label === "string" ? patch.label : undefined,
              type:
                patch.type === "select" || patch.type === "checkbox" || patch.type === "text"
                  ? patch.type
                  : undefined,
              required: typeof patch.required === "boolean" ? patch.required : undefined,
              placeholder: typeof patch.placeholder === "string" ? patch.placeholder : undefined,
              helpText: typeof patch.helpText === "string" ? patch.helpText : undefined,
              showWhenPackageKey:
                typeof patch.showWhenPackageKey === "string" ? patch.showWhenPackageKey : undefined,
              showWhenOptionKey:
                typeof patch.showWhenOptionKey === "string" ? patch.showWhenOptionKey : undefined,
              options,
            },
          );
          return;
        }
        if (actionType === "update-question-option") {
          const optionIndex =
            typeof payload.optionIndex === "number" && Number.isFinite(payload.optionIndex)
              ? payload.optionIndex
              : -1;
          const value = typeof payload.value === "string" ? payload.value : "";
          if (optionIndex < 0) return;
          updateBuilderQuestionOptionForKey(
            builderKey,
            typeof payload.targetKey === "string" ? payload.targetKey : "",
            optionIndex,
            value,
          );
          return;
        }
        const targetKey = typeof payload.targetKey === "string" ? payload.targetKey : "";
        if (actionType === "remove-package-feature") {
          const featureIndex =
            typeof payload.featureIndex === "number" && Number.isFinite(payload.featureIndex)
              ? payload.featureIndex
              : -1;
          if (featureIndex < 0) return;
          removeBuilderPackageFeatureForKey(builderKey, targetKey, featureIndex);
          return;
        }
        if (actionType === "remove-package") {
          removeBuilderPackageForKey(builderKey, targetKey);
          return;
        }
        if (actionType === "remove-option") {
          removeBuilderOptionForKey(builderKey, targetKey);
          return;
        }
        if (actionType === "remove-slider") {
          removeBuilderSliderForKey(builderKey, targetKey);
          return;
        }
        if (actionType === "remove-question") {
          removeBuilderQuestionForKey(builderKey, targetKey);
          return;
        }
        if (actionType === "remove-question-option") {
          const optionIndex =
            typeof payload.optionIndex === "number" && Number.isFinite(payload.optionIndex)
              ? payload.optionIndex
              : -1;
          if (optionIndex < 0) return;
          removeBuilderQuestionOptionForKey(builderKey, targetKey, optionIndex);
        }
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [
    previewSelection.selectedCategory,
    services,
    builderSpecsMap,
    builderProductChoices,
    publishedSnapshot,
  ]);

  useEffect(() => {
    if (!syncBuilderWithPreview) return;
    const builderKey = resolveBuilderKeyFromPreviewProductId(previewSelection.selectedProductId);
    if (!builderKey) return;
    setActiveBuilderKey(builderKey);
  }, [previewSelection.selectedProductId, syncBuilderWithPreview, services]);

  useEffect(() => {
    if (!loaded || !servicesQuery.data || initialPublishedSnapshotSetRef.current) return;
    if (productSpecsJson.trim() !== "{}" && Object.keys(builderSpecsMap).length === 0) return;
    const snapshot = createSnapshot();
    setPublishedSnapshot(snapshot);
    setLastPublishedAt(new Date().toISOString());
    setHasUnpublishedChanges(false);
    setHistoryPast([]);
    setHistoryFuture([]);
    initialPublishedSnapshotSetRef.current = true;
  }, [loaded, servicesQuery.data, builderSpecsMap, services, productSpecsJson]);

  useEffect(() => {
    const snapshot = createSnapshot();
    const signature = JSON.stringify(snapshot);
    const publishedSignature = publishedSnapshot ? JSON.stringify(publishedSnapshot) : "";

    if (!isMountedRef.current) {
      isMountedRef.current = true;
      lastSnapshotRef.current = signature;
      if (publishedSignature) setHasUnpublishedChanges(signature !== publishedSignature);
      return;
    }

    if (applyingHistoryRef.current) {
      lastSnapshotRef.current = signature;
      if (publishedSignature) setHasUnpublishedChanges(signature !== publishedSignature);
      return;
    }

    if (signature === lastSnapshotRef.current) {
      if (publishedSignature) setHasUnpublishedChanges(signature !== publishedSignature);
      return;
    }

    if (lastSnapshotRef.current) {
      try {
        const previous = JSON.parse(lastSnapshotRef.current) as StudioSnapshot;
        setHistoryPast((list) => [...list, { snapshot: previous, timestamp: Date.now() }].slice(-100));
        setHistoryFuture([]);
      } catch {
        // ignore malformed history snapshot
      }
    }

    lastSnapshotRef.current = signature;
    setHasUnpublishedChanges(publishedSignature ? signature !== publishedSignature : true);
    if (autosaveState === "saved") setAutosaveState("idle");
  }, [
    loaded,
    publishedSnapshot,
    configMode,
    title,
    description,
    badge,
    disclaimer,
    ctaLabel,
    color,
    darkColor,
    bgColor,
    companyName,
    companyTagline,
    logoUrl,
    footerContact,
    footerPhone,
    footerWebsite,
    stepServiceLabel,
    stepProductLabel,
    stepSpecsLabel,
    stepDetailsLabel,
    stepServiceHint,
    stepProductHint,
    stepSpecsHint,
    stepDetailsHint,
    serviceTitle,
    productTitle,
    specsTitle,
    detailsTitle,
    categoryIconsJson,
    productIconsJson,
    iconLibraryJson,
    services,
    builderSpecsMap,
  ]);

  useEffect(() => {
    if (autosaveState !== "saved") return;
    const timer = setTimeout(() => setAutosaveState("idle"), 1500);
    return () => clearTimeout(timer);
  }, [autosaveState]);

  function updateColorValue(next: string, target: "accent" | "dark" | "bg") {
    const value = isHexColor(next) ? next.toUpperCase() : next;
    if (target === "accent") setColor(value);
    if (target === "dark") setDarkColor(value);
    if (target === "bg") setBgColor(value);
  }

  function updateRgbChannel(target: "accent" | "dark" | "bg", channel: "r" | "g" | "b", value: string) {
    const parsed = Number(value);
    const safe = Number.isFinite(parsed) ? Math.max(0, Math.min(255, parsed)) : 0;
    const source = target === "accent" ? accentRgb : target === "dark" ? darkRgb : bgRgb;
    const nextHex = rgbToHex(
      channel === "r" ? safe : source.r,
      channel === "g" ? safe : source.g,
      channel === "b" ? safe : source.b,
    );
    updateColorValue(nextHex, target);
  }

  function getProductIconKey(service: EditableService) {
    return service.id || normalizeKey(`${service.category}:${service.name}`);
  }

  function getBuilderProductKey(service: EditableService) {
    return service.id || normalizeKey(`${service.category}-${service.name}`);
  }

  function getBuilderSpecCandidatesForService(
    service: Pick<EditableService, "id" | "category" | "name">,
  ) {
    const name = service.name.trim();
    const category = service.category.trim();
    const categoryHyphen = normalizeKey(`${category}-${name}`);
    const categoryColon = `${category}:${name}`;
    return [...new Set([
      service.id || "",
      categoryHyphen,
      categoryColon,
      normalizeKey(categoryColon),
      name,
      normalizeKey(name),
    ].filter(Boolean))];
  }

  function findExistingBuilderSpecForService(
    sourceMap: BuilderSpecsMap,
    service: Pick<EditableService, "id" | "category" | "name">,
  ) {
    const candidates = getBuilderSpecCandidatesForService(service);
    for (const candidate of candidates) {
      const spec = sourceMap[candidate];
      if (spec) return { key: candidate, spec };
    }
    return null;
  }

  function getBuilderSpecRemovalKeysForService(
    service: Pick<EditableService, "id" | "category" | "name">,
  ) {
    const name = service.name.trim();
    const category = service.category.trim();
    const categoryHyphen = normalizeKey(`${category}-${name}`);
    const categoryColon = `${category}:${name}`;
    return [...new Set([
      service.id || "",
      categoryHyphen,
      categoryColon,
      normalizeKey(categoryColon),
    ].filter(Boolean))];
  }

  function removeBuilderSpecsForServices(removedServices: EditableService[]) {
    if (!removedServices.length) return;
    const keysToRemove = new Set(
      removedServices.flatMap((service) => getBuilderSpecRemovalKeysForService(service)),
    );
    if (!keysToRemove.size) return;
    let changed = false;
    const next = { ...builderSpecsMap };
    keysToRemove.forEach((key) => {
      if (key in next) {
        delete next[key];
        changed = true;
      }
    });
    if (changed) updateBuilderMap(next);
  }

  function resolveBuilderKeyFromPreviewProductId(productId: string) {
    if (!productId) return "";
    const exactById = services.find((service) => service.id === productId);
    if (exactById) return getBuilderProductKey(exactById);
    const exactByBuilderKey = services.find((service) => getBuilderProductKey(service) === productId);
    if (exactByBuilderKey) return getBuilderProductKey(exactByBuilderKey);
    const prefixed = services.find((service) => {
      const key = getBuilderProductKey(service);
      return key && productId.startsWith(`${key}-`);
    });
    return prefixed ? getBuilderProductKey(prefixed) : "";
  }

  async function uploadConfiguratorImage(file: File) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Kies een PNG, JPG, SVG of WebP bestand.");
    }
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      throw new Error(payload.error || "Kon het bestand niet uploaden.");
    }
    return payload.url;
  }

  async function handleConfiguratorLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setLogoUploading(true);
    try {
      const url = await uploadConfiguratorImage(file);
      setLogoUrl(url);
      showToast({ title: "Logo geupload", description: "Het configurator-logo is klaar om te publiceren." });
    } catch (error) {
      showToast({
        title: "Upload mislukt",
        description: error instanceof Error ? error.message : "Kon het bestand niet opslaan.",
        variant: "error",
      });
    } finally {
      setLogoUploading(false);
    }
  }

  async function uploadIconLibraryFile(file: File) {
    try {
      return await uploadConfiguratorImage(file);
    } catch (error) {
      showToast({
        title: "Upload mislukt",
        description: error instanceof Error ? error.message : "Kon het icoon niet uploaden.",
        variant: "error",
      });
      return null;
    }
  }

  function updateIconLibrary(items: QuoteIconLibraryItem[]) {
    setIconLibraryJson(stringifyIconLibrary(items));
    setIconsError(null);
    setIconsInfo(null);
  }

  function setCategoryIcon(category: string, emoji: string) {
    const key = category.trim();
    if (!key) return;
    const next = { ...categoryIconsMap };
    if (emoji.trim()) next[key] = emoji.trim();
    else delete next[key];
    setCategoryIconsJson(stringifyEmojiMap(next));
    setIconsError(null);
    setIconsInfo(null);
  }

  function setProductIcon(service: EditableService, emoji: string) {
    const key = getProductIconKey(service);
    if (!key) return;
    const next = { ...productIconsMap };
    if (emoji.trim()) next[key] = emoji.trim();
    else delete next[key];
    setProductIconsJson(stringifyEmojiMap(next));
    setIconsError(null);
    setIconsInfo(null);
  }

  function validateEmojiMaps(showSuccess = false) {
    const categoryParsed = parseJsonEditorValue(categoryIconsJson);
    const productParsed = parseJsonEditorValue(productIconsJson);
    if (!categoryParsed.ok) {
      setIconsError(`Categorie-icons JSON ongeldig: ${categoryParsed.error}`);
      setIconsInfo(null);
      return false;
    }
    if (!productParsed.ok) {
      setIconsError(`Product-icons JSON ongeldig: ${productParsed.error}`);
      setIconsInfo(null);
      return false;
    }
    setCategoryIconsJson(stringifyEmojiMap(parseEmojiMap(categoryParsed.normalized)));
    setProductIconsJson(stringifyEmojiMap(parseEmojiMap(productParsed.normalized)));
    setIconsError(null);
    setIconsInfo("Icons JSON is geldig.");
    if (showSuccess) {
      showToast({ title: "Icons opgeslagen", description: "Emoji/icon mapping is geldig." });
    }
    return true;
  }

  function updateBuilderMap(next: BuilderSpecsMap) {
    setBuilderSpecsMap(next);
    setProductSpecsJson(serializeBuilderSpecsMap(next));
    setProductSpecsError(null);
    setProductSpecsInfo(null);
  }

  function buildDefaultBuilderSpec(serviceName: string, description: string, basePrice: number): BuilderSpec {
    const base = Math.max(1, Number(basePrice) || 0);
    return {
      headline: `${serviceName} - Specificaties`,
      subheadline: description || "Specifieke keuzes voor uw offerte",
      packageSectionTitle: "PAKKET / SERVICE",
      packages: [
        {
          key: "basis",
          label: "Basis",
          subtitle: "Startpakket",
          price: Math.round(base),
          features: ["Basis oplevering"],
          defaultSelected: true,
        },
      ],
      optionSections: [],
      sliders: [],
      questionsCard: {
        title: "Vragen voor een nauwkeurige offerte",
        subtitle: "Beantwoord uw voorkeuren voor een betere prijsopgave.",
      },
      questions: buildDefaultQuestions(),
      notesPlaceholder: "Extra info, specifieke wensen of vragen...",
    };
  }

  function ensureActiveBuilderProduct() {
    const selected = builderProductChoices.find((item) => item.key === activeBuilderKey);
    if (!selected) return;
    if (builderSpecsMap[selected.key]) return;
    const next = {
      ...builderSpecsMap,
      [selected.key]: buildDefaultBuilderSpec(
        selected.service.name,
        selected.service.description,
        selected.service.basePrice,
      ),
    };
    updateBuilderMap(next);
  }

  function updateActiveBuilderSpec(updater: (current: BuilderSpec) => BuilderSpec) {
    if (!activeBuilderKey) return;
    const current = builderSpecsMap[activeBuilderKey];
    if (!current) return;
    updateBuilderMap({
      ...builderSpecsMap,
      [activeBuilderKey]: updater(current),
    });
  }

  function reorderArray<T>(list: T[], from: number, to: number) {
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  }

  function removeActiveBuilderProduct() {
    if (!activeBuilderKey) return;
    if (!builderSpecsMap[activeBuilderKey]) return;
    const next = { ...builderSpecsMap };
    delete next[activeBuilderKey];
    updateBuilderMap(next);
  }

  function applyReusableTemplate(templateType: ReusableBlockTemplateType) {
    if (!activeBuilderKey || !activeBuilderService) return;
    const template = buildReusableBlockTemplate(templateType, activeBuilderService);
    updateActiveBuilderSpec((current) => ({
      ...template,
      headline: current.headline || template.headline,
      subheadline: current.subheadline || template.subheadline,
    }));
    setSelectedReusableTemplate(templateType);
    showToast({
      title: "Template toegepast",
      description: `Bloktemplate "${templateType}" is toegepast op dit product.`,
    });
  }

  function addBuilderPackage() {
    updateActiveBuilderSpec((current) => {
      const packages = [...(current.packages || [])];
      const sequence = packages.length + 1;
      packages.push({
        key: `pakket-${sequence}`,
        label: `Pakket ${sequence}`,
        subtitle: "",
        price: 0,
        features: [],
      });
      if (!packages.some((item) => item.defaultSelected) && packages[0]) {
        packages[0] = { ...packages[0], defaultSelected: true };
      }
      return { ...current, packages };
    });
  }

  function getServiceByBuilderKey(builderKey: string) {
    return builderProductChoices.find((item) => item.key === builderKey)?.service;
  }

  function ensureBuilderSpecForKey(current: BuilderSpecsMap, builderKey: string) {
    if (current[builderKey]) return current;
    const service = getServiceByBuilderKey(builderKey);
    if (!service) return current;
    const existing = findExistingBuilderSpecForService(current, service);
    if (existing) {
      return {
        ...current,
        [builderKey]: existing.spec,
      };
    }
    return {
      ...current,
      [builderKey]: buildDefaultBuilderSpec(service.name, service.description, service.basePrice),
    };
  }

  function addBuilderPackageForKey(builderKey: string) {
    let next = ensureBuilderSpecForKey(builderSpecsMap, builderKey);
    const current = next[builderKey];
    if (!current) return;
    const packages = [...(current.packages || [])];
    const sequence = packages.length + 1;
    packages.push({
      key: `pakket-${sequence}`,
      label: `Pakket ${sequence}`,
      subtitle: "",
      price: 0,
      features: [],
    });
    if (!packages.some((item) => item.defaultSelected) && packages[0]) {
      packages[0] = { ...packages[0], defaultSelected: true };
    }
    next = { ...next, [builderKey]: { ...current, packages } };
    updateBuilderMap(next);
    setActiveBuilderKey(builderKey);
  }

  function addBuilderOptionForKey(builderKey: string) {
    let next = ensureBuilderSpecForKey(builderSpecsMap, builderKey);
    const current = next[builderKey];
    if (!current) return;
    const sections = [...(current.optionSections || [])];
    if (!sections.length) {
      sections.push({ title: "EXTRA OPTIES", options: [] });
    }
    const firstSection = sections[0]!;
    const options = [...firstSection.options];
    const sequence = options.length + 1;
    options.push({
      key: `optie-${sequence}`,
      label: `Nieuwe optie ${sequence}`,
      price: 0,
      unit: "",
      description: "",
    });
    sections[0] = { ...firstSection, options };
    next = { ...next, [builderKey]: { ...current, optionSections: sections } };
    updateBuilderMap(next);
    setActiveBuilderKey(builderKey);
  }

  function addBuilderSliderForKey(builderKey: string) {
    let next = ensureBuilderSpecForKey(builderSpecsMap, builderKey);
    const current = next[builderKey];
    if (!current) return;
    const sliders = [...(current.sliders || [])];
    const sequence = sliders.length + 1;
    sliders.push({
      key: `slider-${sequence}`,
      label: `Nieuwe slider ${sequence}`,
      min: 1,
      max: 1000,
      step: 1,
      included: 0,
      pricePerUnit: 0,
      unitLabel: "",
      hint: "",
      defaultValue: 1,
    });
    next = { ...next, [builderKey]: { ...current, sliders } };
    updateBuilderMap(next);
    setActiveBuilderKey(builderKey);
  }

  function addBuilderQuestionForKey(builderKey: string, type: BuilderQuestionType = "text") {
    let next = ensureBuilderSpecForKey(builderSpecsMap, builderKey);
    const current = next[builderKey];
    if (!current) return;
    const questions = [...(current.questions || [])];
    const used = new Set(questions.map((item) => item.key));
    const baseKey = normalizeKey(`${type}-vraag`) || "vraag";
    let questionKey = baseKey;
    let suffix = 2;
    while (used.has(questionKey)) {
      questionKey = `${baseKey}-${suffix}`;
      suffix += 1;
    }
    const defaults: BuilderQuestion = {
      key: questionKey,
      label:
        type === "select"
          ? "Nieuwe dropdown vraag"
          : type === "checkbox"
            ? "Nieuwe checkbox vraag"
            : "Nieuwe tekstvraag",
      type,
      required: false,
      options: type === "select" ? ["Optie 1", "Optie 2"] : [],
      placeholder: type === "text" ? "Uw antwoord..." : "",
      helpText: "",
    };
    questions.push(defaults);
    next = { ...next, [builderKey]: { ...current, questions } };
    updateBuilderMap(next);
    setActiveBuilderKey(builderKey);
  }

  function updateBuilderQuestionForKey(
    builderKey: string,
    questionKey: string,
    patch: Partial<BuilderQuestion>,
  ) {
    if (!builderKey || !questionKey) return;
    const current = builderSpecsMap[builderKey];
    if (!current) return;
    const safePatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as Partial<BuilderQuestion>;
    const nextQuestions = (current.questions || []).map((question) => {
      if (question.key !== questionKey) return question;
      const nextQuestion = {
        ...question,
        ...safePatch,
      };
      if (nextQuestion.type !== "select") {
        nextQuestion.options = [];
      } else if (!Array.isArray(nextQuestion.options) || nextQuestion.options.length === 0) {
        nextQuestion.options = ["Optie 1"];
      }
      return nextQuestion;
    });
    updateBuilderMap({
      ...builderSpecsMap,
      [builderKey]: {
        ...current,
        questions: nextQuestions,
      },
    });
    setActiveBuilderKey(builderKey);
  }

  function removeBuilderQuestionForKey(builderKey: string, questionKey: string) {
    if (!builderKey || !questionKey) return;
    const current = builderSpecsMap[builderKey];
    if (!current) return;
    updateBuilderMap({
      ...builderSpecsMap,
      [builderKey]: {
        ...current,
        questions: (current.questions || []).filter((question) => question.key !== questionKey),
      },
    });
    setActiveBuilderKey(builderKey);
  }

  function addBuilderQuestionOptionForKey(builderKey: string, questionKey: string) {
    if (!builderKey || !questionKey) return;
    const current = builderSpecsMap[builderKey];
    if (!current) return;
    updateBuilderMap({
      ...builderSpecsMap,
      [builderKey]: {
        ...current,
        questions: (current.questions || []).map((question) => {
          if (question.key !== questionKey) return question;
          const options = [...(question.options || [])];
          options.push(`Optie ${options.length + 1}`);
          return { ...question, options };
        }),
      },
    });
    setActiveBuilderKey(builderKey);
  }

  function updateBuilderQuestionOptionForKey(
    builderKey: string,
    questionKey: string,
    optionIndex: number,
    value: string,
  ) {
    if (!builderKey || !questionKey) return;
    const current = builderSpecsMap[builderKey];
    if (!current) return;
    updateBuilderMap({
      ...builderSpecsMap,
      [builderKey]: {
        ...current,
        questions: (current.questions || []).map((question) => {
          if (question.key !== questionKey) return question;
          const options = [...(question.options || [])];
          if (!options[optionIndex] && optionIndex !== 0) return question;
          options[optionIndex] = value;
          return { ...question, options };
        }),
      },
    });
    setActiveBuilderKey(builderKey);
  }

  function removeBuilderQuestionOptionForKey(builderKey: string, questionKey: string, optionIndex: number) {
    if (!builderKey || !questionKey) return;
    const current = builderSpecsMap[builderKey];
    if (!current) return;
    updateBuilderMap({
      ...builderSpecsMap,
      [builderKey]: {
        ...current,
        questions: (current.questions || []).map((question) => {
          if (question.key !== questionKey) return question;
          const options = (question.options || []).filter((_, idx) => idx !== optionIndex);
          return { ...question, options };
        }),
      },
    });
    setActiveBuilderKey(builderKey);
  }

  function removeBuilderPackageForKey(builderKey: string, packageKey: string) {
    if (!builderKey || !packageKey) return;
    const current = builderSpecsMap[builderKey];
    if (!current) return;
    const packages = (current.packages || []).filter((item) => item.key !== packageKey);
    const normalized =
      packages.some((item) => item.defaultSelected) || packages.length === 0
        ? packages
        : packages.map((item, index) => ({ ...item, defaultSelected: index === 0 }));
    updateBuilderMap({
      ...builderSpecsMap,
      [builderKey]: {
        ...current,
        packages: normalized,
      },
    });
    setActiveBuilderKey(builderKey);
  }

  function removeBuilderOptionForKey(builderKey: string, optionKey: string) {
    if (!builderKey || !optionKey) return;
    const current = builderSpecsMap[builderKey];
    if (!current) return;
    const optionSections = (current.optionSections || []).map((section) => ({
      ...section,
      options: section.options.filter((option) => option.key !== optionKey),
    }));
    updateBuilderMap({
      ...builderSpecsMap,
      [builderKey]: {
        ...current,
        optionSections,
      },
    });
    setActiveBuilderKey(builderKey);
  }

  function removeBuilderSliderForKey(builderKey: string, sliderKey: string) {
    if (!builderKey || !sliderKey) return;
    const current = builderSpecsMap[builderKey];
    if (!current) return;
    updateBuilderMap({
      ...builderSpecsMap,
      [builderKey]: {
        ...current,
        sliders: (current.sliders || []).filter((slider) => slider.key !== sliderKey),
      },
    });
    setActiveBuilderKey(builderKey);
  }

  function updateServiceByPreviewId(
    productId: string,
    updater: (service: EditableService) => EditableService,
  ) {
    if (!productId) return;
    setServices((current) =>
      current.map((service) => {
        const builderKey = getBuilderProductKey(service);
        const isMatch =
          (service.id && service.id === productId) ||
          builderKey === productId ||
          productId.startsWith(`${builderKey}-`);
        return isMatch ? updater(service) : service;
      }),
    );
  }

  function getServiceByPreviewProductId(productId: string) {
    if (!productId) return null;
    return (
      services.find((service) => {
        const builderKey = getBuilderProductKey(service);
        return (service.id && service.id === productId) || builderKey === productId || productId.startsWith(`${builderKey}-`);
      }) || null
    );
  }

  function updateBuilderPackageForKey(
    builderKey: string,
    packageKey: string,
    patch: Partial<BuilderPackage>,
  ) {
    if (!builderKey || !packageKey) return;
    const current = builderSpecsMap[builderKey];
    if (!current) return;
    const safePatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as Partial<BuilderPackage>;
    updateBuilderMap({
      ...builderSpecsMap,
      [builderKey]: {
        ...current,
        packages: (current.packages || []).map((pkg) =>
          pkg.key === packageKey
            ? {
                ...pkg,
                ...safePatch,
              }
            : pkg,
        ),
      },
    });
    setActiveBuilderKey(builderKey);
  }

  function addBuilderPackageFeatureForKey(builderKey: string, packageKey: string) {
    if (!builderKey || !packageKey) return;
    const current = builderSpecsMap[builderKey];
    if (!current) return;
    updateBuilderMap({
      ...builderSpecsMap,
      [builderKey]: {
        ...current,
        packages: (current.packages || []).map((pkg) =>
          pkg.key === packageKey
            ? { ...pkg, features: [...(pkg.features || []), "Nieuwe bullet"] }
            : pkg,
        ),
      },
    });
    setActiveBuilderKey(builderKey);
  }

  function updateBuilderPackageFeatureForKey(
    builderKey: string,
    packageKey: string,
    featureIndex: number,
    value: string,
  ) {
    if (!builderKey || !packageKey) return;
    const current = builderSpecsMap[builderKey];
    if (!current) return;
    updateBuilderMap({
      ...builderSpecsMap,
      [builderKey]: {
        ...current,
        packages: (current.packages || []).map((pkg) => {
          if (pkg.key !== packageKey) return pkg;
          const features = [...(pkg.features || [])];
          if (!features[featureIndex] && featureIndex !== 0) return pkg;
          features[featureIndex] = value;
          return { ...pkg, features };
        }),
      },
    });
    setActiveBuilderKey(builderKey);
  }

  function removeBuilderPackageFeatureForKey(
    builderKey: string,
    packageKey: string,
    featureIndex: number,
  ) {
    if (!builderKey || !packageKey) return;
    const current = builderSpecsMap[builderKey];
    if (!current) return;
    updateBuilderMap({
      ...builderSpecsMap,
      [builderKey]: {
        ...current,
        packages: (current.packages || []).map((pkg) => {
          if (pkg.key !== packageKey) return pkg;
          const features = (pkg.features || []).filter((_, idx) => idx !== featureIndex);
          return { ...pkg, features };
        }),
      },
    });
    setActiveBuilderKey(builderKey);
  }

  function updateBuilderOptionForKey(
    builderKey: string,
    optionKey: string,
    patch: Partial<BuilderOption>,
  ) {
    if (!builderKey || !optionKey) return;
    const current = builderSpecsMap[builderKey];
    if (!current) return;
    const safePatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as Partial<BuilderOption>;
    updateBuilderMap({
      ...builderSpecsMap,
      [builderKey]: {
        ...current,
        optionSections: (current.optionSections || []).map((section) => ({
          ...section,
          options: section.options.map((option) =>
            option.key === optionKey
              ? {
                  ...option,
                  ...safePatch,
                }
              : option,
          ),
        })),
      },
    });
    setActiveBuilderKey(builderKey);
  }

  function updateBuilderSliderForKey(
    builderKey: string,
    sliderKey: string,
    patch: Partial<BuilderSlider>,
  ) {
    if (!builderKey || !sliderKey) return;
    const current = builderSpecsMap[builderKey];
    if (!current) return;
    const safePatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as Partial<BuilderSlider>;
    updateBuilderMap({
      ...builderSpecsMap,
      [builderKey]: {
        ...current,
        sliders: (current.sliders || []).map((slider) =>
          slider.key === sliderKey
            ? {
                ...slider,
                ...safePatch,
              }
            : slider,
        ),
      },
    });
    setActiveBuilderKey(builderKey);
  }

  function createSnapshot(): StudioSnapshot {
    return {
      configMode,
      title,
      description,
      badge,
      disclaimer,
      ctaLabel,
      color,
      darkColor,
      bgColor,
      companyName,
      companyTagline,
      logoUrl,
      footerContact,
      footerPhone,
      footerWebsite,
      stepServiceLabel,
      stepProductLabel,
      stepSpecsLabel,
      stepDetailsLabel,
      stepServiceHint,
      stepProductHint,
      stepSpecsHint,
      stepDetailsHint,
      serviceTitle,
      productTitle,
      specsTitle,
      detailsTitle,
      categoryIconsJson,
      productIconsJson,
      iconLibraryJson,
      services: services.map((service) => ({ ...service })),
      builderSpecsMap: JSON.parse(JSON.stringify(builderSpecsMap)) as BuilderSpecsMap,
    };
  }

  function applySnapshot(snapshot: StudioSnapshot) {
    applyingHistoryRef.current = true;
    setConfigMode(snapshot.configMode);
    setTitle(snapshot.title);
    setDescription(snapshot.description);
    setBadge(snapshot.badge);
    setDisclaimer(snapshot.disclaimer);
    setCtaLabel(snapshot.ctaLabel);
    setColor(snapshot.color);
    setDarkColor(snapshot.darkColor);
    setBgColor(snapshot.bgColor);
    setCompanyName(snapshot.companyName);
    setCompanyTagline(snapshot.companyTagline);
    setLogoUrl(snapshot.logoUrl);
    setFooterContact(snapshot.footerContact);
    setFooterPhone(snapshot.footerPhone);
    setFooterWebsite(snapshot.footerWebsite);
    setStepServiceLabel(snapshot.stepServiceLabel);
    setStepProductLabel(snapshot.stepProductLabel);
    setStepSpecsLabel(snapshot.stepSpecsLabel);
    setStepDetailsLabel(snapshot.stepDetailsLabel);
    setStepServiceHint(snapshot.stepServiceHint);
    setStepProductHint(snapshot.stepProductHint);
    setStepSpecsHint(snapshot.stepSpecsHint);
    setStepDetailsHint(snapshot.stepDetailsHint);
    setServiceTitle(snapshot.serviceTitle);
    setProductTitle(snapshot.productTitle);
    setSpecsTitle(snapshot.specsTitle);
    setDetailsTitle(snapshot.detailsTitle);
    setCategoryIconsJson(snapshot.categoryIconsJson);
    setProductIconsJson(snapshot.productIconsJson);
    setIconLibraryJson(snapshot.iconLibraryJson ?? "[]");
    setServices(snapshot.services.map((service) => ({ ...service })));
    setBuilderSpecsMap(JSON.parse(JSON.stringify(snapshot.builderSpecsMap)) as BuilderSpecsMap);
    setProductSpecsJson(
      serializeBuilderSpecsMap(
        JSON.parse(JSON.stringify(snapshot.builderSpecsMap)) as BuilderSpecsMap,
      ),
    );
    setTimeout(() => {
      applyingHistoryRef.current = false;
    }, 0);
  }

  function runUndo() {
    if (!historyPast.length) return;
    const current = createSnapshot();
    const previous = historyPast[historyPast.length - 1]!;
    setHistoryPast((list) => list.slice(0, -1));
    setHistoryFuture((list) => [{ snapshot: current, timestamp: Date.now() }, ...list].slice(0, 100));
    applySnapshot(previous.snapshot);
  }

  function runRedo() {
    if (!historyFuture.length) return;
    const current = createSnapshot();
    const next = historyFuture[0]!;
    setHistoryFuture((list) => list.slice(1));
    setHistoryPast((list) => [...list, { snapshot: current, timestamp: Date.now() }].slice(-100));
    applySnapshot(next.snapshot);
  }

  function ensureSpecsForActiveServices(sourceMap: BuilderSpecsMap) {
    const next: BuilderSpecsMap = {};
    services.forEach((service) => {
      if (!service.isActive || !service.name.trim()) return;
      const existing = findExistingBuilderSpecForService(sourceMap, service);
      const preferredKey =
        service.id || normalizeKey(`${service.category}-${service.name}`) || normalizeKey(service.name);
      if (!preferredKey) return;
      next[preferredKey] =
        existing?.spec || buildDefaultBuilderSpec(service.name, service.description, service.basePrice);
    });
    return next;
  }

  function validateConfiguratorRules(
    showToastOnError = false,
    sourceMap: BuilderSpecsMap = builderSpecsMap,
  ) {
    const errors: string[] = [];
    const normalizedMap = sourceMap;
    services.forEach((service) => {
      if (!service.name.trim()) errors.push("Een product heeft geen naam.");
      if ((Number(service.basePrice) || 0) < 0) errors.push(`Negatieve basisprijs bij ${service.name || "product"}.`);
      if (!service.isActive) return;
      const candidates = getBuilderSpecCandidatesForService(service);
      const spec = candidates.map((key) => normalizedMap[key]).find(Boolean);
      if (!spec) {
        errors.push(`Product ${service.name} heeft geen specificatieblok met pakket.`);
      }
    });

    Object.entries(normalizedMap).forEach(([productKey, spec]) => {
      const packages = spec.packages || [];
      if (packages.length < 1) errors.push(`Product ${productKey} heeft minstens 1 pakket nodig.`);
      const defaults = packages.filter((pkg) => pkg.defaultSelected).length;
      if (packages.length > 0 && defaults !== 1) {
        errors.push(`Product ${productKey} moet exact 1 default pakket hebben.`);
      }
      packages.forEach((pkg) => {
        if ((Number(pkg.price) || 0) < 0) errors.push(`Negatieve pakketprijs in ${productKey}.`);
      });
      (spec.optionSections || []).forEach((section) => {
        section.options.forEach((option) => {
          if ((Number(option.price) || 0) < 0) errors.push(`Negatieve optieprijs (${option.label}) in ${productKey}.`);
        });
      });
      (spec.sliders || []).forEach((slider) => {
        if ((Number(slider.pricePerUnit) || 0) < 0) errors.push(`Negatieve sliderprijs (${slider.label}) in ${productKey}.`);
      });
      (spec.questions || []).forEach((question) => {
        if (!question.label?.trim()) errors.push(`Lege vraagtitel in ${productKey}.`);
        if (question.type === "select" && (!question.options || question.options.length < 1)) {
          errors.push(`Dropdownvraag zonder keuzes in ${productKey}.`);
        }
        if (question.showWhenPackageKey && !(spec.packages || []).some((pkg) => pkg.key === question.showWhenPackageKey)) {
          errors.push(`Vraag met ongeldige pakket-conditie in ${productKey}.`);
        }
        if (
          question.showWhenOptionKey &&
          !(spec.optionSections || []).some((section) => section.options.some((option) => option.key === question.showWhenOptionKey))
        ) {
          errors.push(`Vraag met ongeldige optie-conditie in ${productKey}.`);
        }
      });
    });

    if (errors.length && showToastOnError) {
      showToast({
        title: "Validatie mislukt",
        description: errors[0],
        variant: "error",
      });
    }
    return { ok: errors.length === 0, errors };
  }

  function collectInlineStudioIssues(sourceMap: BuilderSpecsMap = builderSpecsMap) {
    const issues: Array<{ severity: "error" | "warning"; message: string }> = [];
    const seenCategoryProduct = new Set<string>();

    services.forEach((service) => {
      const category = service.category.trim() || "Algemeen";
      const name = service.name.trim();
      if (!name) {
        issues.push({ severity: "error", message: "Een product mist een naam." });
        return;
      }
      const key = `${category.toLowerCase()}::${name.toLowerCase()}`;
      if (seenCategoryProduct.has(key)) {
        issues.push({ severity: "warning", message: `Dubbel product in dezelfde categorie: ${category} - ${name}.` });
      }
      seenCategoryProduct.add(key);
      if ((Number(service.basePrice) || 0) < 0) {
        issues.push({ severity: "error", message: `Negatieve basisprijs bij ${name}.` });
      }
    });

    Object.entries(sourceMap).forEach(([productKey, spec]) => {
      const defaults = (spec.packages || []).filter((pkg) => pkg.defaultSelected).length;
      if ((spec.packages || []).length > 0 && defaults !== 1) {
        issues.push({ severity: "error", message: `${productKey}: exact 1 default pakket vereist.` });
      }
      (spec.packages || []).forEach((pkg) => {
        if (!pkg.label.trim()) issues.push({ severity: "error", message: `${productKey}: pakket zonder naam.` });
        if ((Number(pkg.price) || 0) < 0) issues.push({ severity: "error", message: `${productKey}: negatieve pakketprijs.` });
        const normalizedFeatures = (pkg.features || []).map((feature) => feature.trim().toLowerCase()).filter(Boolean);
        if (new Set(normalizedFeatures).size !== normalizedFeatures.length) {
          issues.push({ severity: "warning", message: `${productKey}: dubbele bullets in pakket ${pkg.label}.` });
        }
      });
      (spec.questions || []).forEach((question) => {
        if (!question.label?.trim()) issues.push({ severity: "error", message: `${productKey}: lege vraagtitel.` });
        if (question.type === "select" && (!question.options || question.options.length === 0)) {
          issues.push({ severity: "error", message: `${productKey}: dropdownvraag zonder opties.` });
        }
        if (question.showWhenPackageKey && !(spec.packages || []).some((pkg) => pkg.key === question.showWhenPackageKey)) {
          issues.push({
            severity: "warning",
            message: `${productKey}: vraag "${question.label}" verwijst naar onbekend pakket.`,
          });
        }
        if (
          question.showWhenOptionKey &&
          !(spec.optionSections || []).some((section) => section.options.some((option) => option.key === question.showWhenOptionKey))
        ) {
          issues.push({
            severity: "warning",
            message: `${productKey}: vraag "${question.label}" verwijst naar onbekende optie.`,
          });
        }
      });
    });

    return issues;
  }

  function addBuilderSection() {
    updateActiveBuilderSpec((current) => ({
      ...current,
      optionSections: [...(current.optionSections || []), { title: "NIEUWE OPTIES", options: [] }],
    }));
  }

  function addBuilderOption(sectionIndex: number) {
    updateActiveBuilderSpec((current) => {
      const sections = [...(current.optionSections || [])];
      const section = sections[sectionIndex];
      if (!section) return current;
      const options = [...section.options, { key: `optie-${section.options.length + 1}`, label: "Nieuwe optie", price: 0 }];
      sections[sectionIndex] = { ...section, options };
      return { ...current, optionSections: sections };
    });
  }

  function addBuilderSlider() {
    updateActiveBuilderSpec((current) => ({
      ...current,
      sliders: [
        ...(current.sliders || []),
        {
          key: `slider-${(current.sliders || []).length + 1}`,
          label: "Nieuwe slider",
          min: 1,
          max: 1000,
          step: 1,
          included: 0,
          pricePerUnit: 0,
          unitLabel: "",
          hint: "",
          defaultValue: 1,
        },
      ],
    }));
  }

  function validateSpecsJson(showSuccess = false) {
    const result = parseJsonEditorValue(productSpecsJson);
    if (!result.ok) {
      setProductSpecsError(result.error);
      setProductSpecsInfo(null);
      if (showSuccess) {
        showToast({
          title: "JSON ongeldig",
          description: result.error,
          variant: "error",
        });
      }
      return null;
    }
    setProductSpecsError(null);
    setProductSpecsInfo("JSON is geldig.");
    if (showSuccess) {
      showToast({
        title: "JSON geldig",
        description: "Product-specificaties kunnen opgeslagen worden.",
      });
    }
    return result.normalized;
  }

  function formatSpecsJson() {
    const normalized = validateSpecsJson(false);
    if (!normalized) return;
    setProductSpecsJson(normalized);
    setProductSpecsInfo("JSON geformatteerd.");
  }

  function generateSpecsTemplateFromCatalog() {
    const template = buildProductSpecsTemplate(services);
    setProductSpecsJson(template);
    setProductSpecsError(null);
    setProductSpecsInfo("Template gegenereerd uit de huidige catalogus.");
    showToast({
      title: "Template gegenereerd",
      description: "De JSON editor is gevuld met per-product specificatieblokken.",
    });
  }

  function loadDigitifyScreenshotPreset() {
    const preset = buildDigitifyScreenshotPreset();
    setProductSpecsJson(preset);
    setProductSpecsError(null);
    setProductSpecsInfo("Digitify screenshot preset geladen.");
    showToast({
      title: "Screenshot preset geladen",
      description: "Per-product specificaties zijn ingevuld volgens de voorbeeldblokken.",
    });
  }

  function buildSettingsUpdatePayload(specsPayload: string) {
    return [
      { key: "quotes.embed_title", value: title },
      { key: "quotes.embed_description", value: description },
      { key: "quotes.embed_color", value: color },
      { key: "quotes.embed_badge", value: badge },
      { key: "quotes.embed_disclaimer", value: disclaimer },
      { key: "quotes.embed_cta_label", value: ctaLabel },
      { key: "quotes.embed_dark_color", value: darkColor },
      { key: "quotes.embed_bg_color", value: bgColor },
      { key: "quotes.embed_mode", value: configMode },
      { key: "quotes.embed_company_name", value: companyName },
      { key: "quotes.embed_company_tagline", value: companyTagline },
      { key: "quotes.embed_logo_url", value: logoUrl },
      { key: "quotes.embed_footer_contact", value: footerContact },
      { key: "quotes.embed_footer_phone", value: footerPhone },
      { key: "quotes.embed_footer_website", value: footerWebsite },
      { key: "quotes.embed_step_service_label", value: stepServiceLabel },
      { key: "quotes.embed_step_product_label", value: stepProductLabel },
      { key: "quotes.embed_step_specs_label", value: stepSpecsLabel },
      { key: "quotes.embed_step_details_label", value: stepDetailsLabel },
      { key: "quotes.embed_step_service_hint", value: stepServiceHint },
      { key: "quotes.embed_step_product_hint", value: stepProductHint },
      { key: "quotes.embed_step_specs_hint", value: stepSpecsHint },
      { key: "quotes.embed_step_details_hint", value: stepDetailsHint },
      { key: "quotes.embed_service_title", value: serviceTitle },
      { key: "quotes.embed_product_title", value: productTitle },
      { key: "quotes.embed_specs_title", value: specsTitle },
      { key: "quotes.embed_details_title", value: detailsTitle },
      { key: "quotes.pdf_brand_name", value: pdfBrandName },
      { key: "quotes.pdf_brand_tagline", value: pdfBrandTagline },
      { key: "quotes.pdf_logo_url", value: pdfLogoUrl },
      { key: "quotes.pdf_header_bg_color", value: pdfHeaderBgColor },
      { key: "quotes.pdf_accent_color", value: pdfAccentColor },
      { key: "quotes.pdf_page_bg_color", value: pdfPageBgColor },
      { key: "quotes.pdf_footer_text", value: pdfFooterText },
      { key: "quotes.pdf_intro_title", value: pdfIntroTitle },
      { key: "quotes.pdf_intro_text", value: pdfIntroText },
      { key: "quotes.pdf_about_title", value: pdfAboutTitle },
      { key: "quotes.pdf_about_text", value: pdfAboutText },
      { key: "quotes.pdf_services_title", value: pdfServicesTitle },
      { key: "quotes.pdf_services_cards_json", value: pdfServicesCardsJson },
      { key: "quotes.pdf_process_title", value: pdfProcessTitle },
      { key: "quotes.pdf_process_steps_json", value: pdfProcessStepsJson },
      { key: "quotes.pdf_tips_title", value: pdfTipsTitle },
      { key: "quotes.pdf_tips_json", value: pdfTipsJson },
      { key: "quotes.pdf_next_steps_title", value: pdfNextStepsTitle },
      { key: "quotes.pdf_next_steps_json", value: pdfNextStepsJson },
      { key: "quotes.pdf_signature_client_title", value: pdfSignatureClientTitle },
      { key: "quotes.pdf_signature_company_title", value: pdfSignatureCompanyTitle },
      { key: "quotes.pdf_signature_company_signer", value: pdfSignatureCompanySigner },
      { key: "quotes.pdf_signature_company_role", value: pdfSignatureCompanyRole },
      { key: "quotes.embed_product_specs_json", value: specsPayload },
      { key: "quotes.embed_category_icons_json", value: categoryIconsJson },
      { key: "quotes.embed_product_icons_json", value: productIconsJson },
      { key: "quotes.embed_icon_library_json", value: iconLibraryJson },
    ];
  }

  function buildPdfSettingsOnlyPayload() {
    return [
      { key: "quotes.pdf_brand_name", value: pdfBrandName },
      { key: "quotes.pdf_brand_tagline", value: pdfBrandTagline },
      { key: "quotes.pdf_logo_url", value: pdfLogoUrl },
      { key: "quotes.pdf_header_bg_color", value: pdfHeaderBgColor },
      { key: "quotes.pdf_accent_color", value: pdfAccentColor },
      { key: "quotes.pdf_page_bg_color", value: pdfPageBgColor },
      { key: "quotes.pdf_footer_text", value: pdfFooterText },
      { key: "quotes.pdf_intro_title", value: pdfIntroTitle },
      { key: "quotes.pdf_intro_text", value: pdfIntroText },
      { key: "quotes.pdf_about_title", value: pdfAboutTitle },
      { key: "quotes.pdf_about_text", value: pdfAboutText },
      { key: "quotes.pdf_services_title", value: pdfServicesTitle },
      { key: "quotes.pdf_services_cards_json", value: pdfServicesCardsJson },
      { key: "quotes.pdf_process_title", value: pdfProcessTitle },
      { key: "quotes.pdf_process_steps_json", value: pdfProcessStepsJson },
      { key: "quotes.pdf_tips_title", value: pdfTipsTitle },
      { key: "quotes.pdf_tips_json", value: pdfTipsJson },
      { key: "quotes.pdf_next_steps_title", value: pdfNextStepsTitle },
      { key: "quotes.pdf_next_steps_json", value: pdfNextStepsJson },
      { key: "quotes.pdf_signature_client_title", value: pdfSignatureClientTitle },
      { key: "quotes.pdf_signature_company_title", value: pdfSignatureCompanyTitle },
      { key: "quotes.pdf_signature_company_signer", value: pdfSignatureCompanySigner },
      { key: "quotes.pdf_signature_company_role", value: pdfSignatureCompanyRole },
    ];
  }

  function handleCopy() {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    showToast({
      title: "Embed-code gekopieerd",
      description: "De offerte-configurator embed staat nu op je klembord.",
    });
    window.setTimeout(() => setCopied(false), 2000);
  }

  function addService() {
    setServices((current) => [
      ...current,
      {
        category: "Algemeen",
        name: "",
        description: "",
        basePrice: 0,
        unit: "per stuk",
        sortOrder: current.length,
        isActive: true,
      },
    ]);
  }

  function updateService(index: number, field: keyof EditableService, value: string | number | boolean) {
    setServices((current) =>
      current.map((service, serviceIndex) =>
        serviceIndex === index ? { ...service, [field]: value } : service
      )
    );
  }

  async function removeService(index: number) {
    const target = services[index];
    setServices((current) => current.filter((_, serviceIndex) => serviceIndex !== index));
    if (target) removeBuilderSpecsForServices([target]);
    if (target?.id) {
      await deleteService.mutateAsync({ id: target.id });
      await utils.quote.getServices.invalidate();
    }
  }

  function reorderServices(fromId: string, toId: string) {
    setServices((current) => {
      const next = [...current];
      const fromIndex = next.findIndex((item) => item.id === fromId || (!item.id && `${item.name}-${item.sortOrder}` === fromId));
      const toIndex = next.findIndex((item) => item.id === toId || (!item.id && `${item.name}-${item.sortOrder}` === toId));
      if (fromIndex === -1 || toIndex === -1) return current;
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next.map((item, index) => ({ ...item, sortOrder: index }));
    });
  }

  async function saveCatalog(
    nextServices = services,
    options: { showToast?: boolean } = {},
  ) {
    const showFeedback = options.showToast ?? true;
    setSyncingCatalog(true);
    try {
      const existingIds = new Set((servicesQuery.data || []).map((service) => service.id));
      const savedServices = await Promise.all(
        nextServices.map((service, index) =>
          upsertService.mutateAsync({
            id: service.id,
            category: service.category,
            name: service.name,
            description: service.description || undefined,
            basePrice: Number(service.basePrice) || 0,
            unit: service.unit || undefined,
            isActive: service.isActive,
            sortOrder: index,
          })
        )
      );
      const savedIds = new Set(savedServices.map((service) => service.id));
      const idsToDelete = [...existingIds].filter((id) => !savedIds.has(id));
      if (idsToDelete.length) {
        await Promise.all(
          idsToDelete.map(async (id) => {
            try {
              await deleteService.mutateAsync({ id });
            } catch (error) {
              const message = error instanceof Error ? error.message.toLowerCase() : "";
              if (!message.includes("not found") && !message.includes("record to delete")) {
                throw error;
              }
            }
          }),
        );
      }
      setServices(
        nextServices.map((service, index) => ({
          ...service,
          id: savedServices[index]?.id || service.id,
          sortOrder: index,
        })),
      );
      await utils.quote.getServices.invalidate();
      if (showFeedback) {
        showToast({ title: "Catalogus opgeslagen", description: "Producten en diensten zijn bijgewerkt." });
      }
    } catch (error) {
      if (showFeedback) {
        showToast({
          title: "Catalogus opslaan mislukt",
          description: error instanceof Error ? error.message : "Probeer opnieuw.",
          variant: "error",
        });
      }
      throw error;
    } finally {
      setSyncingCatalog(false);
    }
  }

  async function persistAll(options: { showToast?: boolean; source?: "manual" | "autosave" } = {}) {
    const showFeedback = options.showToast ?? true;
    const source = options.source || "manual";
    const ensuredMap = ensureSpecsForActiveServices(builderSpecsMap);
    if (JSON.stringify(ensuredMap) !== JSON.stringify(builderSpecsMap)) {
      updateBuilderMap(ensuredMap);
    }
    const normalizedSpecs = validateSpecsJson(configMode === "advanced" && source === "manual");
    const specsPayload = normalizedSpecs || serializeBuilderSpecsMap(ensuredMap);
    if (configMode === "advanced" && !normalizedSpecs) return false;
    if (!validateEmojiMaps(configMode === "advanced" && source === "manual")) return false;
    const rules = validateConfiguratorRules(showFeedback && source === "manual", ensuredMap);
    if (!rules.ok) {
      setAutosaveState("error");
      return false;
    }
    setAutosaveState("saving");
    try {
      await batchUpdate.mutateAsync(buildSettingsUpdatePayload(specsPayload));
      await saveCatalog(services, { showToast: false });
      setAutosaveState("saved");
      if (showFeedback) {
        showToast({
          title: "Studio gepubliceerd",
          description: "Configurator en instellingen staan nu live.",
        });
      }
      return true;
    } catch (error) {
      setAutosaveState("error");
      if (showFeedback) {
        showToast({
          title: "Opslaan mislukt",
          description: error instanceof Error ? error.message : "Probeer opnieuw.",
          variant: "error",
        });
      }
      return false;
    }
  }

  async function publishDraft(options: { showToast?: boolean } = {}) {
    const ok = await persistAll({ showToast: options.showToast ?? true, source: "manual" });
    if (!ok) return false;
    const snapshot = createSnapshot();
    setPublishedSnapshot(snapshot);
    setHasUnpublishedChanges(false);
    setLastPublishedAt(new Date().toISOString());
    return true;
  }

  function handlePublish() {
    void publishDraft({ showToast: true });
  }

  async function savePdfSettingsOnly() {
    try {
      await batchUpdate.mutateAsync(buildPdfSettingsOnlyPayload());
      showToast({
        title: "PDF instellingen opgeslagen",
        description: "PDF export branding, content en opmaak zijn bijgewerkt.",
      });
    } catch (error) {
      showToast({
        title: "Opslaan mislukt",
        description: error instanceof Error ? error.message : "Probeer opnieuw.",
        variant: "error",
      });
    }
  }

  function restorePublishedDraft() {
    if (!publishedSnapshot) return;
    const snapshot = JSON.parse(JSON.stringify(publishedSnapshot)) as StudioSnapshot;
    applySnapshot(snapshot);
    setAutosaveState("idle");
  }

  function restoreHistorySnapshot(indexFromLatest: number) {
    const entry = historyPast[historyPast.length - 1 - indexFromLatest];
    if (!entry) return;
    const snapshot = JSON.parse(JSON.stringify(entry.snapshot)) as StudioSnapshot;
    applySnapshot(snapshot);
  }

  async function applyTemplate(templateKey: keyof typeof SERVICE_TEMPLATES) {
    setSyncingCatalog(true);
    try {
      await Promise.all(
        (servicesQuery.data || []).map((service) => deleteService.mutateAsync({ id: service.id }))
      );
      const template = SERVICE_TEMPLATES[templateKey];
      await Promise.all(
        template.map((service, index) =>
          upsertService.mutateAsync({
            ...service,
            sortOrder: index,
          })
        )
      );
      await utils.quote.getServices.invalidate();
      showToast({ title: "Template geladen", description: `${templateKey} staat nu in de catalogus.` });
    } catch (error) {
      showToast({
        title: "Template laden mislukt",
        description: error instanceof Error ? error.message : "Probeer opnieuw.",
        variant: "error",
      });
    } finally {
      setSyncingCatalog(false);
      setPendingTemplateKey(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[520px]" />
          <Skeleton className="h-[520px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ConfirmDialog
        open={Boolean(pendingTemplateKey)}
        title="Catalogustemplate laden?"
        description={
          pendingTemplateKey
            ? `Template "${pendingTemplateKey}" vervangt de huidige catalogus met voorgeladen diensten.`
            : undefined
        }
        confirmLabel="Template laden"
        destructive={false}
        loading={syncingCatalog}
        onOpenChange={(open) => {
          if (!open) setPendingTemplateKey(null);
        }}
        onConfirm={() => {
          if (pendingTemplateKey) void applyTemplate(pendingTemplateKey);
        }}
      />
      <div>
        <Link href="/settings" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Terug naar instellingen
        </Link>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Settings2 className="h-6 w-6" />
          Offerte Configurator
        </h1>
        <p className="text-sm text-muted-foreground">
          Beheer de publieke offerte-embed en visuele configurator.
        </p>
      </div>


      {!studioOnlyMode ? (
      <Card>
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Modus</p>
            <p className="text-xs text-muted-foreground">
              {configMode === "advanced"
                ? "Advanced: alle velden en geavanceerde prijslogica zichtbaar."
                : "Simple: no-code workflow met minimale complexiteit."}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className={`text-xs font-medium ${configMode === "simple" ? "text-foreground" : "text-muted-foreground"}`}>Simple</span>
            <Switch checked={configMode === "advanced"} onCheckedChange={(checked) => setConfigMode(checked ? "advanced" : "simple")} />
            <span className={`text-xs font-medium ${configMode === "advanced" ? "text-foreground" : "text-muted-foreground"}`}>Advanced</span>
          </div>
        </CardContent>
      </Card>
      ) : null}

      {!studioOnlyMode ? (
      <Tabs value={settingsTab} onValueChange={(value) => setSettingsTab(value as SettingsTab)}>
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="studio">Studio</TabsTrigger>
          <TabsTrigger value="config">Widget</TabsTrigger>
          <TabsTrigger value="catalog">Catalogus</TabsTrigger>
          <TabsTrigger value="all">Alles</TabsTrigger>
        </TabsList>
      </Tabs>
      ) : null}

      {(!studioOnlyMode && (settingsTab === "config" || settingsTab === "all")) ? (
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(380px,0.85fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4" />
              Widget Configuratie
            </CardTitle>
            <CardDescription>
              Deze instellingen sturen de publieke offerte-configurator aan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Titel</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Beschrijving</Label>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
            </div>
            <div className="space-y-2">
              <Label>Badge tekst</Label>
              <Input value={badge} onChange={(event) => setBadge(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>CTA knoptekst</Label>
              <Input value={ctaLabel} onChange={(event) => setCtaLabel(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Disclaimer / interne melding</Label>
              <Textarea value={disclaimer} onChange={(event) => setDisclaimer(event.target.value)} rows={3} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Primaire accentkleur</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={isHexColor(color) ? color : "#E6A94A"}
                    onChange={(event) => updateColorValue(event.target.value, "accent")}
                    className="h-10 w-12 rounded border"
                  />
                  <Input value={color} onChange={(event) => updateColorValue(event.target.value, "accent")} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" min="0" max="255" value={accentRgb.r} onChange={(event) => updateRgbChannel("accent", "r", event.target.value)} />
                  <Input type="number" min="0" max="255" value={accentRgb.g} onChange={(event) => updateRgbChannel("accent", "g", event.target.value)} />
                  <Input type="number" min="0" max="255" value={accentRgb.b} onChange={(event) => updateRgbChannel("accent", "b", event.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Donkere balkkleur</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={isHexColor(darkColor) ? darkColor : "#14171D"}
                    onChange={(event) => updateColorValue(event.target.value, "dark")}
                    className="h-10 w-12 rounded border"
                  />
                  <Input value={darkColor} onChange={(event) => updateColorValue(event.target.value, "dark")} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" min="0" max="255" value={darkRgb.r} onChange={(event) => updateRgbChannel("dark", "r", event.target.value)} />
                  <Input type="number" min="0" max="255" value={darkRgb.g} onChange={(event) => updateRgbChannel("dark", "g", event.target.value)} />
                  <Input type="number" min="0" max="255" value={darkRgb.b} onChange={(event) => updateRgbChannel("dark", "b", event.target.value)} />
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Achtergrondkleur</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={isHexColor(bgColor) ? bgColor : "#F3F2EC"}
                    onChange={(event) => updateColorValue(event.target.value, "bg")}
                    className="h-10 w-12 rounded border"
                  />
                  <Input value={bgColor} onChange={(event) => updateColorValue(event.target.value, "bg")} />
                </div>
                <div className="grid grid-cols-3 gap-2 sm:max-w-[420px]">
                  <Input type="number" min="0" max="255" value={bgRgb.r} onChange={(event) => updateRgbChannel("bg", "r", event.target.value)} />
                  <Input type="number" min="0" max="255" value={bgRgb.g} onChange={(event) => updateRgbChannel("bg", "g", event.target.value)} />
                  <Input type="number" min="0" max="255" value={bgRgb.b} onChange={(event) => updateRgbChannel("bg", "b", event.target.value)} />
                </div>
              </div>
            </div>

            <div className="rounded-xl border p-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Branding</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Bedrijfsnaam</Label>
                  <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tagline</Label>
                  <Input value={companyTagline} onChange={(event) => setCompanyTagline(event.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Logo URL (optioneel)</Label>
                  <Input value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} />
                </div>
              </div>
            </div>

            {configMode === "advanced" ? (
              <>
                <div className="rounded-xl border p-3">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step labels</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Stap 1</Label>
                      <Input value={stepServiceLabel} onChange={(event) => setStepServiceLabel(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Stap 2</Label>
                      <Input value={stepProductLabel} onChange={(event) => setStepProductLabel(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Stap 3</Label>
                      <Input value={stepSpecsLabel} onChange={(event) => setStepSpecsLabel(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Stap 4</Label>
                      <Input value={stepDetailsLabel} onChange={(event) => setStepDetailsLabel(event.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border p-3">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Staplogica (uitleg per stap)</p>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label>Stap 1 uitleg</Label>
                      <Textarea value={stepServiceHint} onChange={(event) => setStepServiceHint(event.target.value)} rows={2} />
                    </div>
                    <div className="space-y-1">
                      <Label>Stap 2 uitleg</Label>
                      <Textarea value={stepProductHint} onChange={(event) => setStepProductHint(event.target.value)} rows={2} />
                    </div>
                    <div className="space-y-1">
                      <Label>Stap 3 uitleg</Label>
                      <Textarea value={stepSpecsHint} onChange={(event) => setStepSpecsHint(event.target.value)} rows={2} />
                    </div>
                    <div className="space-y-1">
                      <Label>Stap 4 uitleg</Label>
                      <Textarea value={stepDetailsHint} onChange={(event) => setStepDetailsHint(event.target.value)} rows={2} />
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            <div className="rounded-xl border p-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sectietitels</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Dienst titel</Label>
                  <Input value={serviceTitle} onChange={(event) => setServiceTitle(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Product titel</Label>
                  <Input value={productTitle} onChange={(event) => setProductTitle(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Specificaties titel</Label>
                  <Input value={specsTitle} onChange={(event) => setSpecsTitle(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Gegevens titel</Label>
                  <Input value={detailsTitle} onChange={(event) => setDetailsTitle(event.target.value)} />
                </div>
              </div>
            </div>

            <div className="rounded-xl border p-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Footer</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Contact e-mail</Label>
                  <Input value={footerContact} onChange={(event) => setFooterContact(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Telefoon</Label>
                  <Input value={footerPhone} onChange={(event) => setFooterPhone(event.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Website</Label>
                  <Input value={footerWebsite} onChange={(event) => setFooterWebsite(event.target.value)} />
                </div>
              </div>
            </div>

            <div className="rounded-xl border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Emoji & Icons</p>
                <Button type="button" size="sm" variant="outline" onClick={() => validateEmojiMaps(true)}>
                  Valideer icons
                </Button>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Upload iconen in de bibliotheek en kies ze per categorie of product in de configurator en bij Producten & diensten.
              </p>
              <QuoteIconLibraryPanel
                iconLibrary={iconLibrary}
                onChange={updateIconLibrary}
                onUploadFile={uploadIconLibraryFile}
              />
              {configMode === "advanced" ? (
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Categorie icons JSON</Label>
                    <Textarea value={categoryIconsJson} onChange={(event) => setCategoryIconsJson(event.target.value)} rows={6} className="font-mono text-xs" />
                    <p className="text-xs text-muted-foreground">Voorbeeld: {`{ "Webdesign": "💻", "Media": "https://..." }`}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Product icons JSON</Label>
                    <Textarea value={productIconsJson} onChange={(event) => setProductIconsJson(event.target.value)} rows={6} className="font-mono text-xs" />
                    <p className="text-xs text-muted-foreground">Voorbeeld key: product-id of `categorie:productnaam`.</p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Gebruik de icon-kiezers in `Producten & diensten` hieronder of in de live preview.
                </p>
              )}
              {iconsError ? (
                <p className="mt-2 text-xs font-medium text-red-600">{iconsError}</p>
              ) : iconsInfo ? (
                <p className="mt-2 text-xs font-medium text-emerald-700">{iconsInfo}</p>
              ) : null}
            </div>

            {configMode === "advanced" ? (
              <div className="rounded-xl border p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product-specificaties (JSON)</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={loadDigitifyScreenshotPreset}>
                      Screenshot preset
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={generateSpecsTemplateFromCatalog}>
                      Template uit catalogus
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={formatSpecsJson}>
                      Formatteer
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => validateSpecsJson(true)}>
                      Valideer
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={productSpecsJson}
                  onChange={(event) => {
                    setProductSpecsJson(event.target.value);
                    setProductSpecsError(null);
                    setProductSpecsInfo(null);
                  }}
                  rows={18}
                  className="font-mono text-xs leading-5"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Gebruik sleutel per product-id (aanbevolen) of productnaam. Structuur: <span className="font-mono">{`{ "products": { "<productKey>": { ... } } }`}</span>
                </p>
                {productSpecsError ? (
                  <p className="mt-2 text-xs font-medium text-red-600">{productSpecsError}</p>
                ) : productSpecsInfo ? (
                  <p className="mt-2 text-xs font-medium text-emerald-700">{productSpecsInfo}</p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
                Advanced modus toont de JSON-editor en extra technische velden.
              </div>
            )}

            <Button onClick={handlePublish} disabled={batchUpdate.isPending} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              Publiceren
            </Button>
          </CardContent>
        </Card>

        <Card className="xl:sticky xl:top-20">
          <CardHeader>
            <CardTitle className="text-base">Embed Code</CardTitle>
            <CardDescription>
              Plaats deze configurator op een klantwebsite als iframe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <pre className="overflow-x-auto rounded-xl bg-muted p-4 text-xs leading-6">
                {embedCode}
              </pre>
              <Button type="button" variant="outline" size="sm" className="absolute right-3 top-3" onClick={handleCopy}>
                {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                {copied ? "Gekopieerd" : "Kopieer"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Aanvragen uit deze widget worden alleen opgeslagen. Er wordt niets automatisch verstuurd zonder interne goedkeuring.
            </p>
            <div className="overflow-hidden rounded-3xl border shadow-sm" style={{ backgroundColor: bgColor }}>
              <div className="px-4 py-3 text-white" style={{ backgroundColor: darkColor }}>
                <p className="text-sm font-semibold">{companyName}</p>
                <p className="text-[11px] text-white/60">{companyTagline}</p>
              </div>
              <div className="space-y-3 p-4">
                <div className="inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]" style={{ backgroundColor: color, color: darkColor }}>
                  {badge}
                </div>
                <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{description}</p>
                <div className="grid grid-cols-4 gap-2 text-[10px] font-semibold text-muted-foreground">
                  <span>{stepServiceLabel}</span>
                  <span>{stepProductLabel}</span>
                  <span>{stepSpecsLabel}</span>
                  <span>{stepDetailsLabel}</span>
                </div>
                <button
                  type="button"
                  className="h-11 w-full rounded-full px-4 text-sm font-semibold"
                  style={{ backgroundColor: color, color: darkColor }}
                >
                  {ctaLabel}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      ) : null}

      {(!studioOnlyMode && (settingsTab === "studio" || settingsTab === "all")) ? (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">No-Code Product Builder</CardTitle>
          <CardDescription>
            Beheer per product de specificatieblokken zonder JSON-code: pakketten, extra opties, sliders en stap-3 teksten. Gebruik in de catalogus de knop `Bewerken` om snel een product te selecteren.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="space-y-2">
              <Label>Product voor configuratie</Label>
              <select
                value={activeBuilderKey}
                onChange={(event) => setActiveBuilderKey(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecteer product...</option>
                {builderProductChoices.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="button" variant="outline" className="self-end" onClick={ensureActiveBuilderProduct} disabled={!activeBuilderKey}>
              Product activeren
            </Button>
            <div className="flex gap-2 self-end">
              <Button type="button" variant="outline" onClick={addBuilderPackage} disabled={!activeBuilderSpec}>
                Pakket toevoegen
              </Button>
              <Button type="button" variant="ghost" className="text-destructive" onClick={removeActiveBuilderProduct} disabled={!activeBuilderSpec}>
                Config verwijderen
              </Button>
            </div>
          </div>

          {!activeBuilderKey ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Selecteer eerst een product om de blokken per product visueel te beheren.
            </div>
          ) : !activeBuilderSpec ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Voor dit product bestaat nog geen blok. Klik op <strong>Product activeren</strong> om een startconfiguratie te maken.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Herbruikbare blok-templates</p>
                  <span className="text-xs text-muted-foreground">Aanbevolen: <strong>{suggestedTemplateType}</strong></span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["web", "media", "marketing", "addons"] as ReusableBlockTemplateType[]).map((templateType) => (
                    <Button
                      key={templateType}
                      type="button"
                      size="sm"
                      variant={selectedReusableTemplate === templateType ? "default" : "outline"}
                      onClick={() => applyReusableTemplate(templateType)}
                    >
                      {templateType.toUpperCase()}
                    </Button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Klik op een type om pakketblokken, opties en (indien van toepassing) sliders automatisch te vullen.
                </p>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Headline stap 3</Label>
                  <Input
                    value={activeBuilderSpec.headline || ""}
                    onChange={(event) =>
                      updateActiveBuilderSpec((current) => ({ ...current, headline: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subheadline stap 3</Label>
                  <Input
                    value={activeBuilderSpec.subheadline || ""}
                    onChange={(event) =>
                      updateActiveBuilderSpec((current) => ({ ...current, subheadline: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Titel pakketblok</Label>
                  <Input
                    value={activeBuilderSpec.packageSectionTitle || ""}
                    onChange={(event) =>
                      updateActiveBuilderSpec((current) => ({ ...current, packageSectionTitle: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Placeholder opmerkingen</Label>
                  <Input
                    value={activeBuilderSpec.notesPlaceholder || ""}
                    onChange={(event) =>
                      updateActiveBuilderSpec((current) => ({ ...current, notesPlaceholder: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Info kaart titel</Label>
                  <Input
                    value={activeBuilderSpec.questionsCard?.title || ""}
                    onChange={(event) =>
                      updateActiveBuilderSpec((current) => ({
                        ...current,
                        questionsCard: { ...(current.questionsCard || {}), title: event.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Info kaart subtitel</Label>
                  <Input
                    value={activeBuilderSpec.questionsCard?.subtitle || ""}
                    onChange={(event) =>
                      updateActiveBuilderSpec((current) => ({
                        ...current,
                        questionsCard: { ...(current.questionsCard || {}), subtitle: event.target.value },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pakketten (sleep of pijltjes voor volgorde)</p>
                  <Button type="button" size="sm" variant="outline" onClick={addBuilderPackage}>
                    Pakket toevoegen
                  </Button>
                </div>
                <div className="space-y-2">
                  {(activeBuilderSpec.packages || []).map((pkg, packageIndex) => (
                    <div
                      key={`${pkg.key}-${packageIndex}`}
                      draggable
                      onDragStart={() => setDraggedPackageIndex(packageIndex)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (draggedPackageIndex === null || draggedPackageIndex === packageIndex) return;
                        updateActiveBuilderSpec((current) => ({
                          ...current,
                          packages: reorderArray(current.packages || [], draggedPackageIndex, packageIndex),
                        }));
                        setDraggedPackageIndex(null);
                      }}
                      className="grid gap-2 rounded-lg border bg-muted/30 p-3 lg:grid-cols-[24px_1fr_1fr_130px_120px_auto]"
                    >
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <GripVertical className="h-4 w-4" />
                        <div className="flex flex-col">
                          <button
                            type="button"
                            className="rounded border px-0.5 py-0.5 hover:text-foreground disabled:opacity-40"
                            disabled={packageIndex === 0}
                            onClick={() =>
                              updateActiveBuilderSpec((current) => ({
                                ...current,
                                packages: reorderArray(current.packages || [], packageIndex, packageIndex - 1),
                              }))
                            }
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            className="mt-1 rounded border px-0.5 py-0.5 hover:text-foreground disabled:opacity-40"
                            disabled={packageIndex === (activeBuilderSpec.packages || []).length - 1}
                            onClick={() =>
                              updateActiveBuilderSpec((current) => ({
                                ...current,
                                packages: reorderArray(current.packages || [], packageIndex, packageIndex + 1),
                              }))
                            }
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <Input
                        value={pkg.label}
                        onChange={(event) =>
                          updateActiveBuilderSpec((current) => ({
                            ...current,
                            packages: (current.packages || []).map((item, idx) =>
                              idx === packageIndex ? { ...item, label: event.target.value, key: normalizeKey(event.target.value) || item.key } : item,
                            ),
                          }))
                        }
                        placeholder="Label"
                      />
                      <Input
                        value={pkg.subtitle}
                        onChange={(event) =>
                          updateActiveBuilderSpec((current) => ({
                            ...current,
                            packages: (current.packages || []).map((item, idx) =>
                              idx === packageIndex ? { ...item, subtitle: event.target.value } : item,
                            ),
                          }))
                        }
                        placeholder="Subtitel"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={pkg.price}
                        onChange={(event) =>
                          updateActiveBuilderSpec((current) => ({
                            ...current,
                            packages: (current.packages || []).map((item, idx) =>
                              idx === packageIndex ? { ...item, price: Number(event.target.value) || 0 } : item,
                            ),
                          }))
                        }
                      />
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={Boolean(pkg.defaultSelected)}
                          onChange={(event) =>
                            updateActiveBuilderSpec((current) => ({
                              ...current,
                              packages: (current.packages || []).map((item, idx) => ({
                                ...item,
                                defaultSelected: idx === packageIndex ? event.target.checked : false,
                              })),
                            }))
                          }
                        />
                        Default
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() =>
                          updateActiveBuilderSpec((current) => ({
                            ...current,
                            packages: (current.packages || []).filter((_, idx) => idx !== packageIndex),
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {configMode === "advanced" ? (
                        <div className="lg:col-span-5 lg:col-start-2">
                          <Textarea
                            rows={2}
                            value={(pkg.features || []).join("\n")}
                            onChange={(event) =>
                              updateActiveBuilderSpec((current) => ({
                                ...current,
                                packages: (current.packages || []).map((item, idx) =>
                                  idx === packageIndex
                                    ? {
                                        ...item,
                                        features: event.target.value
                                          .split("\n")
                                          .map((line) => line.trim())
                                          .filter(Boolean),
                                      }
                                    : item,
                                ),
                              }))
                            }
                            placeholder="Features, 1 per regel"
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Optiesecties (sleep of pijltjes voor volgorde)</p>
                  <Button type="button" size="sm" variant="outline" onClick={addBuilderSection}>
                    Sectie toevoegen
                  </Button>
                </div>
                <div className="space-y-3">
                  {(activeBuilderSpec.optionSections || []).map((section, sectionIndex) => (
                    <div
                      key={`${section.title}-${sectionIndex}`}
                      draggable
                      onDragStart={() => setDraggedSectionIndex(sectionIndex)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (draggedSectionIndex === null || draggedSectionIndex === sectionIndex) return;
                        updateActiveBuilderSpec((current) => ({
                          ...current,
                          optionSections: reorderArray(current.optionSections || [], draggedSectionIndex, sectionIndex),
                        }));
                        setDraggedSectionIndex(null);
                      }}
                      className="space-y-2 rounded-lg border bg-muted/30 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <button
                          type="button"
                          className="rounded border px-1 py-0.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
                          disabled={sectionIndex === 0}
                          onClick={() =>
                            updateActiveBuilderSpec((current) => ({
                              ...current,
                              optionSections: reorderArray(current.optionSections || [], sectionIndex, sectionIndex - 1),
                            }))
                          }
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className="rounded border px-1 py-0.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
                          disabled={sectionIndex === (activeBuilderSpec.optionSections || []).length - 1}
                          onClick={() =>
                            updateActiveBuilderSpec((current) => ({
                              ...current,
                              optionSections: reorderArray(current.optionSections || [], sectionIndex, sectionIndex + 1),
                            }))
                          }
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <Input
                          value={section.title}
                          onChange={(event) =>
                            updateActiveBuilderSpec((current) => ({
                              ...current,
                              optionSections: (current.optionSections || []).map((item, idx) =>
                                idx === sectionIndex ? { ...item, title: event.target.value } : item,
                              ),
                            }))
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() =>
                            updateActiveBuilderSpec((current) => ({
                              ...current,
                              optionSections: (current.optionSections || []).filter((_, idx) => idx !== sectionIndex),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {section.options.map((option, optionIndex) => (
                          <div key={`${option.key}-${optionIndex}`} className="grid gap-2 rounded border bg-white p-2 md:grid-cols-[1fr_120px_100px_120px_auto]">
                            <Input
                              value={option.label}
                              onChange={(event) =>
                                updateActiveBuilderSpec((current) => ({
                                  ...current,
                                  optionSections: (current.optionSections || []).map((item, idx) => {
                                    if (idx !== sectionIndex) return item;
                                    return {
                                      ...item,
                                      options: item.options.map((opt, optIdx) =>
                                        optIdx === optionIndex
                                          ? { ...opt, label: event.target.value, key: normalizeKey(event.target.value) || opt.key }
                                          : opt,
                                      ),
                                    };
                                  }),
                                }))
                              }
                              placeholder="Optie label"
                            />
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={option.price}
                              onChange={(event) =>
                                updateActiveBuilderSpec((current) => ({
                                  ...current,
                                  optionSections: (current.optionSections || []).map((item, idx) => {
                                    if (idx !== sectionIndex) return item;
                                    return {
                                      ...item,
                                      options: item.options.map((opt, optIdx) =>
                                        optIdx === optionIndex ? { ...opt, price: Number(event.target.value) || 0 } : opt,
                                      ),
                                    };
                                  }),
                                }))
                              }
                            />
                            <Input
                              value={option.unit || ""}
                              onChange={(event) =>
                                updateActiveBuilderSpec((current) => ({
                                  ...current,
                                  optionSections: (current.optionSections || []).map((item, idx) => {
                                    if (idx !== sectionIndex) return item;
                                    return {
                                      ...item,
                                      options: item.options.map((opt, optIdx) =>
                                        optIdx === optionIndex ? { ...opt, unit: event.target.value } : opt,
                                      ),
                                    };
                                  }),
                                }))
                              }
                              placeholder="/jaar"
                            />
                            <Input
                              value={option.description || ""}
                              onChange={(event) =>
                                updateActiveBuilderSpec((current) => ({
                                  ...current,
                                  optionSections: (current.optionSections || []).map((item, idx) => {
                                    if (idx !== sectionIndex) return item;
                                    return {
                                      ...item,
                                      options: item.options.map((opt, optIdx) =>
                                        optIdx === optionIndex ? { ...opt, description: event.target.value } : opt,
                                      ),
                                    };
                                  }),
                                }))
                              }
                              placeholder="Omschrijving"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() =>
                                updateActiveBuilderSpec((current) => ({
                                  ...current,
                                  optionSections: (current.optionSections || []).map((item, idx) => {
                                    if (idx !== sectionIndex) return item;
                                    return {
                                      ...item,
                                      options: item.options.filter((_, optIdx) => optIdx !== optionIndex),
                                    };
                                  }),
                                }))
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <div>
                        <Button type="button" size="sm" variant="outline" onClick={() => addBuilderOption(sectionIndex)}>
                          Optie toevoegen
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {configMode === "advanced" ? (
                <div className="rounded-xl border p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sliders (optioneel)</p>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={addBuilderSlider}>
                        Slider toevoegen
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {(activeBuilderSpec.sliders || []).map((slider, sliderIndex) => (
                      <div key={`${slider.key}-${sliderIndex}`} className="grid gap-2 rounded border bg-muted/30 p-2 md:grid-cols-[1fr_80px_80px_80px_90px_110px_90px_auto]">
                        <Input
                          value={slider.label}
                          onChange={(event) =>
                            updateActiveBuilderSpec((current) => ({
                              ...current,
                              sliders: (current.sliders || []).map((item, idx) =>
                                idx === sliderIndex ? { ...item, label: event.target.value, key: normalizeKey(event.target.value) || item.key } : item,
                              ),
                            }))
                          }
                          placeholder="Label"
                        />
                        <Input
                          type="number"
                          value={slider.min}
                          onChange={(event) =>
                            updateActiveBuilderSpec((current) => ({
                              ...current,
                              sliders: (current.sliders || []).map((item, idx) =>
                                idx === sliderIndex ? { ...item, min: Number(event.target.value) || 0 } : item,
                              ),
                            }))
                          }
                          placeholder="Min"
                        />
                        <Input
                          type="number"
                          value={slider.max}
                          onChange={(event) =>
                            updateActiveBuilderSpec((current) => ({
                              ...current,
                              sliders: (current.sliders || []).map((item, idx) =>
                                idx === sliderIndex ? { ...item, max: Number(event.target.value) || 0 } : item,
                              ),
                            }))
                          }
                          placeholder="Max"
                        />
                        <Input
                          type="number"
                          value={slider.step || 1}
                          onChange={(event) =>
                            updateActiveBuilderSpec((current) => ({
                              ...current,
                              sliders: (current.sliders || []).map((item, idx) =>
                                idx === sliderIndex ? { ...item, step: Number(event.target.value) || 1 } : item,
                              ),
                            }))
                          }
                          placeholder="Stap"
                        />
                        <Input
                          type="number"
                          value={slider.included || 0}
                          onChange={(event) =>
                            updateActiveBuilderSpec((current) => ({
                              ...current,
                              sliders: (current.sliders || []).map((item, idx) =>
                                idx === sliderIndex ? { ...item, included: Number(event.target.value) || 0 } : item,
                              ),
                            }))
                          }
                          placeholder="Incl."
                        />
                        <Input
                          type="number"
                          step="0.01"
                          value={slider.pricePerUnit || 0}
                          onChange={(event) =>
                            updateActiveBuilderSpec((current) => ({
                              ...current,
                              sliders: (current.sliders || []).map((item, idx) =>
                                idx === sliderIndex ? { ...item, pricePerUnit: Number(event.target.value) || 0 } : item,
                              ),
                            }))
                          }
                          placeholder="Prijs/eenheid"
                        />
                        <Input
                          value={slider.unitLabel || ""}
                          onChange={(event) =>
                            updateActiveBuilderSpec((current) => ({
                              ...current,
                              sliders: (current.sliders || []).map((item, idx) =>
                                idx === sliderIndex ? { ...item, unitLabel: event.target.value } : item,
                              ),
                            }))
                          }
                          placeholder="km"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() =>
                            updateActiveBuilderSpec((current) => ({
                              ...current,
                              sliders: (current.sliders || []).filter((_, idx) => idx !== sliderIndex),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <div className="md:col-span-8">
                          <Input
                            value={slider.hint || ""}
                            onChange={(event) =>
                              updateActiveBuilderSpec((current) => ({
                                ...current,
                                sliders: (current.sliders || []).map((item, idx) =>
                                  idx === sliderIndex ? { ...item, hint: event.target.value } : item,
                                ),
                              }))
                            }
                            placeholder="Hint voor gebruiker"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
      ) : null}

      {(!studioOnlyMode && (settingsTab === "catalog" || settingsTab === "all")) ? (
      <div className="grid gap-4 2xl:grid-cols-[0.82fr_1.18fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" />
              Snelle templates
            </CardTitle>
            <CardDescription>
              Vul de catalogus in één klik met een startset voor veelvoorkomende bedrijven.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.keys(SERVICE_TEMPLATES).map((templateKey) => (
              <button
                key={templateKey}
                type="button"
                onClick={() => setPendingTemplateKey(templateKey as keyof typeof SERVICE_TEMPLATES)}
                className="flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition hover:bg-muted/40"
                disabled={syncingCatalog}
              >
                <div>
                  <p className="font-medium">{templateKey}</p>
                  <p className="text-sm text-muted-foreground">
                    {SERVICE_TEMPLATES[templateKey]!.length} diensten voorgeladen
                  </p>
                </div>
                <span className="text-sm font-medium text-primary">Laden</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Producten & diensten</CardTitle>
                <CardDescription>
                  Beheer wat de klant kan selecteren in de embed. Gebruik sleep of pijltjes om de volgorde te bepalen, en voeg per categorie/product emoji toe.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={addService}>
                  <Plus className="mr-2 h-4 w-4" />
                  Dienst toevoegen
                </Button>
                <Button type="button" onClick={() => void saveCatalog()} disabled={syncingCatalog}>
                  <Save className="mr-2 h-4 w-4" />
                  {syncingCatalog ? "Opslaan..." : "Catalogus opslaan"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {services.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                Nog geen diensten in de catalogus. Voeg er zelf toe of laad een template.
              </div>
            ) : (
              services.map((service, index) => {
                const dragId = service.id || `${service.name}-${service.sortOrder}`;
                const builderKey = getBuilderProductKey(service);
                const isSelectedInBuilder = Boolean(activeBuilderKey && activeBuilderKey === builderKey);
                return (
                  <div
                    key={dragId}
                    draggable
                    onDragStart={() => setDraggedId(dragId)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggedId) reorderServices(draggedId, dragId);
                      setDraggedId(null);
                    }}
                    className="grid gap-3 rounded-2xl border bg-white p-4 xl:grid-cols-[82px_minmax(120px,0.75fr)_minmax(0,1.3fr)_110px_130px_80px_150px]"
                    style={{
                      borderColor: isSelectedInBuilder ? color : undefined,
                      boxShadow: isSelectedInBuilder ? `0 0 0 2px ${color}22 inset` : undefined,
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border bg-muted/40 px-1 text-xs font-semibold">
                        {index + 1}
                      </span>
                      <div className="flex flex-col">
                        <button
                          type="button"
                          className="rounded border px-1 py-0.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
                          disabled={index === 0}
                          onClick={() => {
                            if (index === 0) return;
                            setServices((current) => reorderArray(current, index, index - 1).map((item, sortIndex) => ({ ...item, sortOrder: sortIndex })));
                          }}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="mt-1 rounded border px-1 py-0.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
                          disabled={index === services.length - 1}
                          onClick={() => {
                            if (index === services.length - 1) return;
                            setServices((current) => reorderArray(current, index, index + 1).map((item, sortIndex) => ({ ...item, sortOrder: sortIndex })));
                          }}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-center text-muted-foreground" title="Sleep om te verplaatsen">
                        <GripVertical className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Input
                        value={service.category}
                        onChange={(event) => updateService(index, "category", event.target.value)}
                        placeholder="Categorie"
                      />
                      <QuoteIconPicker
                        value={categoryIconsMap[service.category] || ""}
                        iconLibrary={iconLibrary}
                        placeholder="Categorie-icoon"
                        onChange={(icon) => setCategoryIcon(service.category, icon)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
                        <Input
                          value={service.name}
                          onChange={(event) => updateService(index, "name", event.target.value)}
                          placeholder="Naam van de dienst"
                        />
                        <QuoteIconPicker
                          value={productIconsMap[getProductIconKey(service)] || ""}
                          iconLibrary={iconLibrary}
                          placeholder="Product-icoon"
                          onChange={(icon) => setProductIcon(service, icon)}
                        />
                      </div>
                      <Textarea
                        value={service.description}
                        onChange={(event) => updateService(index, "description", event.target.value)}
                        rows={2}
                        placeholder="Korte beschrijving"
                      />
                    </div>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={service.basePrice}
                      onChange={(event) => updateService(index, "basePrice", Number(event.target.value))}
                      placeholder="Prijs"
                    />
                    <Input
                      value={service.unit}
                      onChange={(event) => updateService(index, "unit", event.target.value)}
                      placeholder="per maand"
                    />
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={service.isActive}
                        onChange={(event) => updateService(index, "isActive", event.target.checked)}
                      />
                      Actief
                    </label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant={isSelectedInBuilder ? "default" : "outline"}
                        size="sm"
                        disabled={!service.name.trim()}
                        onClick={() => {
                          setActiveBuilderKey(builderKey);
                          if (typeof window !== "undefined") {
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }
                        }}
                      >
                        Bewerken
                      </Button>
                      <Button type="button" variant="ghost" className="text-destructive" onClick={() => void removeService(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
      ) : null}

      {(studioOnlyMode || settingsTab === "studio" || settingsTab === "all") ? (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Live Configurator Preview (Alleen In Instellingen)</CardTitle>
          <CardDescription>
            Werk in draft, bekijk live in de echte configurator en publiceer pas wanneer alles klopt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  {hasUnpublishedChanges ? "Draft wijzigingen klaar om te publiceren" : "Alles is gepubliceerd"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lastPublishedAt
                    ? `Laatste publicatie: ${new Date(lastPublishedAt).toLocaleString("nl-BE")}`
                    : "Nog geen publicatie geregistreerd in deze sessie."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={restorePublishedDraft} disabled={!publishedSnapshot || !hasUnpublishedChanges}>
                  Draft resetten
                </Button>
                <Button type="button" onClick={handlePublish} disabled={batchUpdate.isPending || !hasUnpublishedChanges}>
                  <Save className="mr-2 h-4 w-4" />
                  {batchUpdate.isPending ? "Publiceren..." : "Publiceren"}
                </Button>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Alle studio-acties staan rechtstreeks in de preview-iframe, met inspector en conditional logic voor vragen.
          </p>

          <div className="overflow-auto rounded-xl border bg-muted/20 p-2">
            <div
              className={`mx-auto overflow-hidden rounded-lg border bg-white shadow-sm ${
                previewViewport === "desktop"
                  ? "w-full min-w-[920px]"
                  : previewViewport === "tablet"
                    ? "w-[900px]"
                    : "w-[390px]"
              }`}
            >
              <iframe
                ref={previewIframeRef}
                src="/embed/quotes?preview=1"
                title="Live configurator preview"
                className="h-[920px] w-full"
                onLoad={() => setPreviewFrameReady((value) => value + 1)}
              />
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
            <div className="overflow-hidden rounded-xl border border-border/60 bg-card/80 shadow-sm">
              <div className="flex items-start gap-3 border-b border-border/60 bg-muted/25 px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground">
                  <MousePointer2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Element Inspector</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Bewerk het geselecteerde product rechtstreeks vanuit de live preview.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-b border-border/50 px-4 py-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium text-foreground">
                  <ListOrdered className="h-3 w-3 text-muted-foreground" />
                  Stap {previewSelection.currentStep}
                  <span className="text-muted-foreground">
                    ·{" "}
                    {[
                      stepServiceLabel,
                      stepProductLabel,
                      stepSpecsLabel,
                      stepDetailsLabel,
                    ][previewSelection.currentStep - 1] || "Configurator"}
                  </span>
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                    previewSelection.selectedCategory
                      ? "border-border/70 bg-background text-foreground"
                      : "border-dashed border-border/60 bg-muted/20 text-muted-foreground"
                  }`}
                >
                  <Layers className="h-3 w-3 shrink-0" />
                  {previewSelection.selectedCategory || "Geen categorie"}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                    selectedPreviewService
                      ? "border-border/70 bg-background text-foreground"
                      : "border-dashed border-border/60 bg-muted/20 text-muted-foreground"
                  }`}
                >
                  <Package className="h-3 w-3 shrink-0" />
                  {selectedPreviewService?.name || "Geen product"}
                </span>
              </div>

              <div className="p-4">
              {selectedPreviewService ? (
                <>
                  <div className="mb-4 flex items-center gap-3 rounded-xl border border-border/60 bg-muted/15 p-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-background text-xl">
                      <ConfiguratorIcon
                        value={productIconsMap[getProductIconKey(selectedPreviewService)] || "📦"}
                        label={selectedPreviewService.name}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{selectedPreviewService.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{selectedPreviewService.category}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      Actief
                    </span>
                  </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Productnaam</Label>
                    <Input
                      value={selectedPreviewService.name}
                      onChange={(event) =>
                        updateServiceByPreviewId(selectedPreviewService.id || getBuilderProductKey(selectedPreviewService), (service) => ({
                          ...service,
                          name: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Categorie</Label>
                    <Input
                      value={selectedPreviewService.category}
                      onChange={(event) =>
                        updateServiceByPreviewId(selectedPreviewService.id || getBuilderProductKey(selectedPreviewService), (service) => ({
                          ...service,
                          category: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Icoon</Label>
                    <QuoteIconPicker
                      value={productIconsMap[getProductIconKey(selectedPreviewService)] || ""}
                      iconLibrary={iconLibrary}
                      placeholder="Product-icoon"
                      onChange={(icon) => setProductIcon(selectedPreviewService, icon)}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Beschrijving</Label>
                    <Input
                      value={selectedPreviewService.description}
                      onChange={(event) =>
                        updateServiceByPreviewId(selectedPreviewService.id || getBuilderProductKey(selectedPreviewService), (service) => ({
                          ...service,
                          description: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Basisprijs</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={selectedPreviewService.basePrice}
                      onChange={(event) =>
                        updateServiceByPreviewId(selectedPreviewService.id || getBuilderProductKey(selectedPreviewService), (service) => ({
                          ...service,
                          basePrice: Number(event.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Eenheid</Label>
                    <Input
                      value={selectedPreviewService.unit}
                      onChange={(event) =>
                        updateServiceByPreviewId(selectedPreviewService.id || getBuilderProductKey(selectedPreviewService), (service) => ({
                          ...service,
                          unit: event.target.value,
                        }))
                      }
                    />
                  </div>
                  {selectedPreviewSpec ? (
                    <div className="sm:col-span-2 flex flex-wrap gap-2 rounded-lg border border-border/60 bg-muted/15 p-2.5">
                      <span className="rounded-md bg-background px-2 py-1 text-[11px] font-medium text-foreground">
                        {selectedPreviewSpec.packages?.length || 0} pakketten
                      </span>
                      <span className="rounded-md bg-background px-2 py-1 text-[11px] font-medium text-foreground">
                        {(selectedPreviewSpec.optionSections || []).reduce((sum, section) => sum + section.options.length, 0)} opties
                      </span>
                      <span className="rounded-md bg-background px-2 py-1 text-[11px] font-medium text-foreground">
                        {(selectedPreviewSpec.questions || []).length} vragen
                      </span>
                    </div>
                  ) : null}
                </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-background text-muted-foreground">
                    <MousePointer2 className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Nog niets geselecteerd</p>
                  <p className="mt-1 max-w-[280px] text-xs leading-relaxed text-muted-foreground">
                    Klik in de preview op een product (stap 2) om naam, icoon, prijs en specificaties hier te bewerken.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded-md border border-border/60 bg-background px-2 py-1">1 · Dienst</span>
                    <span className="rounded-md border border-primary/30 bg-primary/5 px-2 py-1 font-medium text-foreground">2 · Product</span>
                    <span className="rounded-md border border-border/60 bg-background px-2 py-1">3 · Specificaties</span>
                  </div>
                </div>
              )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Inline Validatie
                </p>
                {inlineStudioIssues.length === 0 ? (
                  <p className="text-xs text-emerald-700">Geen conflicten of fouten gevonden.</p>
                ) : (
                  <div className="max-h-40 space-y-1 overflow-auto text-xs">
                    {inlineStudioIssues.map((issue, index) => (
                      <p key={`${issue.message}-${index}`} className={issue.severity === "error" ? "text-red-600" : "text-amber-700"}>
                        {issue.severity === "error" ? "Error" : "Warning"}: {issue.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Geschiedenis Timeline
                </p>
                {historyPast.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nog geen wijzigingen in deze sessie.</p>
                ) : (
                  <div className="max-h-44 space-y-1 overflow-auto">
                    {historyPast
                      .slice(-12)
                      .map((entry, idx, arr) => {
                        const indexFromLatest = arr.length - 1 - idx;
                        return (
                          <button
                            key={`${entry.timestamp}-${idx}`}
                            type="button"
                            onClick={() => restoreHistorySnapshot(indexFromLatest)}
                            className="flex w-full items-center justify-between rounded border px-2 py-1 text-left text-xs hover:bg-muted/40"
                          >
                            <span>Snapshot {historyPast.length - indexFromLatest}</span>
                            <span className="text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString("nl-BE")}</span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Configurator instellingen
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pas de publieke configurator per onderdeel aan. Publiceer bovenaan wanneer alles klopt.
              </p>
            </div>
            <Tabs value={configInfoTab} onValueChange={(value) => setConfigInfoTab(value as ConfiguratorInfoTab)} className="space-y-4">
              <TabsList className="settings-domain-tabs settings-domain-tabs-cols-6">
                <TabsTrigger value="general" className="settings-domain-tab">
                  <Info className="settings-domain-tab-icon" />
                  Info
                </TabsTrigger>
                <TabsTrigger value="branding" className="settings-domain-tab">
                  <Sparkles className="settings-domain-tab-icon" />
                  Branding
                </TabsTrigger>
                <TabsTrigger value="colors" className="settings-domain-tab">
                  <Palette className="settings-domain-tab-icon" />
                  Kleuren
                </TabsTrigger>
                <TabsTrigger value="steps" className="settings-domain-tab">
                  <ListOrdered className="settings-domain-tab-icon" />
                  Stappen
                </TabsTrigger>
                <TabsTrigger value="icons" className="settings-domain-tab">
                  <Smile className="settings-domain-tab-icon" />
                  Iconen
                </TabsTrigger>
                <TabsTrigger value="pdf" className="settings-domain-tab">
                  <FileText className="settings-domain-tab-icon" />
                  PDF
                </TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="mt-3">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Titel</Label>
                    <Input value={title} onChange={(event) => setTitle(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Badge</Label>
                    <Input value={badge} onChange={(event) => setBadge(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">CTA</Label>
                    <Input value={ctaLabel} onChange={(event) => setCtaLabel(event.target.value)} />
                  </div>
                  <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                    <Label className="text-xs">Beschrijving</Label>
                    <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
                  </div>
                  <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                    <Label className="text-xs">Disclaimer / interne melding</Label>
                    <Textarea value={disclaimer} onChange={(event) => setDisclaimer(event.target.value)} rows={2} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="branding" className="mt-3">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Bedrijfsnaam</Label>
                      <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tagline</Label>
                      <Input value={companyTagline} onChange={(event) => setCompanyTagline(event.target.value)} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Logo URL of upload</Label>
                      <Input value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} placeholder="https://... of upload hieronder" />
                    </div>
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon,image/vnd.microsoft.icon"
                        className="hidden"
                        onChange={(event) => void handleConfiguratorLogoUpload(event)}
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>
                        {logoUploading ? "Uploaden..." : "Logo uploaden"}
                      </Button>
                      {logoUrl ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setLogoUrl("")}>
                          Logo verwijderen
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
                    {logoUrl ? (
                      <img src={logoUrl} alt="Configurator logo preview" className="max-h-20 max-w-full rounded-lg object-contain" />
                    ) : (
                      <div className="flex h-20 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                        Nog geen logo
                      </div>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Uploads worden als compacte afbeelding opgeslagen en mee gepubliceerd in de configurator.
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="colors" className="mt-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Accent</Label>
                    <input
                      type="color"
                      value={isHexColor(color) ? color : "#E6A94A"}
                      onChange={(event) => updateColorValue(event.target.value, "accent")}
                      className="h-10 w-full rounded border"
                    />
                    <Input value={color} onChange={(event) => updateColorValue(event.target.value, "accent")} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Donker</Label>
                    <input
                      type="color"
                      value={isHexColor(darkColor) ? darkColor : "#14171D"}
                      onChange={(event) => updateColorValue(event.target.value, "dark")}
                      className="h-10 w-full rounded border"
                    />
                    <Input value={darkColor} onChange={(event) => updateColorValue(event.target.value, "dark")} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Achtergrond</Label>
                    <input
                      type="color"
                      value={isHexColor(bgColor) ? bgColor : "#F3F2EC"}
                      onChange={(event) => updateColorValue(event.target.value, "bg")}
                      className="h-10 w-full rounded border"
                    />
                    <Input value={bgColor} onChange={(event) => updateColorValue(event.target.value, "bg")} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="steps" className="mt-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Stap 1 label</Label>
                    <Input value={stepServiceLabel} onChange={(event) => setStepServiceLabel(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Stap 2 label</Label>
                    <Input value={stepProductLabel} onChange={(event) => setStepProductLabel(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Stap 3 label</Label>
                    <Input value={stepSpecsLabel} onChange={(event) => setStepSpecsLabel(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Stap 4 label</Label>
                    <Input value={stepDetailsLabel} onChange={(event) => setStepDetailsLabel(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Stap 1 uitleg</Label>
                    <Textarea value={stepServiceHint} onChange={(event) => setStepServiceHint(event.target.value)} rows={2} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Stap 2 uitleg</Label>
                    <Textarea value={stepProductHint} onChange={(event) => setStepProductHint(event.target.value)} rows={2} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Stap 3 uitleg</Label>
                    <Textarea value={stepSpecsHint} onChange={(event) => setStepSpecsHint(event.target.value)} rows={2} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Stap 4 uitleg</Label>
                    <Textarea value={stepDetailsHint} onChange={(event) => setStepDetailsHint(event.target.value)} rows={2} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="icons" className="mt-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Dienst titel</Label>
                    <Input value={serviceTitle} onChange={(event) => setServiceTitle(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Product titel</Label>
                    <Input value={productTitle} onChange={(event) => setProductTitle(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Specificaties titel</Label>
                    <Input value={specsTitle} onChange={(event) => setSpecsTitle(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Gegevens titel</Label>
                    <Input value={detailsTitle} onChange={(event) => setDetailsTitle(event.target.value)} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <QuoteIconLibraryPanel
                      iconLibrary={iconLibrary}
                      onChange={updateIconLibrary}
                      onUploadFile={uploadIconLibraryFile}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <p className="text-xs text-muted-foreground">
                      Wijs iconen toe per categorie en product in de live preview of bij Producten & diensten. Publiceer om wijzigingen op de embed te tonen.
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="pdf" className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">
                    Branding, content en opmaak voor gegenereerde offerte-PDF&apos;s.
                  </p>
                  <Button type="button" size="sm" variant="outline" onClick={() => void savePdfSettingsOnly()} disabled={batchUpdate.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {batchUpdate.isPending ? "Opslaan..." : "PDF instellingen opslaan"}
                  </Button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">PDF bedrijfsnaam</Label>
                    <Input value={pdfBrandName} onChange={(event) => setPdfBrandName(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">PDF tagline</Label>
                    <Input value={pdfBrandTagline} onChange={(event) => setPdfBrandTagline(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Logo URL</Label>
                    <Input value={pdfLogoUrl} onChange={(event) => setPdfLogoUrl(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Header kleur</Label>
                    <input
                      type="color"
                      value={isHexColor(pdfHeaderBgColor) ? pdfHeaderBgColor : "#0A0D12"}
                      onChange={(event) => setPdfHeaderBgColor(event.target.value)}
                      className="h-10 w-full rounded border"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Accent kleur</Label>
                    <input
                      type="color"
                      value={isHexColor(pdfAccentColor) ? pdfAccentColor : "#F6AD49"}
                      onChange={(event) => setPdfAccentColor(event.target.value)}
                      className="h-10 w-full rounded border"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Pagina achtergrond</Label>
                    <input
                      type="color"
                      value={isHexColor(pdfPageBgColor) ? pdfPageBgColor : "#ECECEE"}
                      onChange={(event) => setPdfPageBgColor(event.target.value)}
                      className="h-10 w-full rounded border"
                    />
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Intro titel</Label>
                    <Input value={pdfIntroTitle} onChange={(event) => setPdfIntroTitle(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Over ons titel</Label>
                    <Input value={pdfAboutTitle} onChange={(event) => setPdfAboutTitle(event.target.value)} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Intro tekst</Label>
                    <Textarea value={pdfIntroText} onChange={(event) => setPdfIntroText(event.target.value)} rows={3} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Over ons tekst</Label>
                    <Textarea value={pdfAboutText} onChange={(event) => setPdfAboutText(event.target.value)} rows={3} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Footer tekst (optioneel)</Label>
                    <Input value={pdfFooterText} onChange={(event) => setPdfFooterText(event.target.value)} placeholder="contact@bedrijf.be • +32 ... • www.bedrijf.be • BTW: ..." />
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Diensten & aanpak titel</Label>
                    <Input value={pdfServicesTitle} onChange={(event) => setPdfServicesTitle(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Proces titel</Label>
                    <Input value={pdfProcessTitle} onChange={(event) => setPdfProcessTitle(event.target.value)} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Service kaarten JSON</Label>
                    <Textarea value={pdfServicesCardsJson} onChange={(event) => setPdfServicesCardsJson(event.target.value)} rows={8} className="font-mono text-xs" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Proces stappen JSON</Label>
                    <Textarea value={pdfProcessStepsJson} onChange={(event) => setPdfProcessStepsJson(event.target.value)} rows={6} className="font-mono text-xs" />
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Tips titel</Label>
                    <Input value={pdfTipsTitle} onChange={(event) => setPdfTipsTitle(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Volgende stappen titel</Label>
                    <Input value={pdfNextStepsTitle} onChange={(event) => setPdfNextStepsTitle(event.target.value)} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Tips JSON</Label>
                    <Textarea value={pdfTipsJson} onChange={(event) => setPdfTipsJson(event.target.value)} rows={8} className="font-mono text-xs" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Volgende stappen JSON (array van strings)</Label>
                    <Textarea value={pdfNextStepsJson} onChange={(event) => setPdfNextStepsJson(event.target.value)} rows={5} className="font-mono text-xs" />
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Handtekening klant titel</Label>
                    <Input value={pdfSignatureClientTitle} onChange={(event) => setPdfSignatureClientTitle(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Handtekening bedrijf titel</Label>
                    <Input value={pdfSignatureCompanyTitle} onChange={(event) => setPdfSignatureCompanyTitle(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Bedrijf ondertekenaar</Label>
                    <Input value={pdfSignatureCompanySigner} onChange={(event) => setPdfSignatureCompanySigner(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Functie ondertekenaar</Label>
                    <Input value={pdfSignatureCompanyRole} onChange={(event) => setPdfSignatureCompanyRole(event.target.value)} />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Placeholders ondersteund in tekstvelden: <span className="font-mono">{`{{clientName}}`}</span>, <span className="font-mono">{`{{clientCompany}}`}</span>, <span className="font-mono">{`{{quoteNumber}}`}</span>, <span className="font-mono">{`{{validUntil}}`}</span>, <span className="font-mono">{`{{brandName}}`}</span>, <span className="font-mono">{`{{total}}`}</span>.
                </p>
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>
      ) : null}

    </div>
  );
}
