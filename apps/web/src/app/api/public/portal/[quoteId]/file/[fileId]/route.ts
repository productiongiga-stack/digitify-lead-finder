import { readFile } from "node:fs/promises";
import path from "node:path";
import { get as getBlob } from "@vercel/blob";
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

function safeDownloadName(name: string) {
  return name.replace(/[^a-zA-Z0-9._ -]+/g, "-").slice(0, 180) || "bestand";
}

async function loadPortalFile(ownerId: string, quoteId: string, fileId: string) {
  const row = await prisma.setting.findUnique({
    where: { key: `user:${ownerId}:portal.files_json` },
    select: { value: true },
  });
  const files = parseJson(row?.value);
  if (!Array.isArray(files)) return null;
  return files.find((file) => file && typeof file === "object" && file.quoteId === quoteId && file.id === fileId) ?? null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ quoteId: string; fileId: string }> },
) {
  const { quoteId, fileId } = await params;
  const limiter = await enforceRateLimit(request, {
    key: `public-portal-file:${quoteId}:${fileId}`,
    limit: 30,
    windowMs: 60 * 60 * 1000,
    message: "Te veel downloadverzoeken. Probeer later opnieuw.",
  });
  if (limiter) return limiter;

  const token = new URL(request.url).searchParams.get("token");
  if (!verifyQuotePdfToken(quoteId, token)) {
    return NextResponse.json({ error: "Ongeldige of verlopen portal-link." }, { status: 403 });
  }

  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { id: true, createdById: true } });
  if (!quote) return NextResponse.json({ error: "Offerte niet gevonden." }, { status: 404 });
  const file = await loadPortalFile(quote.createdById, quote.id, fileId) as Record<string, unknown> | null;
  if (!file) return NextResponse.json({ error: "Bestand niet gevonden." }, { status: 404 });

  const storageUrl = typeof file.url === "string" ? file.url : "";
  const storage = typeof file.storage === "string" ? file.storage : "";
  const contentType = typeof file.type === "string" ? file.type : "application/octet-stream";
  const name = typeof file.name === "string" ? file.name : "bestand";
  const headers = {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${safeDownloadName(name)}"`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  };

  try {
    const parsed = new URL(storageUrl);
    if (storage === "local") {
      const relative = parsed.pathname.replace(/^\//, "");
      const absolute = path.resolve(process.cwd(), "public", relative);
      const publicRoot = path.resolve(process.cwd(), "public", "uploads", "portal", quote.createdById, quote.id);
      if (!absolute.startsWith(`${publicRoot}${path.sep}`)) return NextResponse.json({ error: "Bestand niet gevonden." }, { status: 404 });
      return new NextResponse(await readFile(absolute), { headers });
    }
    if (storage === "blob-private") {
      const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
      if (!blobToken || !parsed.pathname.includes(`/portal/${quote.createdById}/${quote.id}/`)) {
        return NextResponse.json({ error: "Bestand niet gevonden." }, { status: 404 });
      }
      const blob = await getBlob(storageUrl, { access: "private", token: blobToken, useCache: false });
      if (!blob?.stream) return NextResponse.json({ error: "Bestand niet gevonden." }, { status: 404 });
      return new NextResponse(blob.stream, { headers });
    }
    if (storage === "blob" && parsed.hostname.endsWith(".blob.vercel-storage.com")) {
      const response = await fetch(storageUrl, { cache: "no-store" });
      if (response.ok && response.body) return new NextResponse(response.body, { headers });
    }
    return NextResponse.json({ error: "Bestand niet gevonden." }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Bestand kan niet worden geladen." }, { status: 502 });
  }
}
