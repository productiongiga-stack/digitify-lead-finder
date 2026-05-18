import { normalizeKey } from "@/lib/quote-configurator-utils";

export type QuoteConfiguratorService = {
  id: string;
  category: string;
  name: string;
  description?: string | null;
  basePrice: number;
  unit?: string | null;
};

export type PackageOption = {
  key: string;
  label: string;
  subtitle: string;
  price: number;
  features: string[];
  defaultSelected?: boolean;
};

export type SpecOption = {
  key: string;
  label: string;
  price: number;
  unit?: string;
  description?: string;
  quantity?: number;
  defaultSelected?: boolean;
};

export type SpecOptionSection = {
  title: string;
  options: SpecOption[];
};

export type SpecSlider = {
  key: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  included?: number;
  pricePerUnit?: number;
  unitLabel?: string;
  hint?: string;
  defaultValue?: number;
};

export type SpecQuestionType = "text" | "select" | "checkbox";

export type SpecQuestion = {
  key: string;
  label: string;
  type: SpecQuestionType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  showWhenPackageKey?: string;
  showWhenOptionKey?: string;
};

export type ProductSpecConfig = {
  headline?: string;
  subheadline?: string;
  packageSectionTitle?: string;
  packages?: PackageOption[];
  optionSections?: SpecOptionSection[];
  sliders?: SpecSlider[];
  questionsCard?: {
    title?: string;
    subtitle?: string;
  };
  questions?: SpecQuestion[];
  notesPlaceholder?: string;
};

export type SpecsByProduct = Record<string, ProductSpecConfig>;

function buildPackageOptions(service: QuoteConfiguratorService): PackageOption[] {
  const base = Math.max(1, service.basePrice);
  const description = (service.description || "").trim();

  return [
    {
      key: "basic",
      label: "Basis",
      subtitle: description || `${service.name} startpakket`,
      price: Math.round(base),
      features: ["Kick-off en intake", "Basis oplevering", "Standaard support"],
      defaultSelected: true,
    },
    {
      key: "pro",
      label: "Pro",
      subtitle: description || `${service.name} groeipakket`,
      price: Math.round(base * 1.6),
      features: ["Alles van Basis", "Uitgebreidere scope", "Snellere oplevering"],
    },
    {
      key: "premium",
      label: "Premium",
      subtitle: description || `${service.name} full-service`,
      price: Math.round(base * 2.2),
      features: ["Alles van Pro", "Volledig maatwerk", "Prioritaire support"],
    },
  ];
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeSpecConfig(raw: unknown): ProductSpecConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;

  const packages = Array.isArray(source.packages)
    ? source.packages
        .map((pkg): PackageOption | null => {
          if (!pkg || typeof pkg !== "object") return null;
          const item = pkg as Record<string, unknown>;
          const label = asString(item.label).trim();
          const price = asNumber(item.price, NaN);
          if (!label || !Number.isFinite(price)) return null;
          return {
            key: asString(item.key, normalizeKey(label) || "package"),
            label,
            subtitle: asString(item.subtitle),
            price,
            features: Array.isArray(item.features)
              ? item.features.map((feature) => asString(feature)).filter(Boolean)
              : [],
            defaultSelected: asBoolean(item.defaultSelected, false),
          };
        })
        .filter(Boolean) as PackageOption[]
    : [];

  const optionSections = Array.isArray(source.optionSections)
    ? source.optionSections
        .map((section): SpecOptionSection | null => {
          if (!section || typeof section !== "object") return null;
          const sec = section as Record<string, unknown>;
          const title = asString(sec.title).trim();
          if (!title) return null;
          const options = Array.isArray(sec.options)
            ? sec.options
                .map((opt): SpecOption | null => {
                  if (!opt || typeof opt !== "object") return null;
                  const item = opt as Record<string, unknown>;
                  const label = asString(item.label).trim();
                  const price = asNumber(item.price, NaN);
                  if (!label || !Number.isFinite(price)) return null;
                  return {
                    key: asString(item.key, normalizeKey(label) || "option"),
                    label,
                    price,
                    unit: asString(item.unit),
                    description: asString(item.description),
                    quantity: Math.max(1, asNumber(item.quantity, 1)),
                    defaultSelected: asBoolean(item.defaultSelected, false),
                  };
                })
                .filter(Boolean) as SpecOption[]
            : [];
          return { title, options };
        })
        .filter(Boolean) as SpecOptionSection[]
    : [];

  const sliders = Array.isArray(source.sliders)
    ? source.sliders
        .map((slider): SpecSlider | null => {
          if (!slider || typeof slider !== "object") return null;
          const item = slider as Record<string, unknown>;
          const label = asString(item.label).trim();
          if (!label) return null;
          const min = 1;
          const max = 1000;
          if (max <= min) return null;
          return {
            key: asString(item.key, normalizeKey(label) || "slider"),
            label,
            min,
            max,
            step: Math.max(1, asNumber(item.step, 1)),
            included: Math.max(0, asNumber(item.included, 0)),
            pricePerUnit: Math.max(0, asNumber(item.pricePerUnit, 0)),
            unitLabel: asString(item.unitLabel, "km"),
            hint: asString(item.hint),
            defaultValue: Math.min(max, Math.max(min, asNumber(item.defaultValue, min))),
          };
        })
        .filter(Boolean) as SpecSlider[]
    : [];

  const questions = Array.isArray(source.questions)
    ? source.questions
        .map((question): SpecQuestion | null => {
          if (!question || typeof question !== "object") return null;
          const item = question as Record<string, unknown>;
          const label = asString(item.label).trim();
          if (!label) return null;
          const type = asString(item.type, "text");
          const resolvedType: SpecQuestionType =
            type === "select" || type === "checkbox" || type === "text" ? type : "text";
          const options =
            resolvedType === "select" && Array.isArray(item.options)
              ? item.options
                  .map((value) => asString(value).trim())
                  .filter((value) => value.length > 0)
              : [];
          return {
            key: asString(item.key, normalizeKey(label) || "vraag"),
            label,
            type: resolvedType,
            required: asBoolean(item.required, false),
            placeholder: asString(item.placeholder),
            helpText: asString(item.helpText),
            showWhenPackageKey: asString(item.showWhenPackageKey),
            showWhenOptionKey: asString(item.showWhenOptionKey),
            options,
          };
        })
        .filter(Boolean) as SpecQuestion[]
    : [];

  return {
    headline: asString(source.headline),
    subheadline: asString(source.subheadline),
    packageSectionTitle: asString(source.packageSectionTitle),
    packages,
    optionSections,
    sliders,
    questionsCard:
      source.questionsCard && typeof source.questionsCard === "object"
        ? {
            title: asString((source.questionsCard as Record<string, unknown>).title),
            subtitle: asString((source.questionsCard as Record<string, unknown>).subtitle),
          }
        : undefined,
    questions,
    notesPlaceholder: asString(source.notesPlaceholder),
  };
}

