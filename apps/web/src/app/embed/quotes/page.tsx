"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatCurrency,
  isImageIcon,
  isValidEmail,
  normalizeKey,
  parseEmojiMap,
  sanitizeNumber,
} from "@/lib/quote-configurator-utils";
import {
  buildFallbackSpecs,
  parseProductSpecs,
  resolveProductSpecs,
  type PackageOption,
  type QuoteConfiguratorService as Service,
  type SpecOption,
  type SpecOptionSection,
  type SpecQuestion,
  type SpecSlider,
} from "@/lib/quote-configurator-specs";

type RemotePayload = {
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
    serviceTitle: string;
    productTitle: string;
    specsTitle: string;
    detailsTitle: string;
    productSpecsJson: string;
  };
  prefill?: {
    leadId?: string | null;
    chatSessionId?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    company?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    vatNumber?: string | null;
  };
  editingQuote?: {
    id: string;
    quoteNumber: string;
    clientName: string;
    clientEmail?: string | null;
    clientCompany?: string | null;
    clientPhone?: string | null;
    clientAddress?: string | null;
    clientVat?: string | null;
    notes?: string | null;
    vatRate: number;
    discount: number;
    items: {
      id: string;
      category?: string | null;
      name: string;
      description?: string | null;
      quantity: number;
      unitPrice: number;
    }[];
  };
  studio?: {
    viewport?: "desktop" | "tablet" | "mobile";
    syncBuilderWithPreview?: boolean;
    canUndo?: boolean;
    canRedo?: boolean;
    autosaveState?: "idle" | "saving" | "saved" | "error";
    publishState?: "draft" | "published";
    hasUnpublishedChanges?: boolean;
    lastPublishedAt?: string | null;
  };
  services: Service[];
};

type QuoteConfiguratorMode = "public" | "internal";

type CartEntry = {
  serviceId: string;
  source: "product" | "option" | "slider";
  quantity: number;
  unitPrice: number;
  packageKey: string;
  packageLabel: string;
  customName?: string;
  customCategory?: string;
  customDescription?: string;
};

function isPreviewPayload(value: unknown): value is RemotePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  const settings = payload.settings;
  const services = payload.services;
  if (!settings || typeof settings !== "object") return false;
  if (!Array.isArray(services)) return false;
  return services.every((service) => {
    if (!service || typeof service !== "object") return false;
    const item = service as Record<string, unknown>;
    return (
      typeof item.id === "string" &&
      typeof item.category === "string" &&
      typeof item.name === "string" &&
      typeof item.basePrice === "number"
    );
  });
}

const EMOJI_DROPDOWN_OPTIONS = [
  "💻",
  "🛍️",
  "🎬",
  "🎥",
  "📸",
  "📣",
  "🔎",
  "🌐",
  "⚙️",
  "🧩",
  "🧠",
  "🎨",
  "🖨️",
  "📈",
  "💡",
  "📦",
  "📱",
  "🔧",
  "🚀",
];

function getCategoryIcon(category: string, categoryIcons: Record<string, string>) {
  const custom = categoryIcons[category] || categoryIcons[normalizeKey(category)];
  if (custom) return custom;
  const value = category.toLowerCase();
  if (value.includes("web")) return "💻";
  if (value.includes("media") || value.includes("video")) return "🎬";
  if (value.includes("marketing") || value.includes("ads")) return "📣";
  if (value.includes("extra") || value.includes("add")) return "⚙️";
  return "📦";
}

function getServiceIcon(service: Service, productIcons: Record<string, string>) {
  const candidates = [
    service.id,
    `${service.category}:${service.name}`,
    normalizeKey(`${service.category}:${service.name}`),
    service.name,
    normalizeKey(service.name),
  ];
  for (const key of candidates) {
    const custom = productIcons[key];
    if (custom) return custom;
  }
  const value = `${service.name} ${service.category}`.toLowerCase();
  if (value.includes("google") || value.includes("seo")) return "🔎";
  if (value.includes("meta") || value.includes("social")) return "📱";
  if (value.includes("hosting") || value.includes("domein")) return "🌐";
  if (value.includes("logo") || value.includes("brand")) return "🎨";
  if (value.includes("shop")) return "🛍️";
  if (value.includes("video") || value.includes("film")) return "🎥";
  if (value.includes("print") || value.includes("druk")) return "🖨️";
  return "🧩";
}

function renderConfiguratorIcon(value: string, label: string) {
  if (isImageIcon(value)) {
    return <img src={value} alt={label} className="h-full w-full rounded-lg object-cover" />;
  }
  return <span aria-hidden="true">{value}</span>;
}

function QuoteEmbedFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f2ec] p-6 text-[#1f2228]">
      <div className="w-full max-w-md rounded-[28px] border border-black/10 bg-white p-6 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-2xl bg-[#f5b04c]/30" />
        <p className="text-sm font-semibold">Configurator laden...</p>
        <p className="mt-1 text-xs text-[#7b818c]">We zetten de offerteflow klaar.</p>
      </div>
    </div>
  );
}

function optionCartKey(productId: string, optionKey: string) {
  return `opt:${productId}:${optionKey}`;
}

function sliderCartKey(productId: string, sliderKey: string) {
  return `sld:${productId}:${sliderKey}`;
}

function questionAnswerKey(productId: string, questionKey: string) {
  return `q:${productId}:${questionKey}`;
}

