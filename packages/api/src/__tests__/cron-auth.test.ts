import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { cronAuthFailureReason, isCronAuthorized } from "../lib/cron-auth";

function makeRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/cron/drip", { headers });
}

describe("cron-auth", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  beforeEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.CRON_ALLOW_UNSIGNED_DEV;
    process.env.NODE_ENV = "test";
  });

  it("rejects production requests without CRON_SECRET", () => {
    process.env.NODE_ENV = "production";
    expect(isCronAuthorized(makeRequest())).toBe(false);
    expect(cronAuthFailureReason()).toContain("CRON_SECRET");
  });

  it("accepts production requests with valid bearer", () => {
    process.env.NODE_ENV = "production";
    process.env.CRON_SECRET = "test-secret";
    expect(
      isCronAuthorized(
        makeRequest({ authorization: "Bearer test-secret" }),
      ),
    ).toBe(true);
  });

  it("rejects invalid bearer even in development", () => {
    process.env.CRON_SECRET = "test-secret";
    expect(isCronAuthorized(makeRequest({ authorization: "Bearer wrong" }))).toBe(false);
  });

  it("allows unsigned dev only when explicitly enabled", () => {
    expect(isCronAuthorized(makeRequest())).toBe(false);
    process.env.CRON_ALLOW_UNSIGNED_DEV = "1";
    expect(isCronAuthorized(makeRequest())).toBe(true);
  });
});
