import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { resolvePublicTenantUserId } from "@digitify/api/src/lib/public-tenant";
import { log } from "@digitify/api/src/lib/logger";
import { enforceRateLimit, getClientIp } from "@/lib/http-security";
import {
  buildFallbackSpecs,
  parseProductSpecs,
  resolveProductSpecs,
  type QuoteConfiguratorService,
} from "@/lib/quote-configurator-specs";

function userSettingKey(userId: string, key: string) {
  return `user:${userId}:${key.trim()}`;
}

function readSettingValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.replace(/^"|"$/g, "");
  return String(value);
}

function parseCartKey(cartKey: string, prefix: string) {
  const parts = cartKey.split(":");
  if (parts[0] !== prefix || parts.length < 3) return "";
  return parts.slice(2).join(":");
}

function normalizePublicQuoteItems(params: {
  items: any[];
  services: QuoteConfiguratorService[];
  productSpecsJson: string;
}) {
  const specsMap = parseProductSpecs(params.productSpecsJson);
  const servicesById = new Map(params.services.map((service) => [service.id, service]));

  return params.items
    .map((item: any, index: number) => {
      const serviceId = String(item.serviceId || "").trim();
      const service = servicesById.get(serviceId);
      if (!service) return null;

      const cartKey = String(item.cartKey || "");
      const source = ["product", "option", "slider"].includes(String(item.source))
        ? String(item.source)
        : "product";
      const siblingExtras = params.services.filter(
        (candidate) => candidate.category === service.category && candidate.id !== service.id,
      );
      const specs = resolveProductSpecs(service, specsMap) || buildFallbackSpecs(service, siblingExtras);
      const quantity = Math.max(1, Math.min(1000, Number(item.quantity || 1)));

      if (source === "option") {
        const optionKey = String(item.optionKey || parseCartKey(cartKey, "opt")).trim();
        const option = (specs.optionSections || [])
          .flatMap((section) => section.options)
          .find((candidate) => candidate.key === optionKey);
        if (!option) return null;
        const optionQuantity = Math.max(1, option.quantity || quantity);
        return {
          category: service.category,
          name: option.label,
          description: option.description || null,
          quantity: optionQuantity,
          unitPrice: option.price,
          total: optionQuantity * option.price,
          sortOrder: index,
        };
      }

      if (source === "slider") {
        const sliderKey = String(item.sliderKey || parseCartKey(cartKey, "sld")).trim();
        const slider = (specs.sliders || []).find((candidate) => candidate.key === sliderKey);
        if (!slider) return null;
        const rawValue = Number(item.variableValue);
        if (!Number.isFinite(rawValue)) return null;
        const value = Math.min(slider.max, Math.max(slider.min, rawValue));
        const chargedUnits = Math.max(0, value - (slider.included || 0));
        const unitPrice = Math.round(chargedUnits * (slider.pricePerUnit || 0) * 100) / 100;
        if (unitPrice <= 0) return null;
        return {
          category: service.category,
          name: `${slider.label} (${value}${slider.unitLabel || ""})`,
          description: slider.hint || "Variabele kost",
          quantity: 1,
          unitPrice,
          total: unitPrice,
          sortOrder: index,
        };
      }

      const requestedPackageKey = String(item.packageKey || "").trim();
      const fallbackPackage = (specs.packages || []).find((pkg) => pkg.defaultSelected) || specs.packages?.[0];
      const selectedPackage =
        (specs.packages || []).find((pkg) => pkg.key === requestedPackageKey) || fallbackPackage;
      const unitPrice = selectedPackage?.price ?? service.basePrice;
      const packageLabel = selectedPackage?.label ? ` - ${selectedPackage.label}` : "";
      return {
        category: service.category,
        name: `${service.name}${packageLabel}`,
        description: selectedPackage?.subtitle || service.description || null,
        quantity,
        unitPrice,
        total: quantity * unitPrice,
        sortOrder: index,
      };
    })
    .filter(Boolean) as Array<{
      category: string;
      name: string;
      description: string | null;
      quantity: number;
      unitPrice: number;
      total: number;
      sortOrder: number;
    }>;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantUserId = await resolvePublicTenantUserId(prisma, String(body.tenant || ""));
    if (!tenantUserId) {
      log.security.warn("Public quote request rejected: invalid tenant token");
      return NextResponse.json({ error: "Ongeldige tenant." }, { status: 400 });
    }

    const ip = getClientIp(request);
    const burstLimiter = await enforceRateLimit(request, {
      key: `public-quote-burst:${tenantUserId}:${ip}`,
      limit: 3,
      windowMs: 60_000,
      message: "Te veel aanvragen. Wacht even en probeer opnieuw.",
    });
    if (burstLimiter) return burstLimiter;
    const hourlyLimiter = await enforceRateLimit(request, {
      key: `public-quote:${tenantUserId}:${ip}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
      message: "Te veel aanvragen. Probeer het later opnieuw.",
    });
    if (hourlyLimiter) return hourlyLimiter;
    const clientName = String(body.clientName || "").trim().slice(0, 200);
    const clientAddress = String(body.clientAddress || "").trim().slice(0, 500);
    const clientVat = String(body.clientVat || "").trim().slice(0, 50);
    const clientEmail = String(body.clientEmail || "").trim().slice(0, 254);
    const clientCompany = String(body.clientCompany || "").trim().slice(0, 200);
    const clientPhone = String(body.clientPhone || "").trim().slice(0, 50);
    const notes = String(body.notes || "").trim().slice(0, 2000);
    const items = Array.isArray(body.items) ? body.items.slice(0, 50) : [];

    if (!clientName || !items.length) {
      return NextResponse.json(
        { error: "Naam en minstens één dienst zijn verplicht." },
        { status: 400 }
      );
    }

    if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      return NextResponse.json({ error: "Ongeldig e-mailadres." }, { status: 400 });
    }

    const year = new Date().getFullYear();
    const numberPrefix = `OFF-${year}-${tenantUserId.slice(-4).toUpperCase()}-`;
    const count = await prisma.quote.count({
      where: { createdById: tenantUserId, quoteNumber: { startsWith: numberPrefix } },
    });
    const quoteNumber = `${numberPrefix}${String(count + 1).padStart(4, "0")}`;

    const [services, productSpecsRow] = await Promise.all([
      prisma.serviceCatalog.findMany({
        where: { isActive: true, createdById: tenantUserId },
        select: {
          id: true,
          category: true,
          name: true,
          description: true,
          basePrice: true,
          unit: true,
        },
      }),
      prisma.setting.findUnique({
        where: { key: userSettingKey(tenantUserId, "quotes.embed_product_specs_json") },
        select: { value: true },
      }),
    ]);

    const normalizedItems = normalizePublicQuoteItems({
      items,
      services,
      productSpecsJson: readSettingValue(productSpecsRow?.value),
    });

    if (!normalizedItems.length) {
      return NextResponse.json(
        { error: "Minstens één geldige dienst is verplicht." },
        { status: 400 },
      );
    }

    const subtotal = normalizedItems.reduce(
      (sum: number, item: { total: number }) => sum + item.total,
      0
    );
    const discount = 0;
    const vatRate = 21;
    const discountedSubtotal = subtotal - discount;
    const vatAmount = Math.round(discountedSubtotal * (vatRate / 100) * 100) / 100;
    const total = discountedSubtotal + vatAmount;

    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        clientName,
        clientEmail: clientEmail || null,
        clientCompany: clientCompany || null,
        clientPhone: clientPhone || null,
        clientAddress: clientAddress || null,
        clientVat: clientVat || null,
        status: "DRAFT",
        notes: notes || "Aangemaakt via publieke offerte-configurator.",
        subtotal,
        vatRate,
        discount,
        vatAmount,
        total,
        createdById: tenantUserId,
        items: {
          create: normalizedItems,
        },
      },
      select: { id: true, quoteNumber: true },
    });

    return NextResponse.json({
      success: true,
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      message: "De aanvraag is opgeslagen en wacht op interne goedkeuring.",
    });
  } catch (error) {
    log.api.error("Public quote request failed", {
      route: "/api/public/quotes/request",
    }, error);
    return NextResponse.json(
      { error: "Offerteaanvraag opslaan mislukt." },
      { status: 500 }
    );
  }
}
