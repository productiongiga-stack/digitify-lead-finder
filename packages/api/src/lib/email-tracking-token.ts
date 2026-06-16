import { createHmac, timingSafeEqual } from "node:crypto";

function getTrackingSecret() {
  const secret = process.env.EMAIL_TRACKING_TOKEN_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) throw new Error("EMAIL_TRACKING_TOKEN_SECRET or NEXTAUTH_SECRET must be set");
  return secret;
}

function signPayload(payload: string) {
  return createHmac("sha256", getTrackingSecret()).update(payload).digest("base64url");
}

export function createEmailTrackingToken(draftId: string) {
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 365;
  const payload = `${draftId}.${expiresAt}`;
  const signature = signPayload(payload);
  return `${expiresAt}.${signature}`;
}

export function verifyEmailTrackingToken(draftId: string, token: string | null | undefined) {
  if (!token) return false;
  const [expiresRaw, signature] = token.split(".");
  const expiresAt = Number(expiresRaw);
  if (!expiresRaw || !signature || !Number.isFinite(expiresAt)) return false;
  if (Date.now() > expiresAt) return false;

  const payload = `${draftId}.${expiresAt}`;
  const expected = signPayload(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
