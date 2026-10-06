import { cookies } from "next/headers";
import { prisma } from "@digitify/db";
import { z } from "zod";
import { authRateLimit, beginControlledRecovery, recoveryChallengeUser, verifyFactorSetup, confirmFactorSetup, FactorError } from "@digitify/api/src/lib/two-factor";
import { notifyFactorChange } from "@digitify/api/src/lib/two-factor-notifications";
import { authError, authJson, requireAuthOrigin, RECOVERY_COOKIE, factorCookieOptions } from "@/lib/auth/two-factor-http";
import { getClientIp } from "@/lib/http-security";
export const runtime = "nodejs";
const inputSchema = z.object({ email: z.string().email().max(254).optional(), password: z.string().max(1024).optional(), grant: z.string().max(80).optional(), code: z.string().max(6).optional(), proof: z.string().max(80).optional(), saved: z.boolean().optional() }).strict();
export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  try {
    requireAuthOrigin(request);
    await authRateLimit(prisma, "factor-recovery-ip:" + getClientIp(request), 30);
    const input = inputSchema.parse(await request.json()), { action } = await params;
    if (action === "begin") {
      await authRateLimit(prisma, "factor-recovery-account:" + (input.email ?? "").trim().toLowerCase(), 10);
      const setup = await beginControlledRecovery(prisma, input.email ?? "", input.password ?? "", input.grant ?? "");
      const response = authJson({ secret: setup.secret, uri: setup.uri });
      response.cookies.set(RECOVERY_COOKIE, setup.token, { ...factorCookieOptions, maxAge: 20 * 60 });
      return response;
    }
    const token = (await cookies()).get(RECOVERY_COOKIE)?.value ?? "", userId = await recoveryChallengeUser(prisma, token);
    if (action === "verify") return authJson(await verifyFactorSetup(prisma, userId, input.code ?? "", token));
    if (action === "confirm") {
      if (!input.saved || !input.proof) throw new FactorError("Bewaar eerst de herstelcodes.");
      await confirmFactorSetup(prisma, userId, input.proof, token);
      await notifyFactorChange(prisma, userId, "Je authenticator is opnieuw ingesteld na gecontroleerd herstel.");
      const response = authJson({ success: true });
      response.cookies.set(RECOVERY_COOKIE, "", { ...factorCookieOptions, maxAge: 0 });
      return response;
    }
    return authJson({ message: "Onbekende actie." }, 404);
  } catch (error) { return authError(error, { route: "/api/two-factor/recovery/[action]" }); }
}
