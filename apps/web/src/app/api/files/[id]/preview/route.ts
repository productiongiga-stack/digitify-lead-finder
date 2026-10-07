import { readFile } from "node:fs/promises";
import path from "node:path";
import { get as getBlob } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { getCurrentUser } from "@/lib/auth/session";
import { readLocalWorkspaceFile } from "@digitify/api/src/lib/file-storage";
import { resolveLeadOwnerId } from "@digitify/api/src/lib/tenant";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Niet geauthenticeerd." }, { status: 401 });
  const { id } = await params;
  const ownerUserId = await resolveLeadOwnerId(prisma, user.workspaceId);
  const file = await prisma.workspaceFile.findFirst({ where: { id, createdById: ownerUserId, deletedAt: null, contentType: "application/pdf" } });
  if (!file) return NextResponse.json({ error: "PDF niet gevonden." }, { status: 404 });
  const headers = { "Content-Type": "application/pdf", "Content-Disposition": "inline", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  try {
    if (file.storageProvider === "LOCAL" && file.storageKey) return new NextResponse(await readLocalWorkspaceFile(file.storageKey, user.workspaceId), { headers });
    if (file.storage === "blob-private") {
      const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
      if (!token) return NextResponse.json({ error: "PDF kan niet worden geladen." }, { status: 503 });
      const blob = await getBlob(file.storageUrl, { access: "private", token, useCache: false });
      if (!blob?.stream) return NextResponse.json({ error: "PDF kan niet worden geladen." }, { status: 404 });
      return new NextResponse(blob.stream, { headers });
    }
    const parsed = new URL(file.storageUrl);
    if (parsed.pathname.startsWith(`/uploads/workspaces/${user.workspaceId}/`)) {
      const absolute = path.resolve(process.cwd(), "public", parsed.pathname.replace(/^\//, ""));
      return new NextResponse(await readFile(absolute), { headers });
    }
    const response = await fetch(file.storageUrl, { cache: "no-store" });
    if (!response.ok || !response.body) return NextResponse.json({ error: "PDF kan niet worden geladen." }, { status: 502 });
    return new NextResponse(response.body, { headers });
  } catch {
    return NextResponse.json({ error: "PDF kan niet worden geladen." }, { status: 502 });
  }
}
