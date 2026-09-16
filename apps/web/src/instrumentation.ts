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

  if (process.env.NODE_ENV !== "production") return;

  // Keep the startup guard independent from the db package barrel. The barrel
  // also exports crypto-backed settings helpers that should not enter the
  // instrumentation bundle.
  const [{ PrismaClient }, { assertSafeDatabaseRole }] = await Promise.all([
    import("@prisma/client"),
    import("@digitify/db/src/database-role"),
  ]);
  const startupPrisma = new PrismaClient();
  try {
    await assertSafeDatabaseRole(startupPrisma);
  } catch (err) {
    // Soft-fail by default: a hard throw here 500s every App Router page while
    // leaving /api/health up (exact production outage on leads.digitify.be).
    // Opt into hard fail only after DATABASE_URL uses a non-BYPASSRLS role.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[instrumentation] database role check failed: ${message}`);
    if (process.env.STRICT_DATABASE_ROLE_CHECK === "true") {
      throw err;
    }
  } finally {
    await startupPrisma.$disconnect();
  }

  const dsn = process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    enabled: true,
  });
}
