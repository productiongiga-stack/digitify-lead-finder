import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { resolveUserIdFromPublicTenantToken } from "@digitify/api/src/lib/public-tenant";
import { log } from "@digitify/api/src/lib/logger";
import { enforceRateLimit, getClientIp } from "@/lib/http-security";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantUserId = await resolveUserIdFromPublicTenantToken(prisma, String(body.tenant || ""));
    if (!tenantUserId) {
      log.security.warn("Public quote request rejected: invalid tenant token");
      return NextResponse.json({ error: "Ongeldige tenant." }, { status: 400 });
    }

    const ip = getClientIp(request);
    const burstLimiter = enforceRateLimit(request, {
      key: `public-quote-burst:${tenantUserId}:${ip}`,
      limit: 3,
      windowMs: 60_000,
      message: "Te veel aanvragen. Wacht even en probeer opnieuw.",
    });
    if (burstLimiter) return burstLimiter;
    const hourlyLimiter = enforceRateLimit(request, {
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
    const discountRaw = Number(body.discount || 0);
    const vatRateRaw = Number(body.vatRate || 21);
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

    const normalizedItems = items
      .map((item: any, index: number) => {
        const quantity = Math.max(1, Number(item.quantity || 1));
        const unitPrice = Math.max(0, Number(item.unitPrice || 0));
        return {
          category: String(item.category || "extras"),
          name: String(item.name || "").trim(),
          description: String(item.description || "").trim() || null,
          quantity,
          unitPrice,
          total: quantity * unitPrice,
          sortOrder: index,
        };
      })
      .filter((item: { name: string }) => item.name);

    const subtotal = normalizedItems.reduce(
      (sum: number, item: { total: number }) => sum + item.total,
      0
    );
    const discount = Math.max(0, Math.min(subtotal, Number.isFinite(discountRaw) ? discountRaw : 0));
    const vatRate = Math.max(0, Number.isFinite(vatRateRaw) ? vatRateRaw : 21);
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
