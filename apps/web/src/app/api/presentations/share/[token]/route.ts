import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  try {
    const share = await prisma.presentationShare.findFirst({
      where: { tokenHash, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      include: { presentation: { include: { slides: { orderBy: { orderIndex: "asc" }, include: { hotspots: { orderBy: { createdAt: "asc" } } } } } } },
    });
    if (!share || share.presentation.status === "TRASHED") return NextResponse.json({ error: "Deze deellink is niet meer beschikbaar." }, { status: 404 });
    await prisma.presentationShare.update({ where: { id: share.id }, data: { lastOpenedAt: new Date() } });
    return NextResponse.json({
      presentation: {
        id: share.presentation.id,
        title: share.presentation.title,
        description: share.presentation.description,
        sourceFileId: share.presentation.sourceFileId,
        settings: share.presentation.settings,
        slides: share.presentation.slides,
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Presentaties zijn nog niet geactiveerd op deze omgeving." }, { status: 503 });
  }
}
