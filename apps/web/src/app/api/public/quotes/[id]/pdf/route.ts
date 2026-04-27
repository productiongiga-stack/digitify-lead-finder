import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { log } from "@digitify/api/src/lib/logger";
import {
  buildQuotePdfHtml,
  renderQuotePdfBuffer,
  verifyQuotePdfToken,
} from "@/lib/quote-pdf";
import { enforceRateLimit, getClientIp } from "@/lib/http-security";

export const runtime = "nodejs";

function sanitizeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-");
}

function userSettingPrefix(userId: string) {
  return `user:${userId}:`;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ip = getClientIp(request);
  const limiter = enforceRateLimit(request, {
    key: `public-quote-pdf:${id}:${ip}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
    message: "Te veel PDF verzoeken. Probeer later opnieuw.",
  });
  if (limiter) return limiter;

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const asAttachment = url.searchParams.get("download") !== "0";

  if (!verifyQuotePdfToken(id, token)) {
    return NextResponse.json({ error: "Ongeldige of verlopen PDF-link" }, { status: 403 });
  }

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!quote) {
    return NextResponse.json({ error: "Offerte niet gevonden" }, { status: 404 });
  }

  const prefix = userSettingPrefix(quote.createdById);
  const settingsRows = await prisma.setting.findMany({
    where: {
      OR: [
        { key: { startsWith: `${prefix}quotes.` } },
        {
          key: {
            in: [
              `${prefix}branding.company_name`,
              `${prefix}branding.primary_color`,
              `${prefix}branding.logo_url`,
              `${prefix}branding.about`,
              `${prefix}branding.email`,
              `${prefix}branding.phone`,
              `${prefix}branding.website`,
              `${prefix}branding.address`,
              `${prefix}branding.vat_number`,
              `${prefix}company.name`,
              `${prefix}company.profile`,
              `${prefix}company.email`,
              `${prefix}company.phone`,
              `${prefix}company.website`,
              `${prefix}company.address`,
              `${prefix}company.vat`,
              `${prefix}email.from_name`,
              `${prefix}email.from_title`,
              `${prefix}email.from_email`,
            ],
          },
        },
      ],
    },
  });
  const settings = Object.fromEntries(
    settingsRows.map((row) => [row.key.replace(prefix, ""), row.value]),
  );
  let buffer: Buffer;
  try {
    const html = buildQuotePdfHtml({ quote, settings });
    buffer = await renderQuotePdfBuffer(html);
  } catch (error) {
    log.api.error("Public quote PDF render failed", { quoteId: quote.id }, error);
    return NextResponse.json({ error: "PDF genereren mislukt" }, { status: 500 });
  }

  const filename = `Offerte-${sanitizeFilename(quote.quoteNumber || quote.id)}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${asAttachment ? "attachment" : "inline"}; filename=\"${filename}\"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
