import { prisma } from "@digitify/db";
import { getSession } from "@/lib/auth/session";
import { factorStatus } from "@digitify/api/src/lib/two-factor";
import { authError, authJson } from "@/lib/auth/two-factor-http";
export const runtime = "nodejs";
export async function GET() {
  try {
    // Actual session identity, not the impersonated account.
    const session = await getSession();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) return authJson({ message: "Niet aangemeld." }, 401);
    return authJson(await factorStatus(prisma, userId));
  } catch (error) { return authError(error); }
}
