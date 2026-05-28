import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { getCurrentUser, workspaceIdFor } from "@/lib/auth/session";

function userSettingKey(userId: string, key: string) {
  return `user:${userId}:${key.trim()}`;
}

function readSettingValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.replace(/^"|"$/g, "");
  return String(value);
}

const QUOTE_CONFIG_SETTING_KEYS = [
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
  "quotes.embed_icon_library_json",
];

function splitName(value: string | null | undefined) {
  const parts = (value || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1) || "" };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Niet aangemeld." }, { status: 401 });
  }

  const url = new URL(request.url);
  const leadId = url.searchParams.get("leadId")?.trim() || "";
  const chatSessionId = url.searchParams.get("chatSessionId")?.trim() || "";
  const quoteId = url.searchParams.get("quoteId")?.trim() || "";

  const workspaceId = workspaceIdFor(user);
  const [services, settings, lead, chatSession, editingQuote] = await Promise.all([
    prisma.serviceCatalog.findMany({
      where: { isActive: true, createdById: workspaceId },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.setting.findMany({
      where: {
        key: {
          in: QUOTE_CONFIG_SETTING_KEYS.map((key) => userSettingKey(user.id, key)),
        },
      },
    }),
    leadId
      ? prisma.lead.findFirst({
          where: { id: leadId, createdById: workspaceId },
          select: {
            id: true,
            companyName: true,
            email: true,
            phone: true,
            address: true,
            zipCode: true,
            city: true,
            country: true,
          },
        })
      : null,
    chatSessionId
      ? prisma.chatSession.findFirst({
          where: {
            id: chatSessionId,
            OR: [
              { lead: { createdById: workspaceId } },
              { assignedToId: user.id },
              { tags: { has: `tenant:${workspaceId}` } },
            ],
          },
          select: {
            id: true,
            leadId: true,
            visitorName: true,
            visitorEmail: true,
            visitorPhone: true,
            visitorCompany: true,
          },
        })
      : null,
    quoteId
      ? prisma.quote.findFirst({
          where: { id: quoteId, createdById: workspaceId },
          select: {
            id: true,
            quoteNumber: true,
            clientName: true,
            clientEmail: true,
            clientCompany: true,
            clientPhone: true,
            clientAddress: true,
            clientVat: true,
            notes: true,
            vatRate: true,
            discount: true,
            items: {
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                category: true,
                name: true,
                description: true,
                quantity: true,
                unitPrice: true,
              },
            },
          },
        })
      : null,
  ]);

  const map = Object.fromEntries(
    settings.map((item) => [
      item.key.replace(`user:${user.id}:`, ""),
      readSettingValue(item.value),
    ]),
  );

  const chatName = splitName(chatSession?.visitorName);
  const leadAddress = lead
    ? [lead.address, lead.zipCode, lead.city, lead.country].filter(Boolean).join(", ")
    : "";

  return NextResponse.json({
    settings: {
      title: map["quotes.embed_title"] || "Stel uw pakket samen",
      description:
        map["quotes.embed_description"] ||
        "Kies de diensten die voor uw bedrijf relevant zijn en maak daarna een offerte op maat aan.",
      color: map["quotes.embed_color"] || "#f59e0b",
      badge: map["quotes.embed_badge"] || "Offerte Configurator",
      disclaimer:
        map["quotes.embed_disclaimer"] ||
        "Interne flow: de offerte wordt als concept opgeslagen en kan daarna worden verstuurd.",
      ctaLabel: editingQuote ? "Offerte bijwerken" : map["quotes.embed_cta_label"] || "Offerte aanmaken",
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
        "Vul tenslotte de klantgegevens in om de offerte aan te maken.",
      serviceTitle: map["quotes.embed_service_title"] || "Welke dienst zoekt u?",
      productTitle: map["quotes.embed_product_title"] || "Kies uw product",
      specsTitle: map["quotes.embed_specs_title"] || "Specificaties",
      detailsTitle: map["quotes.embed_details_title"] || "Klantgegevens",
      productSpecsJson: map["quotes.embed_product_specs_json"] || "{}",
      categoryIconsJson: map["quotes.embed_category_icons_json"] || "{}",
      productIconsJson: map["quotes.embed_product_icons_json"] || "{}",
      iconLibraryJson: map["quotes.embed_icon_library_json"] || "[]",
    },
    editingQuote: editingQuote
      ? {
          ...editingQuote,
        }
      : undefined,
    prefill: lead
      ? {
          leadId: lead.id,
          firstName: lead.companyName,
          lastName: "",
          company: lead.companyName,
          email: lead.email,
          phone: lead.phone,
          address: leadAddress,
          vatNumber: "",
        }
      : chatSession
        ? {
            leadId: chatSession.leadId,
            chatSessionId: chatSession.id,
            firstName: chatName.firstName || chatSession.visitorCompany || "",
            lastName: chatName.lastName,
            company: chatSession.visitorCompany || "",
            email: chatSession.visitorEmail || "",
            phone: chatSession.visitorPhone || "",
            address: "",
            vatNumber: "",
          }
        : undefined,
    services,
  });
}
