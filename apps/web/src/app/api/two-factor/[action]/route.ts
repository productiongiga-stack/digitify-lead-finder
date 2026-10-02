import { prisma } from "@digitify/db";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { authRateLimit, beginFactorSetup, confirmFactorSetup, FactorError, manageFactor, verifyFactorSetup } from "@digitify/api/src/lib/two-factor";
import { notifyFactorChange } from "@digitify/api/src/lib/two-factor-notifications";
import { getClientIp } from "@/lib/http-security";
import { authError, authJson, requireAuthOrigin } from "@/lib/auth/two-factor-http";
export const runtime = "nodejs";
const schema = z.object({ password: z.string().max(1024).optional(), code: z.string().max(80).optional(), method: z.enum(["totp", "recovery"]).default("totp"), proof: z.string().max(80).optional(), saved: z.boolean().optional() }).strict();
export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  try {
    requireAuthOrigin(request);
    const user = await getCurrentUser();
    if (!user || user.isViewingAs) throw new FactorError("Deze actie is alleen voor je eigen aangemelde account.", 403);
    await authRateLimit(prisma, "factor-ip:" + getClientIp(request), 30);
    await authRateLimit(prisma, "factor-manage:" + user.id, 30);
    const input = schema.parse(await request.json()), { action } = await params;
    if (action === "setup") return authJson(await beginFactorSetup(prisma, user.id, input.password ?? "", input.code, input.method));
    if (action === "verify") return authJson(await verifyFactorSetup(prisma, user.id, input.code ?? ""));
    if (action === "confirm") {
      if (!input.saved || !input.proof) throw new FactorError("Bevestig dat je de herstelcodes hebt opgeslagen.");
      await confirmFactorSetup(prisma, user.id, input.proof);
      await notifyFactorChange(prisma, user.id, "Je authenticator is ingesteld of vervangen.");
      return authJson({ success: true });
    }
    if (action === "disable" || action === "regenerate") {
      const result = await manageFactor(prisma, user.id, input.password ?? "", input.code ?? "", input.method, action);
      await notifyFactorChange(prisma, user.id, action === "disable" ? "Tweestapsverificatie is uitgeschakeld." : "Je herstelcodes zijn vernieuwd.");
      return authJson(result);
    }
    return authJson({ message: "Onbekende actie." }, 404);
  } catch (error) { return authError(error); }
}
