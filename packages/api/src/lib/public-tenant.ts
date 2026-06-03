import { randomBytes } from "node:crypto";
import { type PrismaClient } from "@digitify/db";
import { userSettingKey } from "./user-settings";
import { workspaceSettingKey } from "./workspace-settings";

export const PUBLIC_TENANT_SETTING_KEY = "chatbot.public_tenant_token";
export const PUBLIC_TENANT_LOOKUP_PREFIX = "public_tenant_lookup:";
const TOKEN_CACHE_TTL_MS = 30 * 60 * 1000;
const RESOLVE_CACHE_TTL_MS = 5 * 60 * 1000;
const tokenCache = new Map<string, { token: string; cachedAt: number }>();
const resolveCache = new Map<string, { ownerId: string; cachedAt: number }>();

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

/** @deprecated Use extractTenantOwnerIdFromSettingKey */
export function extractUserIdFromScopedSettingKey(key: string, settingKey = PUBLIC_TENANT_SETTING_KEY) {
  return extractTenantOwnerIdFromSettingKey(key, settingKey);
}

/** Workspace owner id from user: or workspace: scoped setting keys. */
export function extractTenantOwnerIdFromSettingKey(key: string, settingKey = PUBLIC_TENANT_SETTING_KEY) {
  const suffix = `:${settingKey}`;
  if (!key.endsWith(suffix)) return null;

  const userPrefix = "user:";
  if (key.startsWith(userPrefix)) {
    const userId = key.slice(userPrefix.length, key.length - suffix.length).trim();
    return userId || null;
  }

  const workspacePrefix = "workspace:";
  if (key.startsWith(workspacePrefix)) {
    const workspaceId = key.slice(workspacePrefix.length, key.length - suffix.length).trim();
    return workspaceId || null;
  }

  return null;
}

export function normalizePublicTenantToken(rawTenant: string | null | undefined) {
  const token = rawTenant?.trim() || "";
  if (!token) return "";
  if (!TOKEN_PATTERN.test(token)) return "";
  return token;
}

function tenantSettingKeys(workspaceOwnerId: string) {
  return [
    userSettingKey(workspaceOwnerId, PUBLIC_TENANT_SETTING_KEY),
    workspaceSettingKey(workspaceOwnerId, PUBLIC_TENANT_SETTING_KEY),
  ];
}

export function publicTenantLookupKey(token: string) {
  return `${PUBLIC_TENANT_LOOKUP_PREFIX}${token}`;
}

async function writePublicTenantLookup(db: PrismaClient, token: string, ownerId: string) {
  await db.setting.upsert({
    where: { key: publicTenantLookupKey(token) },
    create: { key: publicTenantLookupKey(token), value: ownerId },
    update: { value: ownerId },
  });
  resolveCache.set(token, { ownerId, cachedAt: Date.now() });
}

async function syncTenantTokenKeys(db: PrismaClient, workspaceOwnerId: string, token: string) {
  await Promise.all([
    ...tenantSettingKeys(workspaceOwnerId).map((key) =>
      db.setting.upsert({
        where: { key },
        create: { key, value: token },
        update: { value: token },
      }),
    ),
    writePublicTenantLookup(db, token, workspaceOwnerId),
  ]);
}

export async function ensurePublicTenantToken(db: PrismaClient, userId: string) {
  const cached = tokenCache.get(userId);
  if (cached && Date.now() - cached.cachedAt < TOKEN_CACHE_TTL_MS) {
    return cached.token;
  }

  const rows = await db.setting.findMany({
    where: { key: { in: tenantSettingKeys(userId) } },
    select: { key: true, value: true },
  });

  for (const row of rows) {
    const currentToken = normalizePublicTenantToken(parseSettingString(row.value));
    if (currentToken) {
      await syncTenantTokenKeys(db, userId, currentToken);
      tokenCache.set(userId, { token: currentToken, cachedAt: Date.now() });
      return currentToken;
    }
  }

  const token = randomBytes(24).toString("base64url");
  await syncTenantTokenKeys(db, userId, token);
  tokenCache.set(userId, { token, cachedAt: Date.now() });
  return token;
}

async function resolveOwnerIdFromLookupTable(db: PrismaClient, token: string) {
  const cached = resolveCache.get(token);
  if (cached && Date.now() - cached.cachedAt < RESOLVE_CACHE_TTL_MS) {
    return cached.ownerId;
  }

  const row = await db.setting.findUnique({
    where: { key: publicTenantLookupKey(token) },
    select: { value: true },
  });
  const ownerId = parseSettingString(row?.value);
  if (ownerId) {
    resolveCache.set(token, { ownerId, cachedAt: Date.now() });
    return ownerId;
  }
  return null;
}

async function resolveOwnerIdFromLegacyScan(db: PrismaClient, token: string) {
  const rows = await db.setting.findMany({
    where: {
      key: { endsWith: `:${PUBLIC_TENANT_SETTING_KEY}` },
    },
    select: { key: true, value: true },
  });

  for (const row of rows) {
    if (parseSettingString(row.value) !== token) continue;
    const ownerId = extractTenantOwnerIdFromSettingKey(row.key);
    if (!ownerId) continue;
    await writePublicTenantLookup(db, token, ownerId).catch(() => null);
    return ownerId;
  }
  return null;
}

export async function resolveUserIdFromPublicTenantToken(
  db: PrismaClient,
  rawTenant: string | null | undefined,
) {
  const token = normalizePublicTenantToken(rawTenant);
  if (!token) return null;

  try {
    const fromLookup = await resolveOwnerIdFromLookupTable(db, token);
    if (fromLookup) return fromLookup;
    return resolveOwnerIdFromLegacyScan(db, token);
  } catch (error) {
    console.error("[public-tenant] resolveUserIdFromPublicTenantToken failed", error);
    return null;
  }
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
  if (!token) return null;
  return resolveUserIdFromPublicTenantToken(db, token);
}

/** Single-tenant marketing/footer fallback when PUBLIC_MARKETING_WORKSPACE_ID is unset. */
export async function resolveMarketingWorkspaceOwnerId(db: PrismaClient) {
  const fromEnv = process.env.PUBLIC_MARKETING_WORKSPACE_ID?.trim();
  if (fromEnv) return fromEnv;
  return resolveDefaultPublicTenantUserId(db);
}
