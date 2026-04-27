import { randomBytes } from "node:crypto";
import { type PrismaClient } from "@digitify/db";
import { userSettingKey } from "./user-settings";

export const PUBLIC_TENANT_SETTING_KEY = "chatbot.public_tenant_token";

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
  const scopedKey = userSettingKey(userId, PUBLIC_TENANT_SETTING_KEY);
  const existing = await db.setting.findUnique({
    where: { key: scopedKey },
    select: { value: true },
  });
  const currentToken = parseSettingString(existing?.value);
  if (normalizePublicTenantToken(currentToken)) return currentToken;

  const token = randomBytes(24).toString("base64url");
  await db.setting.upsert({
    where: { key: scopedKey },
    create: { key: scopedKey, value: token },
    update: { value: token },
  });
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
