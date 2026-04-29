import { randomBytes } from "node:crypto";
import { type PrismaClient } from "@digitify/db";
import { userSettingKey } from "./user-settings";

export const PUBLIC_TENANT_SETTING_KEY = "chatbot.public_tenant_token";
const TOKEN_CACHE_TTL_MS = 30 * 60 * 1000;
const tokenCache = new Map<string, { token: string; cachedAt: number }>();

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,120}$/;

function parseSettingString(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string") return parsed.trim();
    } catch {
      // raw string
    }
    return raw;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function extractUserIdFromScopedSettingKey(key: string, settingKey = PUBLIC_TENANT_SETTING_KEY) {
  const prefix = "user:";
  const suffix = `:${settingKey}`;
  if (!key.startsWith(prefix) || !key.endsWith(suffix)) return null;
  const userId = key.slice(prefix.length, key.length - suffix.length).trim();
  return userId || null;
}

export function normalizePublicTenantToken(rawTenant: string | null | undefined) {
  const token = rawTenant?.trim() || "";
  if (!token) return "";
  if (!TOKEN_PATTERN.test(token)) return "";
  return token;
}

export async function ensurePublicTenantToken(db: PrismaClient, userId: string) {
  const cached = tokenCache.get(userId);
  if (cached && Date.now() - cached.cachedAt < TOKEN_CACHE_TTL_MS) {
    return cached.token;
  }

  const scopedKey = userSettingKey(userId, PUBLIC_TENANT_SETTING_KEY);
  const existing = await db.setting.findUnique({
    where: { key: scopedKey },
    select: { value: true },
  });
  const currentToken = parseSettingString(existing?.value);
  if (normalizePublicTenantToken(currentToken)) {
    tokenCache.set(userId, { token: currentToken, cachedAt: Date.now() });
    return currentToken;
  }

  const token = randomBytes(24).toString("base64url");
  await db.setting.upsert({
    where: { key: scopedKey },
    create: { key: scopedKey, value: token },
    update: { value: token },
  });
  tokenCache.set(userId, { token, cachedAt: Date.now() });
  return token;
}

export async function resolveUserIdFromPublicTenantToken(
  db: PrismaClient,
  rawTenant: string | null | undefined,
) {
  const token = normalizePublicTenantToken(rawTenant);
  if (!token) return null;

  const row = await db.setting.findFirst({
    where: {
      key: { endsWith: `:${PUBLIC_TENANT_SETTING_KEY}` },
      value: token as any,
    },
    select: { key: true },
  });
  if (!row) return null;

  return extractUserIdFromScopedSettingKey(row.key);
}

export async function resolveDefaultPublicTenantUserId(db: PrismaClient) {
  const owner = await db.user.findFirst({
    where: { role: "OWNER" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (owner?.id) return owner.id;

  const admin = await db.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return admin?.id || null;
}

export async function resolvePublicTenantUserId(
  db: PrismaClient,
  rawTenant: string | null | undefined,
) {
  const token = normalizePublicTenantToken(rawTenant);
  if (token) return resolveUserIdFromPublicTenantToken(db, token);
  return resolveDefaultPublicTenantUserId(db);
}
