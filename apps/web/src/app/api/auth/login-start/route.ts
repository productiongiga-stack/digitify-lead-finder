import { prisma } from "@digitify/db";
import { z } from "zod";
import { authRateLimit, beginLogin } from "@digitify/api/src/lib/two-factor";
import { getClientIp } from "@/lib/http-security";
import { authError, authJson, factorCookieOptions, LOGIN_COOKIE, requireAuthOrigin } from "@/lib/auth/two-factor-http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireAuthOrigin(request);
    await authRateLimit(prisma, "password-ip:" + getClientIp(request), 8, 60000);
    const input = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(1024) }).strict().parse(await request.json());
    await authRateLimit(prisma, "password-account:" + input.email.trim().toLowerCase(), 30);
    const result = await beginLogin(prisma, input.email, input.password);
    const response = authJson({ requiresTwoFactor: result.requiresTwoFactor });
    response.cookies.set(LOGIN_COOKIE, result.token, { ...factorCookieOptions, maxAge: 300 });
    return response;
  } catch (error) { return authError(error, { route: "/api/auth/login-start" }); }
}
