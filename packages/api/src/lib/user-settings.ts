import { type PrismaClient } from "@digitify/db";
import { type SettingRow } from "./settings";

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

export async function loadUserSettingRows(
  db: PrismaClient,
  userId: string,
  keys?: string[],
): Promise<SettingRow[]> {
  if (keys?.length) {
    const scopedKeys = keys.map((key) => userSettingKey(userId, key));
    const rows = await db.setting.findMany({ where: { key: { in: scopedKeys } } });
    return stripUserSettingRows(userId, rows);
  }

  const rows = await db.setting.findMany({
    where: { key: { startsWith: `user:${userId}:` } },
  });
  return stripUserSettingRows(userId, rows);
}
