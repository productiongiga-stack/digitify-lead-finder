import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  formatZodEnvError,
  resetServerEnvCache,
  validateServerEnv,
} from "../lib/server-env";
import { z } from "zod";

const BASE_ENV = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  NEXTAUTH_URL: "http://localhost:3000",
  NEXTAUTH_SECRET: "ci-nextauth-secret-min-32-chars-long",
};

describe("validateServerEnv", () => {
  const original = { ...process.env };

  beforeEach(() => {
    resetServerEnvCache();
    process.env = { ...original, ...BASE_ENV, NODE_ENV: "development" };
  });

  afterEach(() => {
    process.env = original;
    resetServerEnvCache();
  });

  it("accepts valid development env", () => {
    const env = validateServerEnv({ force: true });
    expect(env.DATABASE_URL).toBe(BASE_ENV.DATABASE_URL);
    expect(env.NEXTAUTH_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it("rejects missing DATABASE_URL", () => {
    delete process.env.DATABASE_URL;
    expect(() => validateServerEnv({ force: true })).toThrow(/DATABASE_URL/);
  });

  it("rejects short NEXTAUTH_SECRET", () => {
    process.env.NEXTAUTH_SECRET = "short";
    expect(() => validateServerEnv({ force: true })).toThrow(/32 characters/);
  });

  it("requires production secrets", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SETTINGS_ENCRYPTION_KEY;
    delete process.env.CRON_SECRET;
    expect(() => validateServerEnv({ force: true })).toThrow(
      /SETTINGS_ENCRYPTION_KEY|CRON_SECRET/,
    );

    process.env.SETTINGS_ENCRYPTION_KEY = "production-settings-encryption-key-32";
    expect(() => validateServerEnv({ force: true })).toThrow(/CRON_SECRET/);

    process.env.CRON_SECRET = "production-cron-secret";
    const env = validateServerEnv({ force: true });
    expect(env.CRON_SECRET).toBe("production-cron-secret");
  });

  it("skips validation in test runtime by default", () => {
    process.env.NODE_ENV = "test";
    delete process.env.DATABASE_URL;
    expect(() => validateServerEnv()).not.toThrow();
  });
});

describe("formatZodEnvError", () => {
  it("formats issue paths", () => {
    const error = z
      .object({ DATABASE_URL: z.string().min(1) })
      .safeParse({ DATABASE_URL: "" });
    if (error.success) throw new Error("expected failure");
    const message = formatZodEnvError(error.error);
    expect(message).toContain("DATABASE_URL");
    expect(message).toContain(".env.example");
  });
});
