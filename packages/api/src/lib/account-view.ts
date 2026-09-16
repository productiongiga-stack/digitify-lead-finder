import type { PrismaClient } from "@digitify/db";
import { createHash, randomBytes } from "crypto";
import { TRPCError } from "@trpc/server";
import { recordSecurityAuditEvent } from "./security-audit";
import { isPlatformOwner } from "./platform-admin";

const VIEW_TTL_MS = 30 * 60_000;
export const ACCOUNT_VIEW_COOKIE = "digitify-account-view";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function startAccountView(
  db: PrismaClient,
  actor: { id: string; email: string; role: string; workspaceId?: string; workspaceRole?: string },
  targetUserId: string,
  targetWorkspaceId?: string,
  requestId?: string,
) {
  const platformOwner = isPlatformOwner(actor);
  if (actor.workspaceRole !== "OWNER" || actor.id === targetUserId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Alleen een workspace-owner kan een ander account bekijken." });
  }
  const workspaceId = platformOwner ? targetWorkspaceId : actor.workspaceId;
  if (!workspaceId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Kies een workspace voor dit account." });
  }
  if (!platformOwner && workspaceId !== actor.workspaceId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Je kunt alleen accounts uit je eigen workspace bekijken." });
  }
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId }, select: { ownerUserId: true } });
  const membership = await db.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    select: { role: true, status: true },
  });
  if (!workspace || !membership || membership.status !== "ACTIVE" || (!platformOwner && workspace.ownerUserId !== actor.id)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Het doelaccount hoort niet actief bij deze workspace." });
  }
  const token = randomBytes(32).toString("base64url");
  const view = await db.accountViewSession.create({
    data: {
      tokenHash: hashToken(token), actorUserId: actor.id, targetUserId,
      workspaceId, expiresAt: new Date(Date.now() + VIEW_TTL_MS),
      metadata: { requestId },
    },
    select: { id: true, expiresAt: true },
  });
  await recordSecurityAuditEvent(db, {
    workspaceId, actorUserId: actor.id, targetUserId,
    action: "ACCOUNT_VIEW_STARTED", resource: "account_view_session", resourceId: view.id,
    result: "SUCCESS", requestId, metadata: { platformOwner, targetWorkspaceId: workspaceId },
  });
  return { token, sessionId: view.id, expiresAt: view.expiresAt };
}

export async function resolveAccountView(
  db: PrismaClient,
  actor: { id: string; email: string; role: string; workspaceId?: string; workspaceRole?: string },
  token: string,
  requestId?: string,
) {
  if (!token || actor.workspaceRole !== "OWNER") return null;
  const platformOwner = isPlatformOwner(actor);
  const view = await db.accountViewSession.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!view || view.actorUserId !== actor.id || (!platformOwner && view.workspaceId !== actor.workspaceId) || view.endedAt || view.expiresAt <= new Date()) return null;
  const [workspace, membership, target] = await Promise.all([
    db.workspace.findUnique({ where: { id: view.workspaceId }, select: { ownerUserId: true } }),
    db.workspaceMembership.findUnique({ where: { workspaceId_userId: { workspaceId: view.workspaceId, userId: view.targetUserId } }, select: { role: true, status: true } }),
    db.user.findUnique({ where: { id: view.targetUserId }, select: { id: true, email: true, name: true, role: true } }),
  ]);
  if (!workspace || (!platformOwner && workspace.ownerUserId !== actor.id) || membership?.status !== "ACTIVE" || !target) {
    await db.accountViewSession.update({ where: { id: view.id }, data: { endedAt: new Date() } });
    await recordSecurityAuditEvent(db, {
      workspaceId: view.workspaceId,
      actorUserId: actor.id,
      targetUserId: view.targetUserId,
      action: "ACCOUNT_VIEW_ENDED",
      resource: "account_view_session",
      resourceId: view.id,
      result: "FAILED",
      requestId,
    });
    return null;
  }
  const modules = await db.setting.findUnique({ where: { key: `user:${target.id}:modules.disabled` }, select: { value: true } });
  const disabledModules = typeof modules?.value === "string" ? modules.value.split(",").map((id) => id.trim()).filter(Boolean) : [];
  return {
    ...actor, id: target.id, email: target.email, name: target.name, role: target.role,
    workspaceRole: membership.role, workspaceId: view.workspaceId, isPersonalWorkspace: false,
    disabledModules, isViewingAs: true, actorUserId: actor.id, viewAsSessionId: view.id,
    viewAsTargetName: target.name || target.email,
  };
}

export async function endAccountView(db: PrismaClient, sessionId: string, actorUserId: string, requestId?: string) {
  const view = await db.accountViewSession.findFirst({ where: { id: sessionId, actorUserId, endedAt: null }, select: { id: true, workspaceId: true, targetUserId: true } });
  if (!view) return;
  await db.accountViewSession.update({ where: { id: view.id }, data: { endedAt: new Date() } });
  await recordSecurityAuditEvent(db, { workspaceId: view.workspaceId, actorUserId, targetUserId: view.targetUserId, action: "ACCOUNT_VIEW_ENDED", resource: "account_view_session", resourceId: view.id, result: "SUCCESS", requestId });
}
