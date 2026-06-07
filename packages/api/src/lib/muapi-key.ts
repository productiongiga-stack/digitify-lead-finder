import { type PrismaClient, protectSettingValue, revealSettingValue } from "@digitify/db";
import { getSettingString, settingsRowsToMap } from "./settings";
import { invalidateUserSettingsCache, loadUserSettingRows } from "./user-settings";

export const MUAPI_KEY_SETTING = "api.muapi_key";

export async function loadUserMuapiKey(db: PrismaClient, userId: string): Promise<string> {
  const rows = await loadUserSettingRows(db, userId, [MUAPI_KEY_SETTING]);
  const settings = settingsRowsToMap(rows);
  const stored = getSettingString(settings, MUAPI_KEY_SETTING, "");
  const revealed = revealSettingValue(MUAPI_KEY_SETTING, stored);
  return typeof revealed === "string" ? revealed.trim() : "";
}

export async function saveUserMuapiKey(db: PrismaClient, userId: string, apiKey: string) {
  const protectedValue = protectSettingValue(MUAPI_KEY_SETTING, apiKey.trim());
  const dbKey = `user:${userId}:${MUAPI_KEY_SETTING}`;
  await db.setting.upsert({
    where: { key: dbKey },
    create: { key: dbKey, value: protectedValue as string },
    update: { value: protectedValue as string },
  });
  invalidateUserSettingsCache(userId);
}

export async function clearUserMuapiKey(db: PrismaClient, userId: string) {
  const dbKey = `user:${userId}:${MUAPI_KEY_SETTING}`;
  await db.setting.deleteMany({ where: { key: dbKey } });
  invalidateUserSettingsCache(userId);
}

export async function requireUserMuapiKey(db: PrismaClient, userId: string): Promise<string> {
  const apiKey = await loadUserMuapiKey(db, userId);
  if (!apiKey) {
    throw new Error("MuAPI API-key niet ingesteld. Voeg je sleutel toe in Instellingen.");
  }
  return apiKey;
}
