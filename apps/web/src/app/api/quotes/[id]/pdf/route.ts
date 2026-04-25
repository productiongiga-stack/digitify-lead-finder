import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { getSession } from "@/lib/auth/session";
import { buildQuotePdfHtml, renderQuotePdfBuffer } from "@/lib/quote-pdf";

export const runtime = "nodejs";

function sanitizeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-");
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Niet geauthenticeerd" }, { status: 401 });
  }

  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!quote) {
    return NextResponse.json({ error: "Offerte niet gevonden" }, { status: 404 });
  }

  const settingsRows = await prisma.setting.findMany();
  const settings = Object.fromEntries(settingsRows.map((row) => [row.key, row.value]));
  const html = buildQuotePdfHtml({ quote, settings });
  const buffer = await renderQuotePdfBuffer(html);

  const filename = `Offerte-${sanitizeFilename(quote.quoteNumber || quote.id)}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
      "Cache-Control": "private, no-store",
    },
  });
}
