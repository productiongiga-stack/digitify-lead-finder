export type PublicBookingAuthInput = {
  tenant?: string | null;
  quotePortal?: string | null;
  portalToken?: string | null;
};

export function publicBookingRateLimitKey(input: PublicBookingAuthInput): string {
  const quotePortal = input.quotePortal?.trim();
  if (quotePortal) return `portal:${quotePortal.slice(0, 24)}`;
  return (input.tenant || "anon").slice(0, 24);
}

export function appendPublicBookingAuthParams(
  url: URL,
  input: PublicBookingAuthInput,
): void {
  const quotePortal = input.quotePortal?.trim() || "";
  const portalToken = input.portalToken?.trim() || "";
  if (quotePortal && portalToken) {
    url.searchParams.set("quotePortal", quotePortal);
    url.searchParams.set("portalToken", portalToken);
    return;
  }
  const tenant = input.tenant?.trim() || "";
  if (tenant) url.searchParams.set("tenant", tenant);
}
