/**
 * Cron route authorization — fail-closed in production.
 *
 * Production: CRON_SECRET must be set; request must send `Authorization: Bearer <secret>`.
 * Development: same if CRON_SECRET is set; otherwise allow only when CRON_ALLOW_UNSIGNED_DEV=1.
 */
export function isCronAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const isProduction = process.env.NODE_ENV === "production";

  if (cronSecret) {
    return bearerToken.length > 0 && bearerToken === cronSecret;
  }

  if (isProduction) {
    return false;
  }

  return process.env.CRON_ALLOW_UNSIGNED_DEV === "1";
}

export function cronAuthFailureReason(): string {
  if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET?.trim()) {
    return "CRON_SECRET is not configured";
  }
  return "Invalid or missing Authorization bearer token";
}
