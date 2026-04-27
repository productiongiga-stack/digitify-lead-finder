import { type PrismaClient } from "@digitify/db";
import { type SettingRow } from "./settings";

const SETTINGS_CACHE_TTL_MS = 45_000;
const SETTINGS_CACHE_MAX_ENTRIES = 500;

type CachedRows = {
  expiresAt: number;
  rows: SettingRow[];
};

const settingsCache = new Map<string, CachedRows>();

export function userSettingKey(userId: string, key: string) {
  return `user:${userId}:${key.trim()}`;
}

export function stripUserSettingKey(userId: string, key: string) {
  const prefix = `user:${userId}:`;
  return key.startsWith(prefix) ? key.slice(prefix.length) : key;
}

export function stripUserSettingRows(userId: string, rows: SettingRow[]): SettingRow[] {
  return rows.map((row) => ({
    ...row,
    key: stripUserSettingKey(userId, row.key),
  }));
}

function makeCacheKey(userId: string, keys?: string[]) {
  if (!keys?.length) return `${userId}|*`;
  const normalized = Array.from(
    new Set(keys.map((key) => key.trim()).filter(Boolean)),
  ).sort();
  if (normalized.length === 0) return `${userId}|*`;
  return `${userId}|${normalized.join("|")}`;
}

function cloneRows(rows: SettingRow[]) {
  return rows.map((row) => ({ ...row }));
}

function readCache(cacheKey: string): SettingRow[] | null {
  const hit = settingsCache.get(cacheKey);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    settingsCache.delete(cacheKey);
    return null;
  }
  return cloneRows(hit.rows);
}

function writeCache(cacheKey: string, rows: SettingRow[]) {
  settingsCache.set(cacheKey, {
    expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS,
    rows: cloneRows(rows),
  });
  if (settingsCache.size <= SETTINGS_CACHE_MAX_ENTRIES) return;

  const now = Date.now();
  for (const [key, value] of settingsCache) {
    if (value.expiresAt <= now) settingsCache.delete(key);
  }
  while (settingsCache.size > SETTINGS_CACHE_MAX_ENTRIES) {
    const oldestKey = settingsCache.keys().next().value;
    if (!oldestKey) break;
    settingsCache.delete(oldestKey);
  }
}

function filterRowsByKeys(rows: SettingRow[], keys: string[]) {
  const allowed = new Set(keys.map((key) => key.trim()).filter(Boolean));
  if (allowed.size === 0) return rows;
  return rows.filter((row) => allowed.has(row.key));
}

export function invalidateUserSettingsCache(userId: string) {
  const prefix = `${userId}|`;
  for (const cacheKey of settingsCache.keys()) {
    if (cacheKey.startsWith(prefix)) settingsCache.delete(cacheKey);
  }
}

export async function loadUserSettingRows(
  db: PrismaClient,
  userId: string,
  keys?: string[],
): Promise<SettingRow[]> {
  const normalizedKeys = keys?.map((key) => key.trim()).filter(Boolean);
  const exactCacheKey = makeCacheKey(userId, normalizedKeys);
  const exactHit = readCache(exactCacheKey);
  if (exactHit) return exactHit;

  if (normalizedKeys?.length) {
    const allHit = readCache(makeCacheKey(userId));
    if (allHit) {
      const filtered = filterRowsByKeys(allHit, normalizedKeys);
      writeCache(exactCacheKey, filtered);
      return filtered;
    }

    const scopedKeys = normalizedKeys.map((key) => userSettingKey(userId, key));
    const rows = await db.setting.findMany({ where: { key: { in: scopedKeys } } });
    const stripped = stripUserSettingRows(userId, rows);
    writeCache(exactCacheKey, stripped);
    return stripped;
  }

  const rows = await db.setting.findMany({
    where: { key: { startsWith: `user:${userId}:` } },
  });
  const stripped = stripUserSettingRows(userId, rows);
  writeCache(exactCacheKey, stripped);
  return stripped;
}
