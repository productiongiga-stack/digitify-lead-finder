type SentryScope = {
  setTag(key: string, value: string): void;
  setContext(name: string, context: Record<string, unknown>): void;
};

let initPromise: Promise<void> | null = null;

function dsn() {
  return process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || "";
}

export function isSentryEnabled() {
  return Boolean(dsn());
}

export async function initSentry() {
  if (!isSentryEnabled()) return;
  if (!initPromise) {
    initPromise = (async () => {
      const Sentry = await import("@sentry/node");
      Sentry.init({
        dsn: dsn(),
        environment: process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || process.env.NODE_ENV,
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
        enabled: process.env.NODE_ENV !== "test",
      });
    })();
  }
  await initPromise;
}

export async function captureException(
  error: unknown,
  context?: Record<string, unknown>,
) {
  if (!isSentryEnabled() || process.env.NODE_ENV === "test") return;
  await initSentry();
  const Sentry = await import("@sentry/node");
  Sentry.withScope((scope: SentryScope) => {
    if (context) scope.setContext("extra", context);
    Sentry.captureException(error);
  });
}