export function parseProductSpecs(json: string): SpecsByProduct {
  if (!json?.trim()) return {};
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") return {};

    const root = parsed as Record<string, unknown>;
    const rawProducts =
      root.products && typeof root.products === "object" && !Array.isArray(root.products)
        ? (root.products as Record<string, unknown>)
        : root;

    const entries = Object.entries(rawProducts)
      .map(([key, value]) => {
        const config = sanitizeSpecConfig(value);
        if (!config) return null;
        return [key, config] as const;
      })
      .filter(Boolean) as Array<readonly [string, ProductSpecConfig]>;

    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

export function resolveProductSpecs(
  service: QuoteConfiguratorService | null,
  map: SpecsByProduct,
): ProductSpecConfig | null {
  if (!service) return null;

  const candidates = [
    service.id,
    normalizeKey(`${service.category}-${service.name}`),
    service.name,
    normalizeKey(service.name),
    `${service.category}:${service.name}`,
    normalizeKey(`${service.category}:${service.name}`),
  ];

  for (const candidate of candidates) {
    if (map[candidate]) return map[candidate] || null;
  }

  return null;
}

export function buildFallbackSpecs(
  service: QuoteConfiguratorService,
  siblingExtras: QuoteConfiguratorService[],
): ProductSpecConfig {
  const needsTravel = (() => {
    const value = `${service.category} ${service.name}`.toLowerCase();
    return ["media", "video", "film", "event", "foto", "shoot", "drone"].some((token) =>
      value.includes(token),
    );
  })();

  return {
    packageSectionTitle: "PAKKET",
    packages: buildPackageOptions(service),
    optionSections: siblingExtras.length
      ? [
          {
            title: "EXTRA OPTIES",
            options: siblingExtras.map((extra) => ({
              key: normalizeKey(extra.name) || extra.id,
              label: extra.name,
              price: extra.basePrice,
              description: extra.description || "",
              unit: extra.unit || "",
            })),
          },
        ]
      : [],
    sliders: needsTravel
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
            hint: "0km inbegrepen, daarna €0,35/km",
            defaultValue: 1,
          },
        ]
      : [],
    questionsCard: {
      title: "Vragen voor een nauwkeurige offerte",
      subtitle: "Beantwoord uw voorkeuren voor een betere prijsopgave.",
    },
    questions: [
      {
        key: "planning",
        label: "Wanneer wilt u starten?",
        type: "select",
        options: ["Zo snel mogelijk", "Binnen 2 weken", "Binnen 1 maand", "Nog te bepalen"],
        required: true,
      },
      {
        key: "budget",
        label: "Heeft u al een budgetindicatie?",
        type: "checkbox",
        helpText: "Ja, ik heb al een budget in gedachten.",
      },
      {
        key: "focus",
        label: "Wat is uw belangrijkste doel?",
        type: "text",
        placeholder: "Meer leads, betere branding, sneller resultaat...",
      },
    ],
    notesPlaceholder: "Extra info, specifieke wensen of vragen...",
  };
}
