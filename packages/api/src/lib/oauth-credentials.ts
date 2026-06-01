const GOOGLE_OAUTH_CLIENT_ID_RE = /^\d+-[\w-]+\.apps\.googleusercontent\.com$/;

export function sanitizeOAuthClientValue(value: string | null | undefined) {
  if (!value) return "";
  return value
    .trim()
    .replace(/["']/g, "")
    .replace(/,+$/g, "")
    .trim();
}

export function isValidGoogleOAuthClientId(clientId: string) {
  const normalized = sanitizeOAuthClientValue(clientId);
  return Boolean(normalized) && GOOGLE_OAUTH_CLIENT_ID_RE.test(normalized);
}

export function isValidGoogleOAuthClientSecret(clientSecret: string) {
  const normalized = sanitizeOAuthClientValue(clientSecret);
  return Boolean(normalized) && normalized.startsWith("GOCSPX-");
}

export function isValidMetaAppId(appId: string) {
  const normalized = sanitizeOAuthClientValue(appId);
  return /^\d{5,}$/.test(normalized);
}
