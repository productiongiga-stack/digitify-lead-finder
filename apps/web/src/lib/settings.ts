export type SettingsMap = Record<string, unknown> | undefined;

function parseRawSetting(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

export function readSettingString(
  settings: SettingsMap,
  key: string,
  fallback = "",
): string {
  const parsed = parseRawSetting(settings?.[key]);
  if (parsed === undefined || parsed === null) return fallback;
  if (typeof parsed === "string") return parsed;
  if (typeof parsed === "number" || typeof parsed === "boolean") return String(parsed);
  return fallback;
}

export function readSettingBoolean(
  settings: SettingsMap,
  key: string,
  fallback: boolean,
): boolean {
  const parsed = parseRawSetting(settings?.[key]);
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

export function readSettingNumber(
  settings: SettingsMap,
  key: string,
  fallback: number,
): number {
  const parsed = parseRawSetting(settings?.[key]);
  if (typeof parsed === "number" && Number.isFinite(parsed)) return parsed;
  if (typeof parsed === "string") {
    const value = Number(parsed);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}

export function readSettingList(
  settings: SettingsMap,
  key: string,
  fallback: string[] = [],
): string[] {
  const parsed = parseRawSetting(settings?.[key]);
  if (Array.isArray(parsed)) {
    return parsed.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof parsed === "string") {
    return parsed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return fallback;
}
