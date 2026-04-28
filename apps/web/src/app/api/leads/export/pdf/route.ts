import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { getCurrentUser } from "@/lib/auth/session";
import { buildLeadsPdfHtml } from "@/lib/leads-pdf";
import { renderQuotePdfBuffer } from "@/lib/quote-pdf";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  const userId = typeof (currentUser as any)?.id === "string" ? ((currentUser as any).id as string) : "";
  if (!userId) {
    return NextResponse.json({ error: "Niet geauthenticeerd." }, { status: 401 });
  }

  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids") || "";
  const ids = idsParam
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const leads = await prisma.lead.findMany({
    where: {
      createdById: userId,
      ...(ids.length > 0 ? { id: { in: ids } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 2000,
    select: {
      companyName: true,
      city: true,
      country: true,
      industry: true,
      scorePriority: true,
      overallScore: true,
      email: true,
      phone: true,
      website: true,
      createdAt: true,
    },
  });

  const html = buildLeadsPdfHtml({
    title: "Lead Export",
    generatedAt: new Date(),
    leads,
  });
  const pdf = await renderQuotePdfBuffer(html);
  const filename = `Leads-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
