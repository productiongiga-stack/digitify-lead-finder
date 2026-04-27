import { z } from "zod";

/**
 * Minimum password strength requirements.
 *
 * Rules:
 *  - at least 10 characters
 *  - at least one lowercase letter
 *  - at least one uppercase letter
 *  - at least one digit
 *  - not in a small embedded list of obviously-weak passwords
 *
 * The list intentionally stays tiny (no full HIBP integration) to keep this
 * dependency-free; it catches the common copy-paste passwords that show up in
 * leaked-credential bot floods.
 */
const COMMON_WEAK = new Set([
  "password",
  "password1",
  "password123",
  "passw0rd",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyuiop",
  "letmein123",
  "welcome123",
  "admin123",
  "admin1234",
  "changeme",
  "changeme1",
  "iloveyou",
  "passw0rd1",
]);

export const PASSWORD_REQUIREMENTS = {
  minLength: 10,
  needsLower: true,
  needsUpper: true,
  needsDigit: true,
} as const;

export interface PasswordCheckResult {
  ok: boolean;
  reason?: string;
}

export function checkPasswordPolicy(password: string): PasswordCheckResult {
  if (typeof password !== "string") return { ok: false, reason: "Wachtwoord ontbreekt." };
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    return { ok: false, reason: `Wachtwoord moet minimaal ${PASSWORD_REQUIREMENTS.minLength} tekens lang zijn.` };
  }
  if (!/[a-z]/.test(password)) {
    return { ok: false, reason: "Wachtwoord moet minimaal één kleine letter bevatten." };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, reason: "Wachtwoord moet minimaal één hoofdletter bevatten." };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, reason: "Wachtwoord moet minimaal één cijfer bevatten." };
  }
  if (COMMON_WEAK.has(password.toLowerCase())) {
    return { ok: false, reason: "Dit wachtwoord komt voor in lijsten van veelgebruikte wachtwoorden. Kies iets unieker." };
  }
  return { ok: true };
}

/** Zod refinement that enforces the password policy and returns its reason as the issue message. */
export const passwordPolicySchema = z.string().superRefine((value, ctx) => {
  const result = checkPasswordPolicy(value);
  if (!result.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.reason ?? "Wachtwoord voldoet niet." });
  }
});
