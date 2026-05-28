import { type PrismaClient } from "@digitify/db";
import { settingsRowsToMap } from "./settings";
import {
  invalidateWorkspaceSettingsCache,
  loadWorkspaceSettingRows,
  resolveSettingDbKey,
  type WorkspaceScope,
} from "./workspace-settings";
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

/** JSON blobs stored in workspace scope (tasks, invoices, saved searches, …). */
export async function readWorkspaceJsonSetting<T>(
  db: PrismaClient,
  scope: WorkspaceScope,
  key: string,
  fallback: T,
): Promise<T> {
  const rows = await loadWorkspaceSettingRows(db, scope, [key]);
  const map = settingsRowsToMap(rows);
  const value = map[key];
  if (value === undefined || value === null) return fallback;
  return value as T;
}

export async function writeWorkspaceJsonSetting(
  db: PrismaClient,
  scope: WorkspaceScope,
  key: string,
  value: unknown,
) {
  const payload = JSON.stringify(value);
  const storageKey = resolveSettingDbKey(scope, key);
  const result = await db.setting.upsert({
    where: { key: storageKey },
    create: { key: storageKey, value: payload },
    update: { value: payload },
  });
  invalidateWorkspaceSettingsCache(scope);
  return result;
}
