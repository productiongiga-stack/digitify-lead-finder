import { type PrismaClient } from "@digitify/db";
import { settingsRowsToMap } from "./settings";
import { invalidateUserSettingsCache, loadUserSettingRows, userSettingKey } from "./user-settings";

export async function readUserJsonSetting<T>(
  db: PrismaClient,
  userId: string,
  key: string,
  fallback: T,
): Promise<T> {
  const rows = await loadUserSettingRows(db, userId, [key]);
  const map = settingsRowsToMap(rows);
  const value = map[key];
  if (value === undefined || value === null) return fallback;
  return value as T;
}

export async function writeUserJsonSetting(
  db: PrismaClient,
  userId: string,
  key: string,
  value: unknown,
) {
  const payload = JSON.stringify(value);
  const result = await db.setting.upsert({
    where: { key: userSettingKey(userId, key) },
    create: { key: userSettingKey(userId, key), value: payload },
    update: { value: payload },
  });
  invalidateUserSettingsCache(userId);
  return result;
}
