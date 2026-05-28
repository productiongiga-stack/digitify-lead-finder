import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { getCurrentUser, workspaceIdFor } from "@/lib/auth/session";
import { buildQuotePdfHtml, renderQuotePdfBuffer } from "@/lib/quote-pdf";

export const runtime = "nodejs";

function sanitizeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-");
}

function userSettingPrefix(userId: string) {
  return `user:${userId}:`;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || typeof (currentUser as any).id !== "string") {
    return NextResponse.json({ error: "Niet geauthenticeerd" }, { status: 401 });
  }
  const userId = (currentUser as any).id as string;
  const workspaceId = workspaceIdFor(currentUser as { id: string; workspaceId?: string });

  const { id } = await params;
  const quote = await prisma.quote.findFirst({
    where: { id, createdById: workspaceId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!quote) {
    return NextResponse.json({ error: "Offerte niet gevonden" }, { status: 404 });
  }

  const prefix = userSettingPrefix(userId);
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
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
      "Cache-Control": "private, no-store",
    },
  });
}
