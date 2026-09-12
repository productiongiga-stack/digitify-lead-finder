import type { PrismaClient } from "@digitify/db";

export type SecurityAuditInput = {
  workspaceId?: string | null;
  actorUserId?: string | null;
  targetUserId?: string | null;
  action: string;
  resource?: string;
  resourceId?: string;
  result: "SUCCESS" | "DENIED" | "FAILED";
  reason?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
};

/** Writes security events without ever accepting secrets as part of the contract. */
export async function recordSecurityAuditEvent(db: PrismaClient, input: SecurityAuditInput) {
  return db.securityAuditEvent.create({
    data: {
      workspaceId: input.workspaceId ?? null,
      actorUserId: input.actorUserId ?? null,
      targetUserId: input.targetUserId ?? null,
      action: input.action,
      resource: input.resource ?? null,
      resourceId: input.resourceId ?? null,
      result: input.result,
      reason: input.reason ?? null,
      requestId: input.requestId ?? null,
      metadata: input.metadata as any,
    },
  });
}
