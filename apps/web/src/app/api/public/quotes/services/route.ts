import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { resolvePublicTenantUserId } from "@digitify/api/src/lib/public-tenant";
import { log } from "@digitify/api/src/lib/logger";
import { enforceRateLimit, getClientIp } from "@/lib/http-security";

function userSettingKey(userId: string, key: string) {
  return `user:${userId}:${key.trim()}`;
}

export async function GET(request: Request) {
  const tenantUserId = await resolvePublicTenantUserId(
    prisma,
    new URL(request.url).searchParams.get("tenant"),
  );
  if (!tenantUserId) {
    log.security.warn("Public quote services rejected: invalid tenant token");
    return NextResponse.json({ error: "Ongeldige tenant." }, { status: 400 });
  }
  const ip = getClientIp(request);
  const limiter = await enforceRateLimit(request, {
    key: `public-quote-services:${tenantUserId}:${ip}`,
    limit: 180,
    windowMs: 60 * 60 * 1000,
    message: "Te veel aanvragen. Probeer later opnieuw.",
  });
  if (limiter) return limiter;

  const [services, settings] = await Promise.all([
    prisma.serviceCatalog.findMany({
      where: { isActive: true, createdById: tenantUserId },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.setting.findMany({
      where: {
        key: {
          in: [
            "quotes.embed_title",
            "quotes.embed_description",
            "quotes.embed_color",
            "quotes.embed_badge",
            "quotes.embed_disclaimer",
            "quotes.embed_cta_label",
            "quotes.embed_mode",
            "quotes.embed_dark_color",
            "quotes.embed_bg_color",
            "quotes.embed_company_name",
            "quotes.embed_company_tagline",
            "quotes.embed_logo_url",
            "quotes.embed_footer_contact",
            "quotes.embed_footer_phone",
            "quotes.embed_footer_website",
            "quotes.embed_step_service_label",
            "quotes.embed_step_product_label",
            "quotes.embed_step_specs_label",
            "quotes.embed_step_details_label",
            "quotes.embed_step_service_hint",
            "quotes.embed_step_product_hint",
            "quotes.embed_step_specs_hint",
            "quotes.embed_step_details_hint",
            "quotes.embed_service_title",
            "quotes.embed_product_title",
            "quotes.embed_specs_title",
            "quotes.embed_details_title",
            "quotes.embed_product_specs_json",
            "quotes.embed_category_icons_json",
            "quotes.embed_product_icons_json",
          ].map((key) => userSettingKey(tenantUserId, key)),
        },
      },
    }),
  ]);

  const map = Object.fromEntries(
    settings.map((item) => [
      item.key.replace(`user:${tenantUserId}:`, ""),
      String(item.value).replace(/^"|"$/g, ""),
    ])
  );

  return NextResponse.json({
    settings: {
      title: map["quotes.embed_title"] || "Stel uw pakket samen",
      description:
        map["quotes.embed_description"] ||
        "Kies de diensten die voor uw bedrijf relevant zijn en vraag daarna een offerte op maat aan.",
      color: map["quotes.embed_color"] || "#f59e0b",
      badge: map["quotes.embed_badge"] || "Offerte Configurator",
      disclaimer:
        map["quotes.embed_disclaimer"] ||
        "Niets wordt automatisch verstuurd. Uw aanvraag komt eerst intern binnen voor goedkeuring.",
      ctaLabel: map["quotes.embed_cta_label"] || "Vraag offerte aan",
      embedMode: map["quotes.embed_mode"] === "advanced" ? "advanced" : "simple",
      darkColor: map["quotes.embed_dark_color"] || "#14171d",
      bgColor: map["quotes.embed_bg_color"] || "#f3f2ec",
      companyName: map["quotes.embed_company_name"] || "Digitify",
      companyTagline: map["quotes.embed_company_tagline"] || "Partner in Digital Solutions",
      logoUrl: map["quotes.embed_logo_url"] || "",
      footerContact: map["quotes.embed_footer_contact"] || "contact@digitify.be",
      footerPhone: map["quotes.embed_footer_phone"] || "+32 (0) 486 51 57 73",
      footerWebsite: map["quotes.embed_footer_website"] || "www.digitify.be",
      stepServiceLabel: map["quotes.embed_step_service_label"] || "DIENST",
      stepProductLabel: map["quotes.embed_step_product_label"] || "PRODUCT",
      stepSpecsLabel: map["quotes.embed_step_specs_label"] || "SPECIFICATIES",
      stepDetailsLabel: map["quotes.embed_step_details_label"] || "GEGEVENS",
      stepServiceHint:
        map["quotes.embed_step_service_hint"] ||
        "Selecteer eerst een categorie met de dienst die u nodig hebt.",
      stepProductHint:
        map["quotes.embed_step_product_hint"] ||
        "Kies daarna exact welk product binnen die categorie past.",
      stepSpecsHint:
        map["quotes.embed_step_specs_hint"] ||
        "Configureer uw pakket, opties en eventuele variabele parameters.",
      stepDetailsHint:
        map["quotes.embed_step_details_hint"] ||
        "Vul tenslotte uw gegevens in om de offerteaanvraag te versturen.",
      serviceTitle: map["quotes.embed_service_title"] || "Welke dienst zoekt u?",
      productTitle: map["quotes.embed_product_title"] || "Kies uw product",
      specsTitle: map["quotes.embed_specs_title"] || "Specificaties",
      detailsTitle: map["quotes.embed_details_title"] || "Uw gegevens",
      productSpecsJson: map["quotes.embed_product_specs_json"] || "{}",
      categoryIconsJson: map["quotes.embed_category_icons_json"] || "{}",
      productIconsJson: map["quotes.embed_product_icons_json"] || "{}",
    },
    services,
  });
}
