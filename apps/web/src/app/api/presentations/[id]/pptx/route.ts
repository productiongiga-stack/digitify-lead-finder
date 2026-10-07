import PptxGenJS from "pptxgenjs";
import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Niet geauthenticeerd." }, { status: 401 });
  const { id } = await params;
  const workspaceId = user.workspaceId ?? user.id;
  const presentation = await prisma.presentation.findFirst({ where: { id, workspaceId }, include: { slides: { orderBy: { orderIndex: "asc" }, include: { hotspots: true } } } });
  if (!presentation) return NextResponse.json({ error: "Presentatie niet gevonden." }, { status: 404 });
  const deck = new PptxGenJS();
  deck.layout = "LAYOUT_WIDE";
  for (const [index, slide] of presentation.slides.entries()) {
    const page = deck.addSlide();
    page.background = { color: "0f172a" };
    page.addText(slide.title || `Slide ${index + 1}`, { x: 0.6, y: 0.7, w: 11, h: 0.6, fontSize: 28, bold: true, color: "FFFFFF" });
    if (slide.body) page.addText(slide.body, { x: 0.6, y: 1.5, w: 11, h: 4.2, fontSize: 16, color: "E2E8F0", valign: "top", margin: 0.05 });
    for (const hotspot of slide.hotspots) {
      const target = presentation.slides.findIndex((candidate) => candidate.id === hotspot.targetSlideId);
      if (target >= 0) page.addText(hotspot.label || "Ga verder", { x: hotspot.x * 13.33, y: hotspot.y * 7.5, w: hotspot.width * 13.33, h: hotspot.height * 7.5, fontSize: 10, color: "FFFFFF", fill: { color: "334155", transparency: 20 }, hyperlink: { slide: target + 1 } });
    }
  }
  const buffer = (await deck.write({ outputType: "nodebuffer" })) as Buffer;
  return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "Content-Disposition": `attachment; filename="presentation-${id}.pptx"`, "Cache-Control": "private, no-store" } });
}
