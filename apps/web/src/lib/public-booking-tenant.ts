import { prisma } from "@digitify/db";
import { resolvePublicTenantUserId } from "@digitify/api/src/lib/public-tenant";
import { verifyQuotePdfToken } from "@/lib/quote-pdf";
import type { PublicBookingAuthInput } from "@/lib/public-booking-auth";

export type { PublicBookingAuthInput } from "@/lib/public-booking-auth";
export { appendPublicBookingAuthParams, publicBookingRateLimitKey } from "@/lib/public-booking-auth";

export async function resolvePublicBookingTenantUserId(
  input: PublicBookingAuthInput,
): Promise<string | null> {
  const quotePortal = input.quotePortal?.trim() || "";
  const portalToken = input.portalToken?.trim() || "";
  if (quotePortal && portalToken) {
    if (!verifyQuotePdfToken(quotePortal, portalToken)) return null;
    const quote = await prisma.quote.findUnique({
      where: { id: quotePortal },
      select: { createdById: true },
    });
    return quote?.createdById || null;
  }
  return resolvePublicTenantUserId(prisma, input.tenant || "");
}
