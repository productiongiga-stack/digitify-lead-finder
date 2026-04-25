import { type PrismaClient } from "@digitify/db";
import { type SettingRow } from "./settings";

export function userSettingKey(userId: string, key: string) {
  return key.trim();
}

export function stripUserSettingKey(userId: string, key: string) {
  return key.trim();
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
    const rows = await db.setting.findMany({ where: { userId, key: { in: scopedKeys } } });
    return stripUserSettingRows(userId, rows);
  }

  const rows = await db.setting.findMany({ where: { userId } });
  return stripUserSettingRows(userId, rows);
}
