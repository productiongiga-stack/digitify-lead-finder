export function resolveOAuthAppUrl(request?: Request) {
  if (request) {
    try {
      const origin = new URL(request.url).origin.trim();
      if (origin) return origin.replace(/\/$/, "");
    } catch {
      // fall through to env-based resolution
    }
  }

  const candidates = [process.env.NEXTAUTH_URL, process.env.NEXT_PUBLIC_APP_URL, process.env.APP_URL];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed) continue;
    try {
      return new URL(trimmed).origin.replace(/\/$/, "");
    } catch {
      continue;
    }
  }

  return "http://localhost:3000";
}
