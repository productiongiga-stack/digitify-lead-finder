import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { verifyQuotePdfToken } from "@/lib/quote-pdf";
import { enforceRateLimit } from "@/lib/http-security";
import { storePortalUpload } from "@/lib/portal-upload";

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

  const [project, invoices] = await Promise.all([
    prisma.project.findFirst({ where: { createdById: quote.createdById, quoteId: quote.id, status: { not: "ARCHIVED" } }, select: { id: true, name: true, clientName: true, description: true, status: true, startAt: true, dueAt: true } }),
    prisma.workspaceInvoice.findMany({ where: { createdById: quote.createdById, quoteId: quote.id }, orderBy: { issueDate: "desc" }, take: 20, select: { id: true, invoiceNumber: true, status: true, issueDate: true, dueDate: true, total: true, currency: true, paidAt: true } }),
  ]);
  const contracts = await prisma.contract.findMany({
    where: { createdById: quote.createdById, OR: [{ quoteId: quote.id }, ...(project ? [{ projectId: project.id }] : [])] },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { id: true, name: true, clientName: true, version: true, status: true, sentAt: true, viewedAt: true, signedAt: true, updatedAt: true },
  });

  const files = (await loadPortalFiles(quote.createdById, quote.id)).map((file) => {
    if (!file || typeof file !== "object" || typeof file.id !== "string") return file;
    const downloadUrl = `/api/public/portal/${encodeURIComponent(quote.id)}/file/${encodeURIComponent(file.id)}?token=${encodeURIComponent(token || "")}`;
    return { ...file, url: downloadUrl, downloadUrl };
  });
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
    project,
    contracts,
    invoices,
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

  const contentType = request.headers.get("content-type") ?? "";
  let body: Record<string, unknown>;
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    let dataUrl = "";
    if (file instanceof File) {
      const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
      dataUrl = `data:${file.type || "application/octet-stream"};base64,${bytes}`;
    }
    body = {
      token: form.get("token"),
      action: "upload",
      dataUrl,
      name: file instanceof File ? file.name : "bestand",
      type: file instanceof File ? file.type : "application/octet-stream",
    };
  } else {
    body = (await request.json()) as Record<string, unknown>;
  }
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
    try {
      const entry = await storePortalUpload({
        workspaceId: quote.createdById,
        quoteId: quote.id,
        name,
        type,
        dataUrl,
      });
      const key = `user:${quote.createdById}:portal.files_json`;
      const row = await prisma.setting.findUnique({ where: { key }, select: { value: true } });
      const current = parseJson(row?.value);
      const list = Array.isArray(current) ? current : [];
      list.unshift(entry);
      await prisma.setting.upsert({
        where: { key },
        create: { key, value: JSON.stringify(list.slice(0, 100)) },
        update: { value: JSON.stringify(list.slice(0, 100)) },
      });
      return NextResponse.json({ success: true, file: entry });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload mislukt.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Onbekende actie." }, { status: 400 });
}
