import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { get as getBlob } from "@vercel/blob";
import { prisma } from "@digitify/db";
import { readLocalWorkspaceFile } from "@digitify/api/src/lib/file-storage";
import { getBlobToken } from "@digitify/api/src/lib/blob-storage";
import { resolveLeadOwnerId } from "@digitify/api/src/lib/tenant";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const share = await prisma.presentationShare.findFirst({ where: { tokenHash: createHash("sha256").update(token).digest("hex"), revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, include: { presentation: true } });
    if (!share?.presentation.sourceFileId) return NextResponse.json({ error: "PDF niet gevonden." }, { status: 404 });
    // Workspace files are legacy owner-scoped records; the presentation uses
    // the technical workspace ID. Resolve the owner before looking up the PDF.
    const ownerUserId = await resolveLeadOwnerId(prisma, share.presentation.workspaceId);
    const file = await prisma.workspaceFile.findFirst({ where: { id: share.presentation.sourceFileId, createdById: ownerUserId, deletedAt: null, contentType: "application/pdf" } });
    if (!file) return NextResponse.json({ error: "PDF niet gevonden." }, { status: 404 });
    if (file.storageProvider === "LOCAL" && file.storageKey) return new NextResponse(await readLocalWorkspaceFile(file.storageKey, share.presentation.workspaceId), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline", "Cache-Control": "private, no-store" } });
    if (file.storage === "blob-private") {
      const token = getBlobToken("private");
      if (!token) return NextResponse.json({ error: "PDF-opslag is niet geconfigureerd." }, { status: 503 });
      const blob = await getBlob(file.storageUrl, { access: "private", token, useCache: false });
      if (!blob?.stream) return NextResponse.json({ error: "PDF niet gevonden." }, { status: 404 });
      return new NextResponse(blob.stream, { headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline", "Cache-Control": "private, no-store" } });
    }
    const response = await fetch(file.storageUrl, { cache: "no-store" });
    if (!response.ok || !response.body) return NextResponse.json({ error: "PDF kan niet worden geladen." }, { status: 502 });
    return new NextResponse(response.body, { headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline", "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "PDF kan niet worden geladen." }, { status: 502 }); }
}