function normalizeComparable(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function buildEditingQuoteState(
  editingQuote: NonNullable<RemotePayload["editingQuote"]>,
  services: Service[],
  settings: RemotePayload["settings"],
) {
  const specsMap = parseProductSpecs(settings.productSpecsJson || "{}");
  const cartEntries: Record<string, CartEntry> = {};
  const confirmedEntries: Record<string, boolean> = {};
  const initializedEntries: Record<string, boolean> = {};
  let firstMatchedProductId = "";
  let firstMatchedCategory = "";

  editingQuote.items.forEach((item, index) => {
    const itemCategory = normalizeComparable(item.category);
    const itemName = normalizeComparable(item.name);
    const matchingService = services
      .filter((service) => !itemCategory || normalizeComparable(service.category) === itemCategory)
      .sort((left, right) => right.name.length - left.name.length)
      .find((service) => {
        const serviceName = normalizeComparable(service.name);
        return itemName === serviceName || itemName.startsWith(`${serviceName} -`);
      });

    if (matchingService) {
      const siblingExtras = services.filter(
        (service) => service.category === matchingService.category && service.id !== matchingService.id,
      );
      const specs = resolveProductSpecs(matchingService, specsMap) || buildFallbackSpecs(matchingService, siblingExtras);
      const rawPackageLabel = item.name
        .slice(matchingService.name.length)
        .replace(/^\s*[-:]\s*/, "")
        .trim();
      const packageMatch = (specs.packages || []).find((option) => {
        const labelMatches = rawPackageLabel && normalizeComparable(option.label) === normalizeComparable(rawPackageLabel);
        const priceMatches = Math.abs((option.price || 0) - item.unitPrice) < 0.01;
        return labelMatches || priceMatches;
      });

      cartEntries[matchingService.id] = {
        serviceId: matchingService.id,
        source: "product",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        packageKey: packageMatch?.key || "custom",
        packageLabel: packageMatch?.label || rawPackageLabel || "Aangepast",
        customName: matchingService.name,
        customCategory: matchingService.category,
        customDescription: item.description || matchingService.description || "",
      };
      confirmedEntries[matchingService.id] = true;
      initializedEntries[matchingService.id] = true;
      firstMatchedProductId ||= matchingService.id;
      firstMatchedCategory ||= matchingService.category;
      return;
    }

    const key = `quote:${item.id || index}`;
    cartEntries[key] = {
      serviceId: key,
      source: "option",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      packageKey: "custom",
      packageLabel: "Bestaande offerte",
      customName: item.name,
      customCategory: item.category || "Offerte",
      customDescription: item.description || "",
    };
    confirmedEntries[key] = true;
    initializedEntries[key] = true;
  });

  return {
    cartEntries,
    confirmedEntries,
    initializedEntries,
    firstMatchedProductId,
    firstMatchedCategory,
  };
}

function readQuoteConfiguratorUrlState() {
  if (typeof window === "undefined") {
    return {
      ready: false,
      preview: false,
      internal: false,
      pathname: "",
      tenantToken: "",
      leadId: "",
      chatSessionId: "",
      quoteId: "",
    };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    ready: true,
    preview: params.get("preview") === "1",
    internal: params.get("internal") === "1" || window.location.pathname.startsWith("/quotes/new"),
    pathname: window.location.pathname,
    tenantToken: params.get("tenant")?.trim() || "",
    leadId: params.get("leadId")?.trim() || "",
    chatSessionId: params.get("chatSessionId")?.trim() || "",
    quoteId: params.get("quoteId")?.trim() || "",
  };
}

function QuoteConfigurator({ mode = "public" }: { mode?: QuoteConfiguratorMode }) {
  const [urlState, setUrlState] = useState(readQuoteConfiguratorUrlState);
  const isPreviewRoute = urlState.preview;
  const isInternalMode = mode === "internal" || urlState.internal;
  const tenantToken = urlState.tenantToken;
  const leadIdParam = urlState.leadId;
  const chatSessionIdParam = urlState.chatSessionId;
  const quoteIdParam = urlState.quoteId;
  const [payload, setPayload] = useState<RemotePayload | null>(null);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [isLivePreview, setIsLivePreview] = useState(false);

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [cart, setCart] = useState<Record<string, CartEntry>>({});
  const [sliderValues, setSliderValues] = useState<Record<string, number>>({});
  const [initializedProducts, setInitializedProducts] = useState<Record<string, boolean>>({});
  const [confirmedProducts, setConfirmedProducts] = useState<Record<string, boolean>>({});

  const [discountMode, setDiscountMode] = useState<"amount" | "percent">("amount");
  const [discountInput, setDiscountInput] = useState("0");
  const [vatRate, setVatRate] = useState(21);
  const [specNotes, setSpecNotes] = useState("");
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string | boolean>>({});

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("0");
  const [newCategoryEmoji, setNewCategoryEmoji] = useState("");
  const [newProductEmoji, setNewProductEmoji] = useState("");

  useEffect(() => {
    setUrlState(readQuoteConfiguratorUrlState());
  }, []);

  useEffect(() => {
    setConfirmedProducts((current) => {
      const next: Record<string, boolean> = {};
      Object.keys(current).forEach((productId) => {
        if (cart[productId] && current[productId]) next[productId] = true;
      });
      return next;
    });
  }, [cart]);

  useEffect(() => {
    if (!urlState.ready) return;
    if (isPreviewRoute) return;
    let active = true;
    const internalParams = new URLSearchParams();
    if (leadIdParam) internalParams.set("leadId", leadIdParam);
    if (chatSessionIdParam) internalParams.set("chatSessionId", chatSessionIdParam);
    if (quoteIdParam) internalParams.set("quoteId", quoteIdParam);
    const servicesUrl = isInternalMode
      ? `/api/quotes/configurator/services${internalParams.toString() ? `?${internalParams.toString()}` : ""}`
      : tenantToken
        ? `/api/public/quotes/services?tenant=${encodeURIComponent(tenantToken)}`
        : "/api/public/quotes/services";
    fetch(servicesUrl)
      .then((response) => {
        if (!response.ok) throw new Error("Configuratie ophalen mislukt.");
        return response.json();
      })
      .then((data: RemotePayload) => {
        if (!active) return;
        setPayload(data);
        const firstCategory = data.services[0]?.category || "";
        setSelectedCategory(firstCategory);
        if (data.prefill) {
          setFirstName(data.prefill.firstName || "");
          setLastName(data.prefill.lastName || "");
          setCompany(data.prefill.company || "");
          setEmail(data.prefill.email || "");
          setPhone(data.prefill.phone || "");
          setAddress(data.prefill.address || "");
          setVatNumber(data.prefill.vatNumber || "");
        }
        if (data.editingQuote) {
          const editingState = buildEditingQuoteState(data.editingQuote, data.services, data.settings);
          const nameParts = (data.editingQuote.clientName || "").trim().split(/\s+/).filter(Boolean);
          setFirstName(nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : nameParts[0] || "");
          setLastName(nameParts.length > 1 ? nameParts.at(-1) || "" : "");
          setCompany(data.editingQuote.clientCompany || "");
          setEmail(data.editingQuote.clientEmail || "");
          setPhone(data.editingQuote.clientPhone || "");
          setAddress(data.editingQuote.clientAddress || "");
          setVatNumber(data.editingQuote.clientVat || "");
          setRemarks(data.editingQuote.notes || "");
          setVatRate(data.editingQuote.vatRate || 21);
          setDiscountMode("amount");
          setDiscountInput(String(data.editingQuote.discount || 0));
          setCart(editingState.cartEntries);
          setConfirmedProducts(editingState.confirmedEntries);
          setInitializedProducts(editingState.initializedEntries);
          if (editingState.firstMatchedCategory) setSelectedCategory(editingState.firstMatchedCategory);
          if (editingState.firstMatchedProductId) setSelectedProductId(editingState.firstMatchedProductId);
          setCurrentStep(editingState.firstMatchedProductId ? 3 : 4);
        }
      })
      .catch(() => {
        if (!active) return;
        setRemoteError("Configurator laden mislukt.");
      });

    return () => {
      active = false;
    };
  }, [chatSessionIdParam, isInternalMode, isPreviewRoute, leadIdParam, quoteIdParam, tenantToken, urlState.ready]);

  useEffect(() => {
    if (!isPreviewRoute) return;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const raw = event.data as { type?: string; payload?: unknown } | null;
      if (!raw || raw.type !== "digitify-quote-preview") return;
      if (!isPreviewPayload(raw.payload)) return;

      const nextPayload = raw.payload;
      setPayload(nextPayload);
      setIsLivePreview(true);
      setRemoteError(null);
      setSelectedCategory((current) => {
        if (current && nextPayload.services.some((item) => item.category === current)) return current;
        return nextPayload.services[0]?.category || "";
      });
      setSelectedProductId((current) => {
        if (current && nextPayload.services.some((item) => item.id === current)) return current;
        return "";
      });
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isPreviewRoute]);

  useEffect(() => {
    if (!isPreviewRoute || !payload) return;
    window.parent?.postMessage(
      {
        type: "digitify-quote-preview-state",
        payload: {
          currentStep,
          selectedCategory,
          selectedProductId,
        },
      },
      window.location.origin,
    );
  }, [isPreviewRoute, payload, currentStep, selectedCategory, selectedProductId]);

  const settings = payload?.settings ?? {
    title: "Stel uw pakket samen",
    description: "Kies de diensten die voor uw bedrijf relevant zijn en vraag daarna een offerte op maat aan.",
    color: "#e6a94a",
    badge: "Offerte Configurator",
    disclaimer: "Niets wordt automatisch verstuurd. Uw aanvraag komt eerst intern binnen voor goedkeuring.",
    ctaLabel: "Vraag offerte aan",
    embedMode: "simple",
    darkColor: "#14171d",
    bgColor: "#f3f2ec",
    companyName: "Digitify",
    companyTagline: "Partner in Digital Solutions",
    logoUrl: "",
    footerContact: "contact@digitify.be",
    footerPhone: "+32 (0) 486 51 57 73",
    footerWebsite: "www.digitify.be",
    stepServiceLabel: "DIENST",
    stepProductLabel: "PRODUCT",
    stepSpecsLabel: "SPECIFICATIES",
    stepDetailsLabel: "GEGEVENS",
    stepServiceHint: "Selecteer eerst een categorie met de dienst die u nodig hebt.",
    stepProductHint: "Kies daarna exact welk product binnen die categorie past.",
    stepSpecsHint: "Configureer uw pakket, opties en eventuele variabele parameters.",
    stepDetailsHint: "Vul tenslotte uw gegevens in om de offerteaanvraag te versturen.",
    categoryIconsJson: "{}",
    productIconsJson: "{}",
    serviceTitle: "Welke dienst zoekt u?",
    productTitle: "Kies uw product",
    specsTitle: "Specificaties",
    detailsTitle: "Uw gegevens",
    productSpecsJson: "{}",
  };

  const accentColor = settings.color || "#e6a94a";
  const darkColor = settings.darkColor || "#14171d";
  const bgColor = settings.bgColor || "#f3f2ec";
  const isAdvancedMode = settings.embedMode === "advanced";
  const studioState = payload?.studio || {
    viewport: "desktop",
    syncBuilderWithPreview: true,
    canUndo: false,
    canRedo: false,
    autosaveState: "idle",
    publishState: "published",
    hasUnpublishedChanges: false,
    lastPublishedAt: null,
  };
  const categoryIconsMap = useMemo(
    () => parseEmojiMap(settings.categoryIconsJson || "{}"),
    [settings.categoryIconsJson],
  );
  const productIconsMap = useMemo(
    () => parseEmojiMap(settings.productIconsJson || "{}"),
    [settings.productIconsJson],
  );

  const servicesByCategory = useMemo(() => {
    const source = payload?.services || [];
    const grouped = new Map<string, Service[]>();
    source.forEach((service) => {
      const key = (service.category || "Algemeen").trim();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(service);
    });
    return Array.from(grouped.entries()).map(([category, services]) => ({
      category,
      services,
      minPrice: Math.min(...services.map((item) => item.basePrice || 0)),
    }));
  }, [payload?.services]);

  const products = useMemo(() => {
    if (!selectedCategory) return [] as Service[];
    return (payload?.services || []).filter((service) => service.category === selectedCategory);
  }, [payload?.services, selectedCategory]);

  const selectedProduct = useMemo(() => {
    return (payload?.services || []).find((service) => service.id === selectedProductId) || null;
  }, [payload?.services, selectedProductId]);

  const siblingExtras = useMemo(() => {
    if (!selectedCategory) return [] as Service[];
    return (payload?.services || []).filter(
      (service) => service.category === selectedCategory && service.id !== selectedProductId,
    );
  }, [payload?.services, selectedCategory, selectedProductId]);

  const specsByProduct = useMemo(() => parseProductSpecs(settings.productSpecsJson), [settings.productSpecsJson]);

  const activeSpecs = useMemo(() => {
    if (!selectedProduct) return null;
    return resolveProductSpecs(selectedProduct, specsByProduct) || buildFallbackSpecs(selectedProduct, siblingExtras);
  }, [selectedProduct, siblingExtras, specsByProduct]);

  const packageOptions = activeSpecs?.packages || [];

  useEffect(() => {
    if (isAdvancedMode) return;
    setDiscountMode("amount");
    setDiscountInput("0");
    setVatRate(21);
  }, [isAdvancedMode]);

  useEffect(() => {
    if (!selectedProduct || !activeSpecs) return;

    const defaultPackage =
      packageOptions.find((pkg) => pkg.defaultSelected) ||
      packageOptions[0] ||
      {
        key: "basic",
        label: "Basis",
        subtitle: "",
        price: Math.max(1, selectedProduct.basePrice),
        features: [],
      };

    setCart((current) => {
      const next = { ...current };
      if (!next[selectedProduct.id]) {
        next[selectedProduct.id] = {
          serviceId: selectedProduct.id,
          source: "product",
          quantity: 1,
          unitPrice: defaultPackage.price,
          packageKey: defaultPackage.key,
          packageLabel: defaultPackage.label,
        };
      }

      if (!initializedProducts[selectedProduct.id]) {
        (activeSpecs.optionSections || []).forEach((section) => {
          section.options
            .filter((option) => option.defaultSelected)
            .forEach((option) => {
              const key = optionCartKey(selectedProduct.id, option.key);
              if (next[key]) return;
              next[key] = {
                serviceId: selectedProduct.id,
                source: "option",
                quantity: option.quantity || 1,
                unitPrice: option.price,
                packageKey: "option",
                packageLabel: "Optie",
                customName: option.label,
                customCategory: selectedProduct.category,
                customDescription: option.description || section.title,
              };
            });
        });
      }

      return next;
    });

    setSliderValues((current) => {
      const next = { ...current };
      (activeSpecs.sliders || []).forEach((slider) => {
        const key = sliderCartKey(selectedProduct.id, slider.key);
        if (typeof next[key] !== "number") {
          next[key] = Math.min(slider.max, Math.max(slider.min, slider.defaultValue ?? slider.min));
        }
      });
      return next;
    });

    if (!initializedProducts[selectedProduct.id]) {
      setInitializedProducts((current) => ({ ...current, [selectedProduct.id]: true }));
    }
  }, [selectedProduct, activeSpecs, initializedProducts, packageOptions]);

  function setProduct(service: Service) {
    setCart((current) => {
      const next = { ...current };
      Object.entries(next).forEach(([key, entry]) => {
        const keep =
          entry.serviceId === service.id ||
          Boolean(confirmedProducts[entry.serviceId]);
        if (!keep) delete next[key];
      });
      return next;
    });
    setSelectedProductId(service.id);
  }

  function confirmCurrentProduct() {
    if (!selectedProduct) return;
    if (!cart[selectedProduct.id]) return;
    setConfirmedProducts((current) => ({
      ...current,
      [selectedProduct.id]: true,
    }));
    setCurrentStep(1);
  }

  function updatePackage(option: PackageOption) {
    if (!selectedProductId) return;
    setCart((current) => {
      const existing = current[selectedProductId];
      if (!existing) return current;
      return {
        ...current,
        [selectedProductId]: {
          ...existing,
          unitPrice: option.price,
          packageKey: option.key,
          packageLabel: option.label,
        },
      };
    });
  }

  function adjustQuantity(cartKey: string, delta: number) {
    setCart((current) => {
      const existing = current[cartKey];
      if (!existing) return current;
      const nextQuantity = Math.max(1, existing.quantity + delta);
      return {
        ...current,
        [cartKey]: {
          ...existing,
          quantity: nextQuantity,
        },
      };
    });
  }

  function toggleSpecOption(section: SpecOptionSection, option: SpecOption) {
    if (!selectedProduct) return;
    const key = optionCartKey(selectedProduct.id, option.key);
    setCart((current) => {
      if (current[key]) {
        const clone = { ...current };
        delete clone[key];
        return clone;
      }
      return {
        ...current,
        [key]: {
          serviceId: selectedProduct.id,
          source: "option",
          quantity: option.quantity || 1,
          unitPrice: option.price,
          packageKey: "option",
          packageLabel: "Optie",
          customName: option.label,
          customCategory: selectedProduct.category,
          customDescription: option.description || section.title,
        },
      };
    });
  }

  function updateSlider(slider: SpecSlider, value: number) {
    if (!selectedProduct) return;
    const key = sliderCartKey(selectedProduct.id, slider.key);
    const included = slider.included || 0;
    const pricePerUnit = slider.pricePerUnit || 0;
    const chargedUnits = Math.max(0, value - included);
    const price = Math.round(chargedUnits * pricePerUnit * 100) / 100;

    setSliderValues((current) => ({ ...current, [key]: value }));
    setCart((current) => {
      const next = { ...current };
      if (price <= 0) {
        delete next[key];
        return next;
      }
      next[key] = {
        serviceId: selectedProduct.id,
        source: "slider",
        quantity: 1,
        unitPrice: price,
        packageKey: "slider",
        packageLabel: "Variabel",
        customName: `${slider.label} (${value}${slider.unitLabel || ""})`,
        customCategory: selectedProduct.category,
        customDescription: slider.hint || "Variabele kost",
      };
      return next;
    });
  }

  function removeFromCart(cartKey: string) {
    setCart((current) => {
      const clone = { ...current };
      const target = clone[cartKey];
      if (!target) return current;
      if (target.source === "product") {
        Object.entries(clone).forEach(([key, entry]) => {
          if (entry.serviceId === target.serviceId) delete clone[key];
        });
        setConfirmedProducts((previous) => {
          const next = { ...previous };
          delete next[target.serviceId];
          return next;
        });
      } else {
        delete clone[cartKey];
      }
      return clone;
    });
  }

  function updateQuestionAnswer(question: SpecQuestion, value: string | boolean) {
    if (!selectedProduct) return;
    const key = questionAnswerKey(selectedProduct.id, question.key);
    setQuestionAnswers((current) => ({ ...current, [key]: value }));
  }

  function getQuestionAnswer(question: SpecQuestion) {
    if (!selectedProduct) return question.type === "checkbox" ? false : "";
    const key = questionAnswerKey(selectedProduct.id, question.key);
    const raw = questionAnswers[key];
    if (question.type === "checkbox") return Boolean(raw);
    return typeof raw === "string" ? raw : "";
  }

  function addServiceFromStepOne() {
    const categoryName = (newCategoryName || selectedCategory || "Algemeen").trim();
    const firstProductName = (newServiceName || "Nieuw product").trim();
    const firstProductPrice = Math.max(0, sanitizeNumber(newServicePrice));
    sendPreviewAction({
      action: "add-category",
      category: categoryName,
      firstProductName,
      firstProductPrice,
      categoryEmoji: newCategoryEmoji.trim(),
      productEmoji: newProductEmoji.trim(),
    });
    setNewServiceName("");
    setNewServicePrice("0");
    setNewProductEmoji("");
    if (!newCategoryName.trim() && selectedCategory) return;
    setNewCategoryName("");
    setNewCategoryEmoji("");
  }

  function nextStep() {
    setCurrentStep((value) => Math.min(4, value + 1));
  }

  function prevStep() {
    setCurrentStep((value) => Math.max(1, value - 1));
  }

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([cartKey, entry]) => {
        const service = (payload?.services || []).find((item) => item.id === entry.serviceId);
        const category = entry.customCategory || service?.category || "Extra";
        const name = entry.customName || service?.name || "Optie";
        const description = entry.customDescription || service?.description || "";
        return {
          cartKey,
          source: entry.source,
          category,
          name,
          description,
          quantity: entry.quantity,
          unitPrice: entry.unitPrice,
          total: entry.unitPrice * entry.quantity,
          packageLabel: entry.packageLabel,
          packageKey: entry.packageKey,
        };
      })
      .filter((item) => item.quantity > 0 && item.unitPrice >= 0);
  }, [cart, payload?.services]);

  const subtotal = cartItems.reduce((sum, item) => sum + item.total, 0);
  const discountRaw = sanitizeNumber(discountInput);
  const discount =
    discountMode === "percent"
      ? Math.min(subtotal, (subtotal * Math.max(0, discountRaw)) / 100)
      : Math.min(subtotal, Math.max(0, discountRaw));
  const afterDiscount = Math.max(0, subtotal - discount);
  const vatAmount = Math.round(afterDiscount * (vatRate / 100) * 100) / 100;
  const total = afterDiscount + vatAmount;

  const stepLabels = {
    service: settings.stepServiceLabel || "DIENST",
    product: settings.stepProductLabel || "PRODUCT",
    specs: settings.stepSpecsLabel || "SPECIFICATIES",
    details: settings.stepDetailsLabel || "GEGEVENS",
  };

  const companyName = settings.companyName || "Digitify";
  const companyTagline = settings.companyTagline || "Partner in Digital Solutions";

  const visibleQuestions = useMemo(() => {
    if (!selectedProduct) return [] as SpecQuestion[];
    const selectedPackageKey = cart[selectedProduct.id]?.packageKey || "";
    return (activeSpecs?.questions || []).filter((question) => {
      if (question.showWhenPackageKey && question.showWhenPackageKey !== selectedPackageKey) return false;
      if (question.showWhenOptionKey) {
        const optionKey = optionCartKey(selectedProduct.id, question.showWhenOptionKey);
        if (!cart[optionKey]) return false;
      }
      return true;
    });
  }, [activeSpecs?.questions, cart, selectedProduct]);

  const requiredQuestionsComplete = useMemo(() => {
    if (isPreviewRoute) return true;
    if (!selectedProduct) return true;
    return visibleQuestions.every((question) => {
      if (!question.required) return true;
      const value = questionAnswers[questionAnswerKey(selectedProduct.id, question.key)];
      if (question.type === "checkbox") return Boolean(value);
      return typeof value === "string" && value.trim().length > 0;
    });
  }, [isPreviewRoute, questionAnswers, selectedProduct, visibleQuestions]);

  const hasConfirmedProducts = useMemo(() => {
    if (isPreviewRoute) return cartItems.some((item) => item.source === "product");
    if (payload?.editingQuote) return cartItems.length > 0;
    return cartItems.some((item) => item.source === "product" && Boolean(confirmedProducts[item.cartKey]));
  }, [cartItems, confirmedProducts, isPreviewRoute, payload?.editingQuote]);

  const currentProductConfirmed = Boolean(selectedProduct && confirmedProducts[selectedProduct.id]);

  const stepReady = {
    1: Boolean(selectedCategory),
    2: Boolean(selectedProductId),
    3: cartItems.length > 0 && requiredQuestionsComplete && hasConfirmedProducts,
    4:
      hasConfirmedProducts &&
      isValidEmail(email) &&
      (isInternalMode
        ? firstName.trim().length > 0 || company.trim().length > 0
        : firstName.trim().length > 0 && lastName.trim().length > 0),
  };

  function sendPreviewAction(payload: Record<string, unknown>) {
    if (!isPreviewRoute) return;
    window.parent?.postMessage(
      {
        type: "digitify-quote-preview-action",
        payload,
      },
      window.location.origin,
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isLivePreview) {
      setStatus({
        type: "success",
        message: "Preview modus: verzending staat uit. Gebruik dit scherm enkel voor visuele controle.",
      });
      return;
    }
    if (!stepReady[4]) {
      setStatus({ type: "error", message: "Vul alle verplichte velden correct in." });
      return;
    }

    setSubmitting(true);
    setStatus(null);

    const name = `${firstName.trim()} ${lastName.trim()}`.trim() || company.trim();
    const questionSummary =
      selectedProduct && activeSpecs?.questions?.length
        ? activeSpecs.questions
            .map((question) => {
              const value = questionAnswers[questionAnswerKey(selectedProduct.id, question.key)];
              if (question.type === "checkbox") {
                if (value !== true && value !== false) return "";
                return `- ${question.label}: ${value ? "Ja" : "Nee"}`;
              }
              const answer = typeof value === "string" ? value.trim() : "";
              if (!answer) return "";
              return `- ${question.label}: ${answer}`;
            })
            .filter(Boolean)
            .join("\n")
        : "";
    const noteParts = [
      specNotes.trim() ? `Specificaties: ${specNotes.trim()}` : "",
      questionSummary ? `Antwoorden offertevragen:\n${questionSummary}` : "",
      remarks.trim() ? `Opmerkingen klant: ${remarks.trim()}` : "",
      isAdvancedMode && discount > 0
        ? `Korting toegepast: ${discountMode === "percent" ? `${discountRaw}%` : formatCurrency(discountRaw)}`
        : "",
    ].filter(Boolean);

    const itemsPayload = cartItems.map((item) => ({
      category: item.category,
      name: item.source === "product" ? `${item.name} - ${item.packageLabel}` : item.name,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));

    const response = await fetch(
      isInternalMode ? "/api/quotes/configurator/request" : "/api/public/quotes/request",
      {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: name,
        clientEmail: email.trim(),
        clientCompany: company.trim(),
        clientPhone: phone.trim(),
        clientAddress: address.trim(),
        clientVat: vatNumber.trim(),
        notes: noteParts.join("\n"),
        vatRate,
        discount,
        quoteId: isInternalMode ? payload?.editingQuote?.id || quoteIdParam || undefined : undefined,
        items: itemsPayload,
        tenant: isInternalMode ? undefined : tenantToken || undefined,
        leadId: isInternalMode ? payload?.prefill?.leadId || leadIdParam || undefined : undefined,
        chatSessionId: isInternalMode
          ? payload?.prefill?.chatSessionId || chatSessionIdParam || undefined
          : undefined,
      }),
      },
    );

    const data = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setStatus({ type: "error", message: data.error || "Aanvraag opslaan mislukt." });
      return;
    }

    setStatus({ type: "success", message: `${data.message} Referentie: ${data.quoteNumber}.` });
    if (isInternalMode && data.quoteId) {
      window.location.href = `/quotes/${encodeURIComponent(data.quoteId)}`;
    }
  }

  if (remoteError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="rounded-2xl border bg-white px-6 py-5 text-sm text-red-600">{remoteError}</div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="rounded-2xl border bg-white px-6 py-5 text-sm text-slate-600">
          {isPreviewRoute
            ? "Wachten op live preview data uit instellingen..."
            : "Configurator laden..."}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden px-2 py-2 text-[#17181c] sm:px-4" style={{ backgroundColor: bgColor }}>
      <div className="mx-auto flex h-[calc(100vh-1rem)] max-w-[1500px] flex-col overflow-hidden rounded-[20px] border border-black/10 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
        {isPreviewRoute ? (
          <div className="border-b border-[#e4dcc8] bg-[#f6f0df] px-3 py-2 text-[11px] text-[#5d5648] sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">Studio</span>
              <span>Stap {currentStep}</span>
              <span>•</span>
              <span>{selectedCategory || "Geen categorie"}</span>
              <span>•</span>
              <span>{selectedProductId || "Geen product"}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => sendPreviewAction({ action: "set-mode", mode: "simple" })}
                className="rounded-md border px-2 py-1 text-[11px]"
                style={{
                  borderColor: settings.embedMode === "simple" ? accentColor : "#d6d1c2",
                  backgroundColor: settings.embedMode === "simple" ? `${accentColor}2a` : "#fff",
                }}
              >
                Simple
              </button>
              <button
                type="button"
                onClick={() => sendPreviewAction({ action: "set-mode", mode: "advanced" })}
                className="rounded-md border px-2 py-1 text-[11px]"
                style={{
                  borderColor: settings.embedMode === "advanced" ? accentColor : "#d6d1c2",
                  backgroundColor: settings.embedMode === "advanced" ? `${accentColor}2a` : "#fff",
                }}
              >
                Advanced
              </button>
              <button
                type="button"
                onClick={() => sendPreviewAction({ action: "set-viewport", viewport: "desktop" })}
                className="rounded-md border px-2 py-1 text-[11px]"
                style={{
                  borderColor: studioState.viewport === "desktop" ? accentColor : "#d6d1c2",
                  backgroundColor: studioState.viewport === "desktop" ? `${accentColor}2a` : "#fff",
                }}
              >
                Desktop
              </button>
              <button
                type="button"
                onClick={() => sendPreviewAction({ action: "set-viewport", viewport: "tablet" })}
                className="rounded-md border px-2 py-1 text-[11px]"
                style={{
                  borderColor: studioState.viewport === "tablet" ? accentColor : "#d6d1c2",
                  backgroundColor: studioState.viewport === "tablet" ? `${accentColor}2a` : "#fff",
                }}
              >
                Tablet
              </button>
              <button
                type="button"
                onClick={() => sendPreviewAction({ action: "set-viewport", viewport: "mobile" })}
                className="rounded-md border px-2 py-1 text-[11px]"
                style={{
                  borderColor: studioState.viewport === "mobile" ? accentColor : "#d6d1c2",
                  backgroundColor: studioState.viewport === "mobile" ? `${accentColor}2a` : "#fff",
                }}
              >
                Mobile
              </button>
              <label className="ml-1 inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-[11px]">
                <input
                  type="checkbox"
                  checked={Boolean(studioState.syncBuilderWithPreview)}
                  onChange={(event) =>
                    sendPreviewAction({
                      action: "set-sync",
                      value: event.target.checked,
                    })
                  }
                />
                Sync
              </label>
              <button
                type="button"
                onClick={() => sendPreviewAction({ action: "undo" })}
                disabled={!studioState.canUndo}
                className="rounded-md border bg-white px-2 py-1 text-[11px] disabled:opacity-40"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={() => sendPreviewAction({ action: "redo" })}
                disabled={!studioState.canRedo}
                className="rounded-md border bg-white px-2 py-1 text-[11px] disabled:opacity-40"
              >
                Redo
              </button>
              <button
                type="button"
                onClick={() => sendPreviewAction({ action: "save-all" })}
                className="rounded-md px-2 py-1 text-[11px] font-semibold"
                style={{ backgroundColor: accentColor, color: darkColor }}
              >
                {studioState.hasUnpublishedChanges ? "Publiceer" : "Gepubliceerd"}
              </button>
              <button
                type="button"
                onClick={() => sendPreviewAction({ action: "restore-published" })}
                className="rounded-md border bg-white px-2 py-1 text-[11px] disabled:opacity-40"
                disabled={!studioState.hasUnpublishedChanges}
              >
                Reset Draft
              </button>
              <span className="text-[11px] text-[#6a6152]">
                Status: {studioState.publishState === "draft" ? "Draft" : "Live"}
              </span>
            </div>
          </div>
        ) : null}
        <header className="px-3 py-2 text-white sm:px-5" style={{ background: `linear-gradient(135deg, ${darkColor} 0%, #1f2228 100%)` }}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt={companyName} className="h-8 w-auto rounded" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: accentColor }}>
                  ▶
                </div>
              )}
              <div>
                <p className="text-base font-semibold leading-none">{companyName}</p>
                <p className="mt-1 text-xs text-white/60">{companyTagline}</p>
              </div>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: accentColor, color: darkColor }}>
              {currentStep}
            </div>
          </div>
        </header>

        {isLivePreview ? (
          <div className="border-b border-[#eadfca] bg-[#fbf6ea] px-3 py-2 text-xs text-[#6e6249] sm:px-6">
            Live preview vanuit instellingen: wijzigingen worden direct getoond, maar niet verstuurd.
          </div>
        ) : null}
        {payload.editingQuote ? (
          <div className="border-b border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 sm:px-6">
            Bewerken: {payload.editingQuote.quoteNumber}. De bestaande items zijn geladen en worden bijgewerkt in dezelfde offerte.
          </div>
        ) : null}

        <div className="border-b border-black/10 bg-[#fbfaf7] px-3 py-2 sm:px-6">
          <div className="grid grid-cols-4 items-center gap-3">
            {[
              { n: 1, label: stepLabels.service },
              { n: 2, label: stepLabels.product },
              { n: 3, label: stepLabels.specs },
              { n: 4, label: stepLabels.details },
            ].map((step, index, array) => {
              const active = currentStep >= step.n;
              const current = currentStep === step.n;
              return (
                <div key={step.n} className="flex items-center gap-2">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold"
                    style={{
                      borderColor: current ? accentColor : "#d5d7dd",
                      backgroundColor: current ? accentColor : active ? darkColor : "#fff",
                      color: current ? darkColor : active ? "#fff" : "#9498a3",
                    }}
                  >
                    {step.n}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold tracking-wide text-[#7a7f88]">{step.label}</div>
                    {index < array.length - 1 ? (
                      <div className="mt-1 h-[2px] w-full rounded" style={{ backgroundColor: currentStep > step.n ? accentColor : "#e3e5ea" }} />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-h-0 overflow-y-auto border-r border-black/10 px-3 py-3 sm:px-6">
            {currentStep === 1 ? (
              <div className="space-y-4 sm:space-y-5">
                <div>
                  <h1 className="text-[22px] font-black leading-tight tracking-tight sm:text-[27px] lg:text-[32px]" style={{ color: darkColor }}>
                    {settings.serviceTitle}
                  </h1>
                  <p className="mt-2 text-sm text-[#6e747e]">{settings.stepServiceHint || settings.description}</p>
                  {isPreviewRoute ? (
                    <p className="mt-1 text-xs text-[#8a7b60]">
                      In stap 1 beheert u diensten als categorieen. Producten beheert u in stap 2.
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {servicesByCategory.map((group) => {
                    const selected = group.category === selectedCategory;
                    if (!isPreviewRoute) {
                      return (
                        <button
                          key={group.category}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(group.category);
                            setSelectedProductId("");
                          }}
                          className="rounded-[18px] border bg-white p-3 text-left transition hover:shadow-sm sm:p-4"
                          style={{ borderColor: selected ? accentColor : "#e2e3e7", boxShadow: selected ? `0 0 0 2px ${accentColor}33 inset` : "none" }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-[#f5f6f8] text-lg">
                              {renderConfiguratorIcon(getCategoryIcon(group.category, categoryIconsMap), group.category)}
                            </div>
                            {selected ? (
                              <div className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: accentColor, color: darkColor }}>
                                ✓
                              </div>
                            ) : null}
                          </div>
                          <p className="mt-4 text-base font-semibold">{group.category}</p>
                          <p className="mt-1 text-sm text-[#7b818c]">{group.services.length} product(en) beschikbaar</p>
                          <p className="mt-2 text-sm font-semibold" style={{ color: accentColor }}>
                            Vanaf {formatCurrency(group.minPrice)}
                          </p>
                        </button>
                      );
                    }
                    return (
                      <div
                        key={group.category}
                        className="rounded-[18px] border bg-white p-3 text-left transition hover:shadow-sm sm:p-4"
                        style={{ borderColor: selected ? accentColor : "#e2e3e7", boxShadow: selected ? `0 0 0 2px ${accentColor}33 inset` : "none" }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategory(group.category);
                            setSelectedProductId("");
                          }}
                          className="w-full text-left"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-[#f5f6f8] text-lg">
                              {renderConfiguratorIcon(getCategoryIcon(group.category, categoryIconsMap), group.category)}
                            </div>
                            {selected ? (
                              <div className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: accentColor, color: darkColor }}>
                                ✓
                              </div>
                            ) : null}
                          </div>
                          <p className="mt-4 text-base font-semibold">{group.category}</p>
                          <p className="mt-1 text-sm text-[#7b818c]">{group.services.length} product(en) beschikbaar</p>
                          <p className="mt-2 text-sm font-semibold" style={{ color: accentColor }}>
                            Vanaf {formatCurrency(group.minPrice)}
                          </p>
                        </button>
                        <div className="mt-3">
                          <select
                            value={categoryIconsMap[group.category] || ""}
                            onChange={(event) =>
                              sendPreviewAction({
                                action: "set-category-icon",
                                category: group.category,
                                emoji: event.target.value,
                              })
                            }
                            className="h-8 w-full rounded border px-2 text-xs"
                          >
                            <option value="">Geen</option>
                            {[...new Set([categoryIconsMap[group.category] || "", ...EMOJI_DROPDOWN_OPTIONS])]
                              .filter((emoji) => emoji.length > 0)
                              .map((emoji) => (
                                <option key={`cat-emoji-${group.category}-${emoji}`} value={emoji}>
                                  {emoji}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                          <input
                            defaultValue={group.category}
                            onBlur={(event) =>
                              sendPreviewAction({
                                action: "rename-category",
                                oldCategory: group.category,
                                newCategory: event.target.value,
                              })
                            }
                            className="h-8 rounded border px-2 text-xs"
                            placeholder="Dienstnaam"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!window.confirm(`Dienst "${group.category}" verwijderen met alle producten?`)) return;
                              sendPreviewAction({
                                action: "remove-category",
                                category: group.category,
                              });
                            }}
                            className="rounded border px-2 py-1 text-xs font-semibold text-[#7a2e2e]"
                          >
                            Verwijder
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {isPreviewRoute ? (
                    <div
                      className="rounded-[18px] border border-dashed bg-white/70 p-3 text-left sm:p-4"
                      style={{ borderColor: `${accentColor}66` }}
                    >
                      <p className="text-sm font-semibold" style={{ color: darkColor }}>+ Nieuwe dienst/categorie</p>
                      <p className="mt-1 text-xs text-[#7b818c]">Maak een nieuwe dienst (categorie) met een eerste product.</p>
                      <div className="mt-3 space-y-2">
                        <div className="grid grid-cols-[1fr_74px] gap-2">
                          <input
                            value={newCategoryName}
                            onChange={(event) => setNewCategoryName(event.target.value)}
                            className="h-8 rounded border px-2 text-xs"
                            placeholder="Dienstnaam"
                          />
                          <select
                            value={newCategoryEmoji}
                            onChange={(event) => setNewCategoryEmoji(event.target.value)}
                            className="h-8 rounded border px-2 text-xs"
                          >
                            <option value="">Geen</option>
                            {EMOJI_DROPDOWN_OPTIONS.map((emoji) => (
                              <option key={`new-category-emoji-${emoji}`} value={emoji}>
                                {emoji}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-[1fr_74px] gap-2">
                          <input
                            value={newServiceName}
                            onChange={(event) => setNewServiceName(event.target.value)}
                            className="h-8 rounded border px-2 text-xs"
                            placeholder="Eerste productnaam"
                          />
                          <select
                            value={newProductEmoji}
                            onChange={(event) => setNewProductEmoji(event.target.value)}
                            className="h-8 rounded border px-2 text-xs"
                          >
                            <option value="">Geen</option>
                            {EMOJI_DROPDOWN_OPTIONS.map((emoji) => (
                              <option key={`new-product-emoji-${emoji}`} value={emoji}>
                                {emoji}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={newServicePrice}
                            onChange={(event) => setNewServicePrice(event.target.value)}
                            className="h-8 rounded border px-2 text-xs"
                            placeholder="Basisprijs"
                          />
                          <button
                            type="button"
                            onClick={addServiceFromStepOne}
                            disabled={!newCategoryName.trim()}
                            className="rounded px-3 py-1 text-xs font-semibold"
                            style={{ backgroundColor: accentColor, color: darkColor }}
                          >
                            + Dienst toevoegen
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" className="rounded-xl border px-3 py-2 text-sm text-[#616671]">
                    {cartItems.length} item(s) in uw offerte
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    disabled={!hasConfirmedProducts}
                    className="rounded-xl border px-3 py-2 text-xs font-semibold text-[#616671] disabled:opacity-50 sm:px-4 sm:text-sm"
                  >
                    Naar gegevens
                  </button>
                  <button
                    type="button"
                    onClick={nextStep}
                    disabled={!stepReady[1]}
                    className="rounded-xl px-3 py-2 text-xs font-semibold text-[#15171c] disabled:opacity-50 sm:px-4 sm:text-sm"
                    style={{ backgroundColor: accentColor }}
                  >
                    Volgende: Product kiezen
                  </button>
                </div>
              </div>
            ) : null}

            {currentStep === 2 ? (
              <div className="space-y-4 sm:space-y-5">
                <div>
                  <h2 className="text-[22px] font-black leading-tight tracking-tight sm:text-[27px] lg:text-[32px]" style={{ color: darkColor }}>
                    {selectedCategory || settings.productTitle}
                  </h2>
                  <p className="mt-2 text-sm text-[#6e747e]">
                    {settings.stepProductHint || settings.productTitle} · {products.length} product(en) beschikbaar
                  </p>
                  {!isPreviewRoute ? (
                    <p className="mt-1 text-xs text-[#8a7b60]">
                      Een product wordt pas definitief toegevoegd nadat u in stap 3 op "Toevoegen aan offerte" klikt.
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {products.map((service) => {
                    const isSelected = service.id === selectedProductId;
                    if (isPreviewRoute) {
                      return (
                        <div
                          key={service.id}
                          className="rounded-[18px] border bg-white p-3 transition hover:shadow-sm sm:p-4"
                          style={{ borderColor: isSelected ? accentColor : "#e2e3e7", boxShadow: isSelected ? `0 0 0 2px ${accentColor}33 inset` : "none" }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setProduct(service)}
                              className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f5f6f8] text-xl"
                            >
                              {renderConfiguratorIcon(getServiceIcon(service, productIconsMap), service.name)}
                            </button>
                            <button
                              type="button"
                              onClick={() => sendPreviewAction({ action: "remove-product", productId: service.id })}
                              className="rounded border px-2 py-1 text-[11px] text-[#6e7480] hover:text-[#1c1f25]"
                            >
                              Verwijder
                            </button>
                          </div>
                          <div className="mt-3 space-y-2">
                            <div className="grid grid-cols-[1fr_72px] gap-2">
                              <input
                                defaultValue={service.name}
                                onBlur={(event) =>
                                  sendPreviewAction({
                                    action: "update-product",
                                    productId: service.id,
                                    patch: { name: event.target.value },
                                  })
                                }
                                className="h-8 w-full rounded border px-2 text-sm"
                              />
                              <select
                                value={getServiceIcon(service, productIconsMap)}
                                onChange={(event) =>
                                  sendPreviewAction({
                                    action: "set-product-icon",
                                    productId: service.id,
                                    emoji: event.target.value,
                                  })
                                }
                                className="h-8 w-full rounded border px-2 text-xs"
                              >
                                <option value="">Geen</option>
                                {[...new Set([getServiceIcon(service, productIconsMap), ...EMOJI_DROPDOWN_OPTIONS])]
                                  .filter((emoji) => emoji.length > 0)
                                  .map((emoji) => (
                                    <option key={`product-emoji-${service.id}-${emoji}`} value={emoji}>
                                      {emoji}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <input
                              defaultValue={service.description || ""}
                              onBlur={(event) =>
                                sendPreviewAction({
                                  action: "update-product",
                                  productId: service.id,
                                  patch: { description: event.target.value },
                                })
                              }
                              className="h-8 w-full rounded border px-2 text-xs"
                              placeholder="Beschrijving"
                            />
                            <input
                              defaultValue={service.category}
                              onBlur={(event) =>
                                sendPreviewAction({
                                  action: "update-product",
                                  productId: service.id,
                                  patch: { category: event.target.value },
                                })
                              }
                              className="h-8 w-full rounded border px-2 text-xs"
                              placeholder="Categorie"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                defaultValue={service.basePrice}
                                onBlur={(event) =>
                                  sendPreviewAction({
                                    action: "update-product",
                                    productId: service.id,
                                    patch: { basePrice: Number(event.target.value) || 0 },
                                  })
                                }
                                className="h-8 w-full rounded border px-2 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => setProduct(service)}
                                className="rounded border px-2 py-1 text-xs font-semibold"
                                style={{ borderColor: accentColor }}
                              >
                                {isSelected ? "Geselecteerd" : "Selecteer"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => setProduct(service)}
                        className="rounded-[18px] border bg-white p-3 text-left transition hover:shadow-sm sm:p-4"
                        style={{ borderColor: isSelected ? accentColor : "#e2e3e7", boxShadow: isSelected ? `0 0 0 2px ${accentColor}33 inset` : "none" }}
                      >
                        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-[#f5f6f8] text-xl">
                          {renderConfiguratorIcon(getServiceIcon(service, productIconsMap), service.name)}
                        </div>
                        <p className="mt-4 text-base font-semibold sm:text-lg">{service.name}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-[#7b818c]">{service.description || "Selecteer om verder te configureren."}</p>
                        <p className="mt-3 text-sm font-semibold" style={{ color: accentColor }}>
                          Vanaf {formatCurrency(service.basePrice)}
                        </p>
                      </button>
                    );
                  })}
                  {isPreviewRoute ? (
                    <button
                      type="button"
                      onClick={() => sendPreviewAction({ action: "add-product", category: selectedCategory })}
                      className="flex min-h-[180px] flex-col items-center justify-center rounded-[18px] border border-dashed bg-white/70 p-4 text-center"
                      style={{ borderColor: `${accentColor}66` }}
                    >
                      <span className="text-2xl font-bold" style={{ color: accentColor }}>+</span>
                      <span className="mt-2 text-sm font-semibold">Product toevoegen</span>
                      <span className="mt-1 text-xs text-[#7b818c]">Direct in deze categorie</span>
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={prevStep} className="rounded-xl border px-3 py-2 text-xs text-[#616671] sm:px-4 sm:text-sm">
                    Terug
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    disabled={!hasConfirmedProducts}
                    className="rounded-xl border px-3 py-2 text-xs font-semibold text-[#616671] disabled:opacity-50 sm:px-4 sm:text-sm"
                  >
                    Naar gegevens
                  </button>
                  <button
                    type="button"
                    onClick={nextStep}
                    disabled={!stepReady[2]}
                    className="rounded-xl px-3 py-2 text-xs font-semibold text-[#15171c] disabled:opacity-50 sm:px-4 sm:text-sm"
                    style={{ backgroundColor: accentColor }}
                  >
                    Volgende: Specificaties
                  </button>
                </div>
              </div>
            ) : null}

            {currentStep === 3 ? (
              <div className="space-y-4 sm:space-y-5">
                <div>
                  <h2 className="text-[22px] font-black leading-tight tracking-tight sm:text-[27px] lg:text-[32px]" style={{ color: darkColor }}>
                    {activeSpecs?.headline || selectedProduct?.name || settings.specsTitle}
                  </h2>
                  <p className="mt-2 text-sm text-[#6e747e]">{activeSpecs?.subheadline || settings.stepSpecsHint || settings.specsTitle}</p>
                </div>

                {selectedProduct && activeSpecs ? (
                  <>
                    <div className="rounded-[16px] border border-[#e3e4e8] bg-[#f9f8f4] p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6f7580]">{activeSpecs.packageSectionTitle || "PAKKET"}</p>
                      <div className="grid gap-2 md:grid-cols-3">
                        {packageOptions.map((option) => {
                          const isActive = cart[selectedProduct.id]?.packageKey === option.key;
                          return (
                            <div key={option.key} className="rounded-xl border bg-white p-2" style={{ borderColor: isActive ? accentColor : "#e1e3e8", boxShadow: isActive ? `0 0 0 2px ${accentColor}33 inset` : "none" }}>
                              <div className="mb-1 flex items-center justify-end">
                                {isPreviewRoute ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      sendPreviewAction({
                                        action: "remove-package",
                                        productId: selectedProduct.id,
                                        targetKey: option.key,
                                      })
                                    }
                                    className="rounded border px-1.5 py-0.5 text-[10px] text-[#6e7480] hover:text-[#1c1f25]"
                                  >
                                    Verwijder
                                  </button>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                onClick={() => updatePackage(option)}
                                className="w-full rounded-lg p-2 text-left"
                              >
                                {isPreviewRoute ? (
                                  <div className="space-y-2" onClick={(event) => event.stopPropagation()}>
                                    <input
                                      defaultValue={option.label}
                                      onBlur={(event) =>
                                        sendPreviewAction({
                                          action: "update-package",
                                          productId: selectedProduct.id,
                                          targetKey: option.key,
                                          patch: { label: event.target.value },
                                        })
                                      }
                                      className="h-8 w-full rounded border px-2 text-sm"
                                    />
                                    <input
                                      defaultValue={option.subtitle}
                                      onBlur={(event) =>
                                        sendPreviewAction({
                                          action: "update-package",
                                          productId: selectedProduct.id,
                                          targetKey: option.key,
                                          patch: { subtitle: event.target.value },
                                        })
                                      }
                                      className="h-8 w-full rounded border px-2 text-xs"
                                      placeholder="Subtitel"
                                    />
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      defaultValue={option.price}
                                      onBlur={(event) =>
                                        sendPreviewAction({
                                          action: "update-package",
                                          productId: selectedProduct.id,
                                          targetKey: option.key,
                                          patch: { price: Number(event.target.value) || 0 },
                                        })
                                      }
                                      className="h-8 w-full rounded border px-2 text-xs"
                                    />
                                  </div>
                                ) : (
                                  <>
                                    <p className="text-sm font-semibold">{option.label}</p>
                                    <p className="mt-1 text-xs text-[#757b86]">{option.subtitle}</p>
                                    <p className="mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: `${accentColor}22`, color: "#8b5d12" }}>
                                      {formatCurrency(option.price)}
                                    </p>
                                  </>
                                )}
                                {isPreviewRoute ? (
                                  <div className="mt-2 space-y-1" onClick={(event) => event.stopPropagation()}>
                                    {(option.features || []).map((feature, featureIndex) => (
                                      <div key={`${option.key}-feature-${featureIndex}`} className="flex items-center gap-1">
                                        <input
                                          defaultValue={feature}
                                          onBlur={(event) =>
                                            sendPreviewAction({
                                              action: "update-package-feature",
                                              productId: selectedProduct.id,
                                              targetKey: option.key,
                                              featureIndex,
                                              value: event.target.value,
                                            })
                                          }
                                          className="h-7 w-full rounded border px-2 text-xs"
                                          placeholder="Bullet"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            sendPreviewAction({
                                              action: "remove-package-feature",
                                              productId: selectedProduct.id,
                                              targetKey: option.key,
                                              featureIndex,
                                            })
                                          }
                                          className="rounded border px-1.5 py-0.5 text-[10px]"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        sendPreviewAction({
                                          action: "add-package-feature",
                                          productId: selectedProduct.id,
                                          targetKey: option.key,
                                        })
                                      }
                                      className="rounded border px-2 py-1 text-[10px] font-semibold"
                                      style={{ borderColor: `${accentColor}80` }}
                                    >
                                      + Bullet
                                    </button>
                                  </div>
                                ) : option.features.length > 0 ? (
                                  <ul className="mt-2 space-y-1 text-xs text-[#6e7480]">
                                    {option.features.map((feature) => (
                                      <li key={feature}>✓ {feature}</li>
                                    ))}
                                  </ul>
                                ) : null}
                              </button>
                            </div>
                          );
                        })}
                        {isPreviewRoute ? (
                          <button
                            type="button"
                            onClick={() => sendPreviewAction({ action: "add-package", productId: selectedProduct.id })}
                            className="flex min-h-[150px] flex-col items-center justify-center rounded-xl border border-dashed bg-white/70 p-3 text-center"
                            style={{ borderColor: `${accentColor}66` }}
                          >
                            <span className="text-2xl font-bold" style={{ color: accentColor }}>+</span>
                            <span className="mt-2 text-sm font-semibold">Pakket toevoegen</span>
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {(activeSpecs.optionSections || []).map((section) => (
                      <div key={section.title} className="rounded-[16px] border border-[#e3e4e8] bg-[#f9f8f4] p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6f7580]">{section.title}</p>
                        <div className="space-y-2">
                          {section.options.length === 0 ? (
                            <p className="text-sm text-[#7a808a]">Geen opties geconfigureerd.</p>
                          ) : (
                            section.options.map((option) => {
                              const key = optionCartKey(selectedProduct.id, option.key);
                              const enabled = Boolean(cart[key]);
                              return (
                                <div key={key} className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleSpecOption(section, option)}
                                    className="flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-left"
                                    style={{ borderColor: enabled ? accentColor : "#e1e3e8" }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex h-4 w-4 items-center justify-center rounded border text-[10px]" style={{ borderColor: enabled ? accentColor : "#ced2da", color: enabled ? darkColor : "#7b8190", backgroundColor: enabled ? accentColor : "#fff" }}>
                                        {enabled ? "✓" : ""}
                                      </span>
                                      {isPreviewRoute ? (
                                        <input
                                          defaultValue={option.label}
                                          onClick={(event) => event.stopPropagation()}
                                          onBlur={(event) =>
                                            sendPreviewAction({
                                              action: "update-option",
                                              productId: selectedProduct.id,
                                              targetKey: option.key,
                                              patch: { label: event.target.value },
                                            })
                                          }
                                          className="h-7 rounded border px-2 text-xs"
                                        />
                                      ) : (
                                        <span className="text-sm">{option.label}</span>
                                      )}
                                    </div>
                                    {isPreviewRoute ? (
                                      <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          defaultValue={option.price}
                                          onBlur={(event) =>
                                            sendPreviewAction({
                                              action: "update-option",
                                              productId: selectedProduct.id,
                                              targetKey: option.key,
                                              patch: { price: Number(event.target.value) || 0 },
                                            })
                                          }
                                          className="h-7 w-20 rounded border px-2 text-xs"
                                        />
                                        <span className="text-xs">{option.unit || ""}</span>
                                      </div>
                                    ) : (
                                      <span className="text-sm font-semibold" style={{ color: "#c9811b" }}>
                                        +{formatCurrency(option.price)}{option.unit || ""}
                                      </span>
                                    )}
                                  </button>
                                  {isPreviewRoute ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        sendPreviewAction({
                                          action: "remove-option",
                                          productId: selectedProduct.id,
                                          targetKey: option.key,
                                        })
                                      }
                                      className="rounded border px-2 py-1 text-[11px] text-[#6e7480] hover:text-[#1c1f25]"
                                    >
                                      ✕
                                    </button>
                                  ) : null}
                                </div>
                              );
                            })
                          )}
                          {isPreviewRoute ? (
                            <button
                              type="button"
                              onClick={() => sendPreviewAction({ action: "add-option", productId: selectedProduct.id })}
                              className="flex w-full items-center justify-center rounded-lg border border-dashed bg-white/70 px-3 py-2 text-xs font-semibold"
                              style={{ borderColor: `${accentColor}66`, color: darkColor }}
                            >
                              + Optie toevoegen
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}

                    {(activeSpecs.sliders || []).map((slider) => {
                      const key = sliderCartKey(selectedProduct.id, slider.key);
                      const value = sliderValues[key] ?? slider.defaultValue ?? slider.min;
                      const included = slider.included || 0;
                      const extra = Math.max(0, value - included);
                      const extraCost = Math.round(extra * (slider.pricePerUnit || 0) * 100) / 100;
                      return (
                        <div key={key} className="rounded-[16px] border border-[#e3e4e8] bg-[#f9f8f4] p-3">
                          <div className="flex items-center justify-between gap-2">
                            {isPreviewRoute ? (
                              <input
                                defaultValue={slider.label}
                                onBlur={(event) =>
                                  sendPreviewAction({
                                    action: "update-slider",
                                    productId: selectedProduct.id,
                                    targetKey: slider.key,
                                    patch: { label: event.target.value },
                                  })
                                }
                                className="h-7 rounded border px-2 text-xs font-semibold"
                              />
                            ) : (
                              <p className="text-xs font-semibold uppercase tracking-wide text-[#6f7580]">{slider.label}</p>
                            )}
                            {isPreviewRoute ? (
                              <button
                                type="button"
                                onClick={() =>
                                  sendPreviewAction({
                                    action: "remove-slider",
                                    productId: selectedProduct.id,
                                    targetKey: slider.key,
                                  })
                                }
                                className="rounded border px-1.5 py-0.5 text-[10px] text-[#6e7480] hover:text-[#1c1f25]"
                              >
                                Verwijder
                              </button>
                            ) : null}
                          </div>
                          {isPreviewRoute ? (
                            <div className="mt-1 grid gap-1 sm:grid-cols-2">
                              <input
                                defaultValue={slider.hint || ""}
                                onBlur={(event) =>
                                  sendPreviewAction({
                                    action: "update-slider",
                                    productId: selectedProduct.id,
                                    targetKey: slider.key,
                                    patch: { hint: event.target.value },
                                  })
                                }
                                className="h-7 rounded border px-2 text-xs"
                                placeholder="Hint"
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                defaultValue={slider.pricePerUnit || 0}
                                onBlur={(event) =>
                                  sendPreviewAction({
                                    action: "update-slider",
                                    productId: selectedProduct.id,
                                    targetKey: slider.key,
                                    patch: { pricePerUnit: Number(event.target.value) || 0 },
                                  })
                                }
                                className="h-7 rounded border px-2 text-xs"
                                placeholder="€/eenheid"
                              />
                            </div>
                          ) : (
                            <p className="mt-1 text-xs text-[#7a808a]">{slider.hint || "Variabele parameter"}</p>
                          )}
                          <input
                            type="range"
                            min={slider.min}
                            max={slider.max}
                            step={slider.step || 1}
                            value={value}
                            onChange={(event) => updateSlider(slider, Number(event.target.value))}
                            className="mt-3 w-full"
                            style={{ accentColor }}
                          />
                          <div className="mt-1 flex items-center justify-between text-xs text-[#7a808a]">
                            <span>{value}{slider.unitLabel || ""}</span>
                            <span>{extraCost > 0 ? `+${formatCurrency(extraCost)}` : "Geen extra kost"}</span>
                          </div>
                        </div>
                      );
                    })}
                    {isPreviewRoute && selectedProduct ? (
                      <button
                        type="button"
                        onClick={() => sendPreviewAction({ action: "add-slider", productId: selectedProduct.id })}
                        className="flex w-full items-center justify-center rounded-[16px] border border-dashed bg-white/70 px-3 py-2 text-xs font-semibold"
                        style={{ borderColor: `${accentColor}66`, color: darkColor }}
                      >
                        + Slider toevoegen
                      </button>
                    ) : null}

                    <div className="space-y-3 rounded-[16px] border border-[#e3e4e8] bg-white p-3">
                      {isPreviewRoute ? (
                        <div className="space-y-2 rounded-md border border-[#eadfca] bg-[#fbf6ea] px-3 py-2">
                          <input
                            defaultValue={activeSpecs.questionsCard?.title || ""}
                            onBlur={(event) =>
                              sendPreviewAction({
                                action: "update-questions-card",
                                productId: selectedProduct.id,
                                patch: { title: event.target.value },
                              })
                            }
                            className="h-8 w-full rounded border px-2 text-sm"
                            placeholder="Titel vragenkaart"
                          />
                          <input
                            defaultValue={activeSpecs.questionsCard?.subtitle || ""}
                            onBlur={(event) =>
                              sendPreviewAction({
                                action: "update-questions-card",
                                productId: selectedProduct.id,
                                patch: { subtitle: event.target.value },
                              })
                            }
                            className="h-8 w-full rounded border px-2 text-xs"
                            placeholder="Subtitel"
                          />
                        </div>
                      ) : activeSpecs.questionsCard?.title ? (
                        <div className="rounded-md border border-[#eadfca] bg-[#fbf6ea] px-3 py-2">
                          <p className="text-sm font-semibold text-[#5e584b]">{activeSpecs.questionsCard.title}</p>
                          {activeSpecs.questionsCard.subtitle ? (
                            <p className="mt-1 text-xs text-[#7a7466]">{activeSpecs.questionsCard.subtitle}</p>
                          ) : null}
                        </div>
                      ) : null}

                      {(isPreviewRoute ? (activeSpecs.questions || []) : visibleQuestions).length > 0 ? (
                        <div className="space-y-2">
                          {(isPreviewRoute ? (activeSpecs.questions || []) : visibleQuestions).map((question, questionIndex) => (
                            <div key={`${question.key}-${questionIndex}`} className="rounded-md border border-[#e3e4e8] bg-[#f9f8f4] p-2">
                              {isPreviewRoute ? (
                                <div className="space-y-2">
                                  <div className="grid gap-2 sm:grid-cols-[1fr_126px_80px_auto]">
                                    <input
                                      defaultValue={question.label}
                                      onBlur={(event) =>
                                        sendPreviewAction({
                                          action: "update-question",
                                          productId: selectedProduct.id,
                                          targetKey: question.key,
                                          patch: { label: event.target.value },
                                        })
                                      }
                                      className="h-8 rounded border px-2 text-xs"
                                      placeholder="Vraag"
                                    />
                                    <select
                                      defaultValue={question.type}
                                      onChange={(event) =>
                                        sendPreviewAction({
                                          action: "update-question",
                                          productId: selectedProduct.id,
                                          targetKey: question.key,
                                          patch: { type: event.target.value },
                                        })
                                      }
                                      className="h-8 rounded border px-2 text-xs"
                                    >
                                      <option value="text">Tekst</option>
                                      <option value="select">Dropdown</option>
                                      <option value="checkbox">Checkbox</option>
                                    </select>
                                    <label className="flex items-center gap-1 rounded border px-2 text-[11px]">
                                      <input
                                        type="checkbox"
                                        defaultChecked={Boolean(question.required)}
                                        onChange={(event) =>
                                          sendPreviewAction({
                                            action: "update-question",
                                            productId: selectedProduct.id,
                                            targetKey: question.key,
                                            patch: { required: event.target.checked },
                                          })
                                        }
                                      />
                                      Verplicht
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        sendPreviewAction({
                                          action: "remove-question",
                                          productId: selectedProduct.id,
                                          targetKey: question.key,
                                        })
                                      }
                                      className="rounded border px-2 py-1 text-[11px]"
                                    >
                                      Verwijder
                                    </button>
                                  </div>

                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <select
                                      defaultValue={question.showWhenPackageKey || ""}
                                      onChange={(event) =>
                                        sendPreviewAction({
                                          action: "update-question",
                                          productId: selectedProduct.id,
                                          targetKey: question.key,
                                          patch: { showWhenPackageKey: event.target.value },
                                        })
                                      }
                                      className="h-8 rounded border px-2 text-xs"
                                    >
                                      <option value="">Toon altijd (pakket)</option>
                                      {(activeSpecs.packages || []).map((pkg) => (
                                        <option key={`${question.key}-pkg-${pkg.key}`} value={pkg.key}>
                                          Alleen bij pakket: {pkg.label}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      defaultValue={question.showWhenOptionKey || ""}
                                      onChange={(event) =>
                                        sendPreviewAction({
                                          action: "update-question",
                                          productId: selectedProduct.id,
                                          targetKey: question.key,
                                          patch: { showWhenOptionKey: event.target.value },
                                        })
                                      }
                                      className="h-8 rounded border px-2 text-xs"
                                    >
                                      <option value="">Toon altijd (optie)</option>
                                      {(activeSpecs.optionSections || [])
                                        .flatMap((section) => section.options)
                                        .map((option) => (
                                          <option key={`${question.key}-opt-${option.key}`} value={option.key}>
                                            Alleen bij optie: {option.label}
                                          </option>
                                        ))}
                                    </select>
                                  </div>

                                  {question.type === "select" ? (
                                    <div className="space-y-1">
                                      {(question.options || []).map((optionValue, optionIndex) => (
                                        <div key={`${question.key}-option-${optionIndex}`} className="flex items-center gap-1">
                                          <input
                                            defaultValue={optionValue}
                                            onBlur={(event) =>
                                              sendPreviewAction({
                                                action: "update-question-option",
                                                productId: selectedProduct.id,
                                                targetKey: question.key,
                                                optionIndex,
                                                value: event.target.value,
                                              })
                                            }
                                            className="h-7 w-full rounded border px-2 text-xs"
                                            placeholder="Keuze"
                                          />
                                          <button
                                            type="button"
                                            onClick={() =>
                                              sendPreviewAction({
                                                action: "remove-question-option",
                                                productId: selectedProduct.id,
                                                targetKey: question.key,
                                                optionIndex,
                                              })
                                            }
                                            className="rounded border px-1.5 py-0.5 text-[10px]"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ))}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          sendPreviewAction({
                                            action: "add-question-option",
                                            productId: selectedProduct.id,
                                            targetKey: question.key,
                                          })
                                        }
                                        className="rounded border px-2 py-1 text-[10px] font-semibold"
                                        style={{ borderColor: `${accentColor}80` }}
                                      >
                                        + Keuze
                                      </button>
                                    </div>
                                  ) : null}

                                  {question.type === "text" ? (
                                    <input
                                      defaultValue={question.placeholder || ""}
                                      onBlur={(event) =>
                                        sendPreviewAction({
                                          action: "update-question",
                                          productId: selectedProduct.id,
                                          targetKey: question.key,
                                          patch: { placeholder: event.target.value },
                                        })
                                      }
                                      className="h-7 w-full rounded border px-2 text-xs"
                                      placeholder="Placeholder"
                                    />
                                  ) : null}

                                  {question.type === "checkbox" ? (
                                    <input
                                      defaultValue={question.helpText || ""}
                                      onBlur={(event) =>
                                        sendPreviewAction({
                                          action: "update-question",
                                          productId: selectedProduct.id,
                                          targetKey: question.key,
                                          patch: { helpText: event.target.value },
                                        })
                                      }
                                      className="h-7 w-full rounded border px-2 text-xs"
                                      placeholder="Helptekst bij checkbox"
                                    />
                                  ) : null}
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <p className="text-xs font-semibold text-[#5e584b]">
                                    {question.label}
                                    {question.required ? " *" : ""}
                                  </p>
                                  {question.type === "select" ? (
                                    <select
                                      value={String(getQuestionAnswer(question))}
                                      onChange={(event) => updateQuestionAnswer(question, event.target.value)}
                                      className="h-9 w-full rounded border border-[#d8dbe2] bg-white px-2 text-sm"
                                    >
                                      <option value="">Selecteer...</option>
                                      {(question.options || []).map((optionValue) => (
                                        <option key={`${question.key}-${optionValue}`} value={optionValue}>
                                          {optionValue}
                                        </option>
                                      ))}
                                    </select>
                                  ) : null}
                                  {question.type === "text" ? (
                                    <input
                                      value={String(getQuestionAnswer(question))}
                                      onChange={(event) => updateQuestionAnswer(question, event.target.value)}
                                      className="h-9 w-full rounded border border-[#d8dbe2] px-2 text-sm"
                                      placeholder={question.placeholder || "Uw antwoord..."}
                                    />
                                  ) : null}
                                  {question.type === "checkbox" ? (
                                    <label className="inline-flex items-center gap-2 text-xs text-[#676d78]">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(getQuestionAnswer(question))}
                                        onChange={(event) => updateQuestionAnswer(question, event.target.checked)}
                                      />
                                      {question.helpText || "Ja"}
                                    </label>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          ))}
                          {isPreviewRoute ? (
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  sendPreviewAction({
                                    action: "add-question",
                                    productId: selectedProduct.id,
                                    questionType: "select",
                                  })
                                }
                                className="rounded border px-2 py-1 text-[11px] font-semibold"
                                style={{ borderColor: `${accentColor}80` }}
                              >
                                + Dropdown vraag
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  sendPreviewAction({
                                    action: "add-question",
                                    productId: selectedProduct.id,
                                    questionType: "checkbox",
                                  })
                                }
                                className="rounded border px-2 py-1 text-[11px] font-semibold"
                                style={{ borderColor: `${accentColor}80` }}
                              >
                                + Checkbox vraag
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  sendPreviewAction({
                                    action: "add-question",
                                    productId: selectedProduct.id,
                                    questionType: "text",
                                  })
                                }
                                className="rounded border px-2 py-1 text-[11px] font-semibold"
                                style={{ borderColor: `${accentColor}80` }}
                              >
                                + Tekstvraag
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : isPreviewRoute ? (
                        <button
                          type="button"
                          onClick={() =>
                            sendPreviewAction({
                              action: "add-question",
                              productId: selectedProduct.id,
                              questionType: "text",
                            })
                          }
                          className="rounded border border-dashed px-2 py-1 text-[11px] font-semibold"
                          style={{ borderColor: `${accentColor}80` }}
                        >
                          + Eerste vraag toevoegen
                        </button>
                      ) : null}

                      {isAdvancedMode ? (
                        <>
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#6f7580]">Korting toepassen</p>
                          <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
                            <div className="flex rounded-lg border border-[#d8dbe2] p-1">
                              <button
                                type="button"
                                onClick={() => setDiscountMode("amount")}
                                className="h-8 flex-1 rounded text-xs font-semibold"
                                style={{ backgroundColor: discountMode === "amount" ? accentColor : "transparent", color: discountMode === "amount" ? darkColor : "#6f7580" }}
                              >
                                Bedrag
                              </button>
                              <button
                                type="button"
                                onClick={() => setDiscountMode("percent")}
                                className="h-8 flex-1 rounded text-xs font-semibold"
                                style={{ backgroundColor: discountMode === "percent" ? accentColor : "transparent", color: discountMode === "percent" ? darkColor : "#6f7580" }}
                              >
                                %
                              </button>
                            </div>
                            <input
                              value={discountInput}
                              onChange={(event) => setDiscountInput(event.target.value)}
                              className="h-9 sm:h-10 rounded-lg border border-[#d8dbe2] px-3 text-sm"
                              placeholder={discountMode === "percent" ? "0" : "0,00"}
                            />
                          </div>

                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6f7580]">BTW-tarief</p>
                            <div className="flex flex-wrap gap-2">
                              {[21, 6, 0].map((rate) => (
                                <button
                                  key={rate}
                                  type="button"
                                  onClick={() => setVatRate(rate)}
                                  className="rounded-md border px-3 py-1.5 text-xs font-semibold"
                                  style={{
                                    borderColor: vatRate === rate ? accentColor : "#d8dbe2",
                                    backgroundColor: vatRate === rate ? `${accentColor}2a` : "#fff",
                                    color: vatRate === rate ? "#8b5d12" : "#676d78",
                                  }}
                                >
                                  {rate}%
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-[#7a808a]">
                          Simpele modus gebruikt standaard 21% BTW en geen handmatige korting.
                        </p>
                      )}

                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6f7580]">Opmerkingen / bijzonderheden</p>
                        <textarea
                          value={specNotes}
                          onChange={(event) => setSpecNotes(event.target.value)}
                          rows={3}
                          className="w-full rounded-lg border border-[#d8dbe2] px-3 py-2 text-sm"
                          placeholder={activeSpecs.notesPlaceholder || "Extra info, specifieke wensen of vragen..."}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-[#7a808a]">Selecteer eerst een product in stap 2.</div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={prevStep} className="rounded-xl border px-3 py-2 text-xs text-[#616671] sm:px-4 sm:text-sm">
                    Terug
                  </button>
                  {!isPreviewRoute ? (
                    <button
                      type="button"
                      onClick={confirmCurrentProduct}
                      disabled={!selectedProduct || !cart[selectedProduct.id]}
                      className="rounded-xl border px-3 py-2 text-xs font-semibold sm:px-4 sm:text-sm disabled:opacity-50"
                      style={{
                        borderColor: currentProductConfirmed ? "#1f8a52" : accentColor,
                        color: currentProductConfirmed ? "#1f8a52" : darkColor,
                        backgroundColor: currentProductConfirmed ? "#e8f7ee" : `${accentColor}1a`,
                      }}
                    >
                      {currentProductConfirmed ? "Toegevoegd aan offerte" : "Toevoegen aan offerte"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={nextStep}
                    disabled={!stepReady[3]}
                    className="rounded-xl px-3 py-2 text-xs font-semibold text-[#15171c] disabled:opacity-50 sm:px-4 sm:text-sm"
                    style={{ backgroundColor: accentColor }}
                  >
                    Naar gegevens
                  </button>
                </div>
                {!requiredQuestionsComplete ? (
                  <p className="text-xs text-[#b15f1b]">
                    Vul eerst alle verplichte vragen in om verder te gaan.
                  </p>
                ) : null}
                {!hasConfirmedProducts && !isPreviewRoute ? (
                  <p className="text-xs text-[#b15f1b]">
                    Klik op "Toevoegen aan offerte" om minstens 1 product te bevestigen.
                  </p>
                ) : null}
              </div>
            ) : null}

            {currentStep === 4 ? (
              <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
                <div>
                  <h2 className="text-[22px] font-black leading-tight tracking-tight sm:text-[27px] lg:text-[32px]" style={{ color: darkColor }}>
                    {settings.detailsTitle}
                  </h2>
                  <p className="mt-2 text-sm text-[#6e747e]">{settings.stepDetailsHint || "Voor uw persoonlijke offerte op maat"}</p>
                </div>

                <div className="rounded-[12px] border border-[#ece1c6] bg-[#f8f4e8] px-3 py-2 text-sm text-[#7c6a42]">
                  Bijna klaar! Vul uw gegevens in om de gepersonaliseerde offerte te ontvangen.
                </div>

                <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#646b76]">Voornaam *</label>
                    <input value={firstName} onChange={(event) => setFirstName(event.target.value)} className="h-9 w-full rounded-lg border border-[#d8dbe2] px-3 text-sm sm:h-10" required={!isInternalMode} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#646b76]">
                      Achternaam {isInternalMode ? "" : "*"}
                    </label>
                    <input value={lastName} onChange={(event) => setLastName(event.target.value)} className="h-9 w-full rounded-lg border border-[#d8dbe2] px-3 text-sm sm:h-10" required={!isInternalMode} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#646b76]">E-mailadres *</label>
                    <input value={email} onChange={(event) => setEmail(event.target.value)} className="h-9 w-full rounded-lg border border-[#d8dbe2] px-3 text-sm sm:h-10" type="email" required />
                    {email && !isValidEmail(email) ? <p className="mt-1 text-xs text-red-600">Ongeldig e-mailadres.</p> : null}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#646b76]">Telefoonnummer</label>
                    <input value={phone} onChange={(event) => setPhone(event.target.value)} className="h-9 w-full rounded-lg border border-[#d8dbe2] px-3 text-sm sm:h-10" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#646b76]">Bedrijfsnaam</label>
                    <input value={company} onChange={(event) => setCompany(event.target.value)} className="h-9 w-full rounded-lg border border-[#d8dbe2] px-3 text-sm sm:h-10" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#646b76]">Adres</label>
                    <input value={address} onChange={(event) => setAddress(event.target.value)} className="h-9 w-full rounded-lg border border-[#d8dbe2] px-3 text-sm sm:h-10" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#646b76]">BTW-nummer</label>
                    <input value={vatNumber} onChange={(event) => setVatNumber(event.target.value)} className="h-9 w-full rounded-lg border border-[#d8dbe2] px-3 text-sm sm:h-10" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#646b76]">Bijkomende opmerkingen</label>
                    <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={3} className="w-full rounded-lg border border-[#d8dbe2] px-3 py-2 text-sm" />
                  </div>
                </div>

                {status ? (
                  <div className={`rounded-lg px-3 py-2 text-sm ${status.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {status.message}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={prevStep} className="rounded-xl border px-3 py-2 text-xs text-[#616671] sm:px-4 sm:text-sm">
                    Terug
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !stepReady[4]}
                    className="rounded-xl px-3 py-2 text-xs font-semibold text-[#15171c] disabled:opacity-50 sm:px-4 sm:text-sm"
                    style={{ backgroundColor: accentColor }}
                  >
                    {isLivePreview ? "Preview (niet versturen)" : submitting ? "Bezig..." : settings.ctaLabel}
                  </button>
                </div>
              </form>
            ) : null}
          </section>

          <aside className="min-h-0 overflow-y-auto bg-[#f4f1e8] px-3 py-3 sm:px-4">
            <div className="rounded-[14px] border border-black/10 bg-white shadow-sm">
              <div className="rounded-t-[14px] px-3 py-2 text-xs font-semibold text-white" style={{ background: `linear-gradient(135deg, ${darkColor} 0%, #1f2228 100%)` }}>
                Offerte-items ({cartItems.length}) {isPreviewRoute ? "" : `· ${Object.keys(confirmedProducts).length} bevestigd`}
              </div>
              <div className="max-h-[34vh] space-y-1 overflow-auto p-1.5">
                {cartItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-3 text-xs text-[#767c87]">Nog geen items geselecteerd.</div>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.cartKey} className="rounded-lg border bg-white px-2 py-1.5">
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold">{item.name}</p>
                          <p className="truncate text-[11px] text-[#7b818c]">
                            {item.packageLabel} · {item.quantity}x
                            {item.source === "product" && !isPreviewRoute && !confirmedProducts[item.cartKey]
                              ? " · niet bevestigd"
                              : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <button type="button" onClick={() => removeFromCart(item.cartKey)} className="text-[11px] text-[#8a909b] hover:text-[#272a30]">✕</button>
                          <p className="mt-0.5 text-xs font-semibold" style={{ color: "#c9811b" }}>{formatCurrency(item.total)}</p>
                        </div>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] text-[#7b818c]">
                          {item.quantity > 1 ? `${formatCurrency(item.unitPrice)} / stuk` : formatCurrency(item.unitPrice)}
                        </span>
                        {(item.source === "product" || payload.editingQuote) ? (
                          <div className="flex items-center overflow-hidden rounded-md border">
                            <button type="button" onClick={() => adjustQuantity(item.cartKey, -1)} className="h-5 w-6 text-xs">-</button>
                            <span className="min-w-6 border-x px-1 text-center text-[11px]">{item.quantity}</span>
                            <button type="button" onClick={() => adjustQuantity(item.cartKey, 1)} className="h-5 w-6 text-xs">+</button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex items-center justify-between border-t px-3 py-2 text-xs font-semibold">
                <span>Totaal incl. BTW</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="mt-3 rounded-[14px] border border-black/10 bg-white p-3 text-sm">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-[#7d838d]">
                <span>Categorie</span>
                <span className="font-semibold text-[#3c4149] normal-case">{selectedCategory || "-"}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs uppercase tracking-wide text-[#7d838d]">
                <span>Product</span>
                <span className="font-semibold text-[#3c4149] normal-case">{selectedProduct?.name || "-"}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs uppercase tracking-wide text-[#7d838d]">
                <span>Aantal in cart</span>
                <span className="font-semibold text-[#3c4149]">{cartItems.length}</span>
              </div>
              {!isPreviewRoute ? (
                <div className="mt-2 flex items-center justify-between text-xs uppercase tracking-wide text-[#7d838d]">
                  <span>Bevestigd</span>
                  <span className="font-semibold text-[#3c4149]">
                    {Object.keys(confirmedProducts).length}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="mt-3 overflow-hidden rounded-[14px] border border-black/10 bg-white text-sm">
              <div className="space-y-2 px-3 py-3">
                <div className="flex items-center justify-between"><span>Subtotaal excl. BTW</span><span className="font-semibold">{formatCurrency(subtotal)}</span></div>
                {discount > 0 ? (
                  <div className="flex items-center justify-between text-[#b15f1b]"><span>Korting</span><span className="font-semibold">-{formatCurrency(discount)}</span></div>
                ) : null}
                <div className="flex items-center justify-between"><span>BTW {vatRate}%</span><span className="font-semibold">{formatCurrency(vatAmount)}</span></div>
              </div>
              <div className="px-3 py-3 text-sm font-semibold text-white" style={{ background: `linear-gradient(135deg, ${darkColor} 0%, #1f2228 100%)` }}>
                Totaal incl. BTW <span className="float-right" style={{ color: accentColor }}>{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="mt-3 rounded-[14px] border border-[#e8dcc4] bg-[#f7f0df] px-3 py-3 text-xs text-[#6f6655]">
              <p className="font-semibold text-[#3f3b33]">Indicatieve prijs - Definitieve offerte op aanvraag</p>
              <p className="mt-1">{settings.disclaimer}</p>
            </div>
          </aside>
        </div>

        <footer className="px-4 py-3 text-xs text-white" style={{ background: `linear-gradient(135deg, ${darkColor} 0%, #1f2228 100%)` }}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 opacity-90">
            <span>{companyName} - {companyTagline}</span>
            <span>{settings.footerContact}</span>
            <span>{settings.footerPhone}</span>
            <span>{settings.footerWebsite}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function QuoteEmbedPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <QuoteEmbedFallback />;

  return <QuoteConfigurator mode="public" />;
}
