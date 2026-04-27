import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import {
  buildQuotePdfHtml,
  renderQuotePdfBuffer,
  verifyQuotePdfToken,
} from "@/lib/quote-pdf";

export const runtime = "nodejs";

function sanitizeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-");
}

function userSettingPrefix(userId: string) {
  return `user:${userId}:`;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
    where: { key: { startsWith: prefix } },
  });
  const settings = Object.fromEntries(
    settingsRows.map((row) => [row.key.replace(prefix, ""), row.value]),
  );
  const html = buildQuotePdfHtml({ quote, settings });
  const buffer = await renderQuotePdfBuffer(html);

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
