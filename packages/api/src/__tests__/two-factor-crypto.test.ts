import { describe, it, expect, afterEach, vi } from "vitest";
import { generate } from "otplib";
import { decryptFactor, encryptFactor, factorStep, makeFactor, opaqueToken, recoveryCodes, recoveryHash, checkPassword, upgradedPassword } from "../lib/two-factor-crypto";
afterEach(() => vi.unstubAllEnvs());
describe("authenticator cryptography", () => {
  it("encrypts with authenticated, personal, random envelopes and fails closed", () => {
    vi.stubEnv("TWO_FACTOR_ENCRYPTION_KEY", "a1".repeat(32));
    const a = encryptFactor("SECRET", "a"), b = encryptFactor("SECRET", "a");
    expect(a).not.toBe(b); expect(a).not.toContain("SECRET");
    expect(decryptFactor(a, "a")).toBe("SECRET");
    expect(() => decryptFactor(a, "b")).toThrow();
    expect(() => decryptFactor(a + "tamper", "a")).toThrow();
    vi.stubEnv("TWO_FACTOR_ENCRYPTION_KEY", ""); expect(() => encryptFactor("SECRET", "a")).toThrow();
  });
  it("matches the RFC6238 SHA1 vector, refuses replay and accepts only adjacent time windows", async () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(await factorStep(secret, "287082", -1n, 59000)).toBe(1n);
    expect(await factorStep(secret, "287082", 1n, 59000)).toBeNull();
    const next = await generate({ secret, epoch: 90, algorithm: "sha1", digits: 6, period: 30 });
    expect(await factorStep(secret, next, -1n, 60000)).toBe(3n);
    expect(await factorStep(secret, next, -1n, 30000)).toBeNull();
    expect(await factorStep(secret, "123", -1n, 59000)).toBeNull();
  });
  it("uses compatible otpauth URIs and cryptographically random, personal recovery codes", () => {
    expect(makeFactor("test@example.test").uri).toMatch(/^otpauth:\/\/totp\//);
    const codes = recoveryCodes(); expect(codes).toHaveLength(10); expect(new Set(codes).size).toBe(10);
    expect(recoveryHash("a", codes[0]!)).toBe(recoveryHash("a", codes[0]!.replace(/-/g, "").toLowerCase()));
    expect(recoveryHash("a", codes[0]!)).not.toBe(recoveryHash("b", codes[0]!));
    expect(opaqueToken()).toMatch(/^[\w-]{43}$/);
  });
  it("checks scrypt passwords without allowing malformed or wrong hashes", () => {
    const hash = upgradedPassword("test-password");
    expect(checkPassword("test-password", hash)).toBe(true); expect(checkPassword("wrong", hash)).toBe(false);
    expect(checkPassword("test-password", "invalid")).toBe(false);
  });
});
