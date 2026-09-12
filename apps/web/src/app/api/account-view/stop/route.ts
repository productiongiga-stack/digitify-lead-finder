import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { getCurrentUser } from "@/lib/auth/session";
import { endAccountView, ACCOUNT_VIEW_COOKIE } from "@digitify/api/src/lib/account-view";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (user?.isViewingAs && user.actorUserId && user.viewAsSessionId) {
    await endAccountView(prisma, user.viewAsSessionId, user.actorUserId, request.headers.get("x-request-id") || undefined);
  }
  const response = NextResponse.json({ success: true });
  response.cookies.set(ACCOUNT_VIEW_COOKIE, "", { httpOnly: true, expires: new Date(0), sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/" });
  return response;
}
