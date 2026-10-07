export function resolveOAuthAppUrl(request?: Request) {
  const candidates = [process.env.NEXTAUTH_URL, process.env.NEXT_PUBLIC_APP_URL, process.env.APP_URL];
  const configuredOrigin = candidates.reduce<string | null>((resolved, candidate) => {
    if (resolved || !candidate?.trim()) return resolved;
    try {
      return new URL(candidate.trim()).origin.replace(/\/$/, "");
    } catch {
      return null;
    }
  }, null);

  // Production OAuth clients use a fixed callback allowlist. Prefer the
  // configured canonical domain so a Vercel preview/alias cannot generate a
  // redirect URI that Google has never seen.
  if (process.env.NODE_ENV === "production" && configuredOrigin) return configuredOrigin;

  if (request) {
    try {
      const origin = new URL(request.url).origin.trim();
      if (origin) return origin.replace(/\/$/, "");
    } catch {
      // fall through to env-based resolution
    }
  }

  if (configuredOrigin) return configuredOrigin;

  return "http://localhost:3000";
}
