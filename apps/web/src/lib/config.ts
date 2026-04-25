/**
 * Central application configuration.
 * Resolves environment-specific values for multi-domain deployment.
 */

/**
 * Get the base URL of the application.
 * Works in both client and server contexts.
 */
export function getAppUrl(): string {
  // Client-side: use NEXT_PUBLIC_APP_URL or current origin
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
  }

  // Server-side: use NEXT_PUBLIC_APP_URL, NEXTAUTH_URL, or VERCEL_URL
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/**
 * Get the application name (white-label support).
 * Falls back to empty string - branding settings should take precedence.
 */
export function getAppName(): string {
  return process.env.NEXT_PUBLIC_APP_NAME || "";
}

/**
 * Build a full URL from a relative path.
 */
export function buildUrl(path: string): string {
  const base = getAppUrl();
  if (path.startsWith("http")) return path;
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}
