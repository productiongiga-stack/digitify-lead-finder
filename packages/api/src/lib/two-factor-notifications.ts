import { createWorkspaceRlsClient, type PrismaClient } from "@digitify/db";
import { sendBrandedEmail } from "./email-sender";
import { recordSecurityAuditEvent } from "./security-audit";
import { log } from "./logger";
export async function notifyFactorChange(db: PrismaClient, userId: string, description: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, workspaceOwnerId: true } });
  if (!user) return;
  const workspaceId = user.workspaceOwnerId || userId;
  let delivered = false;
  try {
    const scoped = createWorkspaceRlsClient(db, workspaceId, userId);
    const result = await sendBrandedEmail(scoped, { userId: workspaceId, toEmail: user.email, subject: "Beveiliging van je Digitify-account gewijzigd", body: description + "\n\nHeb je dit niet zelf gedaan? Neem onmiddellijk contact op met de platformbeheerder.", bodyFormat: "TEXT" });
    delivered = result.success;
  } catch { /* Never undo a security change because delivery failed. */ }
  try {
    await recordSecurityAuditEvent(db, { actorUserId: userId, targetUserId: userId, workspaceId, action: "TWO_FACTOR_NOTIFICATION", result: delivered ? "SUCCESS" : "FAILED" });
  } catch { log.security.warn("2FA notification audit unavailable", { userId }); }
}
