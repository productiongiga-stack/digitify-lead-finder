const PLACEHOLDER_RE = /^\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}$/;
const UNSAFE_SCHEME_RE = /^\s*(javascript|data|vbscript|file):/i;

/**
 * Returns true for https/http/mailto URLs, root-relative paths, and {{placeholders}}.
 */
export function isSafeCtaUrl(url: string | undefined | null): boolean {
  if (!url?.trim()) return false;
  const trimmed = url.trim();
  if (UNSAFE_SCHEME_RE.test(trimmed)) return false;
  if (PLACEHOLDER_RE.test(trimmed)) return true;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "mailto:";
  } catch {
    return false;
  }
}

/** Strips unsafe CTA URLs (javascript:, data:, etc.) before rendering or storing. */
export function sanitizeCtaUrl(url: string | undefined | null): string | undefined {
  if (!url?.trim()) return undefined;
  const trimmed = url.trim();
  return isSafeCtaUrl(trimmed) ? trimmed : undefined;
}
