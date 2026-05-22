import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { getCurrentUser, workspaceIdFor } from "@/lib/auth/session";
import { createQuotePdfToken } from "@/lib/quote-pdf";
import { getAppUrl } from "@/lib/config";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  const userId = typeof (currentUser as any)?.id === "string" ? ((currentUser as any).id as string) : "";
  if (!userId) return NextResponse.json({ error: "Niet geauthenticeerd." }, { status: 401 });
  const workspaceId = workspaceIdFor(currentUser as { id: string; workspaceId?: string });

  const { id } = await params;
  const quote = await prisma.quote.findFirst({
    where: { id, createdById: workspaceId },
    select: { id: true, validUntil: true },
  });
  if (!quote) return NextResponse.json({ error: "Offerte niet gevonden." }, { status: 404 });

  const token = createQuotePdfToken(quote.id, quote.validUntil);
  const url = `${getAppUrl()}/client-portal/${quote.id}?token=${encodeURIComponent(token)}`;
  return NextResponse.json({ url });
}
