import { describe, it, expect } from "vitest";
import { checkPasswordPolicy, passwordPolicySchema, PASSWORD_REQUIREMENTS } from "../lib/password-policy";

describe("checkPasswordPolicy", () => {
  it("rejects passwords shorter than the minimum length", () => {
    const short = "Aa1bcde9"; // 8 chars, min is 10
    expect(short.length).toBeLessThan(PASSWORD_REQUIREMENTS.minLength);
    const result = checkPasswordPolicy(short);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/minimaal/);
  });

  it("rejects passwords with no lowercase letter", () => {
    expect(checkPasswordPolicy("PASSWORD123!").ok).toBe(false);
  });

  it("rejects passwords with no uppercase letter", () => {
    expect(checkPasswordPolicy("password123!").ok).toBe(false);
  });

  it("rejects passwords with no digit", () => {
    expect(checkPasswordPolicy("Passwordabcd").ok).toBe(false);
  });

  it("rejects common weak passwords even when they meet character classes", () => {
    // "Welcome123" passes length (10), case classes, and digit — but its
    // lowercased form is in the weak list.
    const result = checkPasswordPolicy("Welcome123");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/veelgebruikt/);
  });

  it("accepts passwords meeting all requirements", () => {
    expect(checkPasswordPolicy("CorrectHorse9Battery").ok).toBe(true);
  });

  it("rejects non-string input", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(checkPasswordPolicy(undefined as any).ok).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(checkPasswordPolicy(null as any).ok).toBe(false);
  });
});

describe("passwordPolicySchema", () => {
  it("returns the policy reason as the Zod issue message", () => {
    const result = passwordPolicySchema.safeParse("short");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/minimaal/);
    }
  });

  it("passes valid passwords", () => {
    expect(passwordPolicySchema.safeParse("CorrectHorse9Battery").success).toBe(true);
  });
});
