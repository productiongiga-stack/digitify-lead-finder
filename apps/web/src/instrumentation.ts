/**
 * Runs once when the Next.js server starts (Node runtime).
 * Fails fast with a clear message when required env vars are missing or invalid.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const phase = process.env.NEXT_PHASE || "";
  if (phase === "phase-production-build" || phase === "phase-export") return;

  const { validateServerEnv } = await import("@digitify/api/src/lib/server-env");
  validateServerEnv();

  const dsn = process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    enabled: process.env.NODE_ENV !== "test",
  });
}
