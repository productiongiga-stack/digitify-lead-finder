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

  const { initSentry } = await import("@digitify/api/src/lib/sentry");
  await initSentry();
}
