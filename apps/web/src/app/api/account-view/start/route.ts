import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@digitify/db";
import { TRPCError } from "@trpc/server";
import { getCurrentUser } from "@/lib/auth/session";
import { startAccountView, ACCOUNT_VIEW_COOKIE } from "@digitify/api/src/lib/account-view";
import { recordSecurityAuditEvent } from "@digitify/api/src/lib/security-audit";

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor || actor.isViewingAs) return NextResponse.json({ message: "Niet toegestaan." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const requestId = randomUUID();
  const targetUserId = String(body.userId || "");
  try {
    const view = await startAccountView(
      prisma,
      actor,
      targetUserId,
      typeof body.workspaceId === "string" ? body.workspaceId : undefined,
      requestId,
    );
    const response = NextResponse.json({ expiresAt: view.expiresAt });
    response.cookies.set(ACCOUNT_VIEW_COOKIE, view.token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 60 });
    return response;
  } catch (error) {
    await recordSecurityAuditEvent(prisma, {
      workspaceId: actor.workspaceId,
      actorUserId: actor.id,
      targetUserId: targetUserId || null,
      action: "ACCOUNT_VIEW_STARTED",
      resource: "account_view_session",
      result: "DENIED",
      reason: error instanceof Error ? error.message : "Account view geweigerd",
      requestId,
    }).catch(() => undefined);
    const message = error instanceof TRPCError ? error.message : "Account bekijken kon niet worden gestart.";
    const status = error instanceof TRPCError && error.code === "BAD_REQUEST" ? 400 : 403;
    return NextResponse.json({ message }, { status });
  }
}
