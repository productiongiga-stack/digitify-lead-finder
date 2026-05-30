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
const ACCOUNT_SETTING_PREFIXES = ["branding.", "company.", "email."];
const ADMIN_SETTING_PREFIXES = ["bookings.", "reviews.", "quotes.", "chatbot.", ...PERSONAL_SETTING_PREFIXES];
const MEMBER_SETTING_PREFIXES = ["bookings.", "reviews.", "quotes.", "chatbot.", "pipeline.", "scoring.", ...PERSONAL_SETTING_PREFIXES];
const OWNER_SETTING_PREFIXES = ["api.", "openclaw.", "seo."];
/** Workspace-wide booking timezone; only the workspace owner may change it. */
const OWNER_ONLY_SETTING_KEYS = new Set(["bookings.google_calendar_timezone"]);

export function normalizeRole(role: string | null | undefined): AppRole {
  if (
    role === "OWNER" ||
    role === "ADMIN" ||
    role === "MODERATOR" ||
    role === "MEMBER" ||
    role === "TRIAL" ||
    role === "TESTER" ||
    role === "VIEWER"
  ) return role;
  return "MEMBER";
}

function keyStartsWith(key: string, prefixes: string[]) {
  return prefixes.some((prefix) => key.startsWith(prefix));
}

export function canReadSettingKey(roleValue: string | null | undefined, key: string) {
  const role = normalizeRole(roleValue);
  if (role === "OWNER") return true;
  if (role !== "VIEWER" && keyStartsWith(key, ACCOUNT_SETTING_PREFIXES)) return true;
  if (VISUAL_SETTING_KEYS.has(key) || keyStartsWith(key, PERSONAL_SETTING_PREFIXES)) return true;
  if (role === "ADMIN") return keyStartsWith(key, ADMIN_SETTING_PREFIXES) && !keyStartsWith(key, OWNER_SETTING_PREFIXES);
  if (role === "MEMBER") return keyStartsWith(key, MEMBER_SETTING_PREFIXES) && !keyStartsWith(key, OWNER_SETTING_PREFIXES);
  if (role === "MODERATOR") return keyStartsWith(key, ["reviews.", "chatbot.", "quotes.", ...PERSONAL_SETTING_PREFIXES]);
  if (role === "TESTER") return keyStartsWith(key, PERSONAL_SETTING_PREFIXES);
  if (role === "TRIAL") return keyStartsWith(key, PERSONAL_SETTING_PREFIXES);
  return false;
}

export function canManageSettingKey(roleValue: string | null | undefined, key: string) {
  const role = normalizeRole(roleValue);
  if (OWNER_ONLY_SETTING_KEYS.has(key)) return role === "OWNER";
  if (role === "OWNER") return true;
  if (role !== "VIEWER" && keyStartsWith(key, ACCOUNT_SETTING_PREFIXES)) return true;
  if (role === "ADMIN") return keyStartsWith(key, ADMIN_SETTING_PREFIXES) && !keyStartsWith(key, OWNER_SETTING_PREFIXES);
  if (role === "MEMBER") return keyStartsWith(key, MEMBER_SETTING_PREFIXES) && !keyStartsWith(key, OWNER_SETTING_PREFIXES);
  if (role === "MODERATOR") return keyStartsWith(key, ["reviews.", "chatbot.", ...PERSONAL_SETTING_PREFIXES]);
  if (role === "TESTER") return keyStartsWith(key, PERSONAL_SETTING_PREFIXES);
  if (role === "TRIAL") return keyStartsWith(key, PERSONAL_SETTING_PREFIXES);
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
  if (role === "ADMIN") return targetRole === "MEMBER" || targetRole === "TRIAL" || targetRole === "TESTER" || targetRole === "VIEWER";
  return false;
}
