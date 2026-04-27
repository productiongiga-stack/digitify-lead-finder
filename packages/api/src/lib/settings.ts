import { revealSettingValue } from "@digitify/db";

export type SettingRow = { key: string; value: unknown };
export type SettingsMap = Record<string, unknown>;

function parseRawSetting(key: string, value: unknown): unknown {
  const revealed = revealSettingValue(key, value);
  const rawValue = revealed === undefined ? value : revealed;

  if (rawValue === null || rawValue === undefined) return undefined;
  if (typeof rawValue !== "string") return rawValue;

  const trimmed = rawValue.trim();
  if (!trimmed) return "";

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

export function settingsRowsToMap(rows: SettingRow[]): SettingsMap {
  return Object.fromEntries(rows.map((row) => [row.key, parseRawSetting(row.key, row.value)]));
}

export function getSettingString(
  settings: SettingsMap | SettingRow[],
  key: string,
  fallback = "",
): string {
  const map = Array.isArray(settings) ? settingsRowsToMap(settings) : settings;
  const parsed = parseRawSetting(key, map[key]);
  if (parsed === undefined || parsed === null) return fallback;
  if (typeof parsed === "string") return parsed;
  if (typeof parsed === "number" || typeof parsed === "boolean") return String(parsed);
  return fallback;
}

export function getSettingBoolean(
  settings: SettingsMap | SettingRow[],
  key: string,
  fallback: boolean,
): boolean {
  const map = Array.isArray(settings) ? settingsRowsToMap(settings) : settings;
  const parsed = parseRawSetting(key, map[key]);

  if (parsed === undefined || parsed === null) return fallback;
  if (typeof parsed === "boolean") return parsed;
  if (typeof parsed === "number") return parsed !== 0;
  if (typeof parsed === "string") {
    const normalized = parsed.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

export function getSettingNumber(
  settings: SettingsMap | SettingRow[],
  key: string,
  fallback: number,
): number {
  const map = Array.isArray(settings) ? settingsRowsToMap(settings) : settings;
  const parsed = parseRawSetting(key, map[key]);

  if (typeof parsed === "number" && Number.isFinite(parsed)) return parsed;
  if (typeof parsed === "string") {
    const value = Number(parsed);
    if (Number.isFinite(value)) return value;
  }

  return fallback;
}
