import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@digitify/db";
import { getCurrentUser } from "@/lib/auth/session";
import { startAccountView, ACCOUNT_VIEW_COOKIE } from "@digitify/api/src/lib/account-view";

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor || actor.isViewingAs) return NextResponse.json({ message: "Niet toegestaan." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const view = await startAccountView(prisma, actor, String(body.userId || ""), randomUUID());
  const response = NextResponse.json({ expiresAt: view.expiresAt });
  response.cookies.set(ACCOUNT_VIEW_COOKIE, view.token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 60 });
  return response;
}
