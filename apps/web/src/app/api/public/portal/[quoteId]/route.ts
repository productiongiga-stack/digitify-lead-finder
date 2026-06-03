import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { verifyQuotePdfToken } from "@/lib/quote-pdf";
import { enforceRateLimit } from "@/lib/http-security";

function parseJson(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function loadPortalFiles(ownerId: string, quoteId: string) {
  const row = await prisma.setting.findUnique({
    where: { key: `user:${ownerId}:portal.files_json` },
    select: { value: true },
  });
  const parsed = parseJson(row?.value);
  const list = Array.isArray(parsed) ? parsed : [];
  return list.filter((item) => item && typeof item === "object" && item.quoteId === quoteId);
}

export async function GET(request: Request, { params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const limiter = await enforceRateLimit(request, {
    key: `public-portal-get:${quoteId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
    message: "Te veel portal-verzoeken. Probeer later opnieuw.",
  });
  if (limiter) return limiter;

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!verifyQuotePdfToken(quoteId, token)) {
    return NextResponse.json({ error: "Ongeldige of verlopen portal-link." }, { status: 403 });
  }

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!quote) return NextResponse.json({ error: "Offerte niet gevonden." }, { status: 404 });

  const files = await loadPortalFiles(quote.createdById, quote.id);
  const bookings = await prisma.booking.findMany({
    where: {
      createdById: quote.createdById,
      OR: [
        quote.clientEmail ? { clientEmail: { equals: quote.clientEmail, mode: "insensitive" } } : undefined,
        quote.clientName ? { clientName: { equals: quote.clientName, mode: "insensitive" } } : undefined,
      ].filter(Boolean) as any,
    },
    orderBy: { date: "desc" },
    take: 8,
    select: { id: true, date: true, duration: true, status: true, notes: true },
  });
  const settings = await prisma.setting.findMany({
    where: {
      key: `user:${quote.createdById}:branding.company_name`,
    },
    select: { value: true },
  });
  const companyNameSetting = settings[0]?.value;
  const companyName =
    typeof companyNameSetting === "string"
      ? companyNameSetting.replace(/^"|"$/g, "")
      : String(companyNameSetting || "Digitify");

  const bookingEmbedUrl = token
    ? `/embed/bookings?quotePortal=${encodeURIComponent(quoteId)}&portalToken=${encodeURIComponent(token)}`
    : null;

  return NextResponse.json({
    quote: {
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      status: quote.status,
      clientName: quote.clientName,
      clientCompany: quote.clientCompany,
      clientEmail: quote.clientEmail,
      total: quote.total,
      vatAmount: quote.vatAmount,
      vatRate: quote.vatRate,
      subtotal: quote.subtotal,
      validUntil: quote.validUntil,
      notes: quote.notes,
      terms: quote.terms,
      items: quote.items,
    },
    files,
    bookings,
    bookingEmbedUrl,
    companyName,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const burstLimiter = await enforceRateLimit(request, {
    key: `public-portal-post-burst:${quoteId}`,
    limit: 10,
    windowMs: 60_000,
    message: "Te veel portal-acties. Wacht even en probeer opnieuw.",
  });
  if (burstLimiter) return burstLimiter;
  const hourlyLimiter = await enforceRateLimit(request, {
    key: `public-portal-post:${quoteId}`,
    limit: 30,
    windowMs: 60 * 60 * 1000,
    message: "Te veel portal-acties. Probeer later opnieuw.",
  });
  if (hourlyLimiter) return hourlyLimiter;

  const body = await request.json();
  const token = String(body.token || "");
  if (!verifyQuotePdfToken(quoteId, token)) {
    return NextResponse.json({ error: "Ongeldige of verlopen portal-link." }, { status: 403 });
  }
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { id: true, createdById: true, status: true, leadId: true },
  });
  if (!quote) return NextResponse.json({ error: "Offerte niet gevonden." }, { status: 404 });

  const action = String(body.action || "");
  if (action === "approve") {
    if (quote.status !== "ACCEPTED") {
      await prisma.quote.update({
        where: { id: quote.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
        },
      });
      await prisma.activity.create({
        data: {
          userId: quote.createdById,
          leadId: quote.leadId,
          type: "QUOTE_SENT",
          title: `Offerte ${quote.id} goedgekeurd via client portal`,
          metadata: { source: "portal.approve", quoteId: quote.id },
        },
      });
    }
    return NextResponse.json({ success: true });
  }

  if (action === "upload") {
    const dataUrl = String(body.dataUrl || "");
    const name = String(body.name || "bestand");
    const type = String(body.type || "application/octet-stream");
    if (!dataUrl.startsWith("data:")) {
      return NextResponse.json({ error: "Ongeldig bestand." }, { status: 400 });
    }
    if (dataUrl.length > 3_000_000) {
      return NextResponse.json({ error: "Bestand is te groot." }, { status: 400 });
    }
    const key = `user:${quote.createdById}:portal.files_json`;
    const row = await prisma.setting.findUnique({ where: { key }, select: { value: true } });
    const current = parseJson(row?.value);
    const list = Array.isArray(current) ? current : [];
    const entry = {
      id: `file_${Math.random().toString(36).slice(2, 10)}`,
      quoteId: quote.id,
      name,
      type,
      dataUrl,
      uploadedAt: new Date().toISOString(),
    };
    list.unshift(entry);
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: JSON.stringify(list.slice(0, 100)) },
      update: { value: JSON.stringify(list.slice(0, 100)) },
    });
    return NextResponse.json({ success: true, file: entry });
  }

  return NextResponse.json({ error: "Onbekende actie." }, { status: 400 });
}
