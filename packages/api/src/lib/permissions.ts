import { TRPCError } from "@trpc/server";
import { type AppRole } from "../trpc";

const VISUAL_SETTING_KEYS = new Set([
  "branding.company_name",
  "branding.company_slogan",
  "branding.logo_url",
  "branding.favicon_url",
  "branding.primary_color",
]);

const PERSONAL_SETTING_PREFIXES = ["ui.", "display."];
const ADMIN_SETTING_PREFIXES = ["bookings.", "reviews.", "quotes.", "chatbot.", ...PERSONAL_SETTING_PREFIXES];
const OWNER_SETTING_PREFIXES = ["api.", "email.", "branding.", "company.", "openclaw."];

export function normalizeRole(role: string | null | undefined): AppRole {
  if (role === "OWNER" || role === "ADMIN" || role === "VIEWER") return role;
  return "MEMBER";
}

function keyStartsWith(key: string, prefixes: string[]) {
  return prefixes.some((prefix) => key.startsWith(prefix));
}

export function canReadSettingKey(roleValue: string | null | undefined, key: string) {
  const role = normalizeRole(roleValue);
  if (role === "OWNER") return true;
  if (VISUAL_SETTING_KEYS.has(key) || keyStartsWith(key, PERSONAL_SETTING_PREFIXES)) return true;
  if (role === "ADMIN") return keyStartsWith(key, ADMIN_SETTING_PREFIXES) && !keyStartsWith(key, OWNER_SETTING_PREFIXES);
  return false;
}

export function canManageSettingKey(roleValue: string | null | undefined, key: string) {
  const role = normalizeRole(roleValue);
  if (role === "OWNER") return true;
  if (role === "ADMIN") return keyStartsWith(key, ADMIN_SETTING_PREFIXES) && !keyStartsWith(key, OWNER_SETTING_PREFIXES);
  return keyStartsWith(key, PERSONAL_SETTING_PREFIXES);
}

export function assertCanManageSettingKey(role: string | null | undefined, key: string) {
  if (!canManageSettingKey(role, key)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Je rol heeft geen rechten om deze instelling te wijzigen.",
    });
  }
}

export function filterReadableSettingsForRole<T>(role: string | null | undefined, settings: Record<string, T>) {
  return Object.fromEntries(
    Object.entries(settings).filter(([key]) => canReadSettingKey(role, key)),
  );
}

export function canApproveRole(approverRole: string | null | undefined, targetRole: AppRole) {
  const role = normalizeRole(approverRole);
  if (role === "OWNER") return true;
  if (role === "ADMIN") return targetRole === "MEMBER" || targetRole === "VIEWER";
  return false;
}
