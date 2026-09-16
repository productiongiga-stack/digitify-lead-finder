import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkUpstashRateLimit, getUpstashRestConfig } from "../lib/rate-limit-upstash";

describe("checkUpstashRateLimit", () => {
  const config = { url: "https://example.upstash.io", token: "test-token" };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.upstashredis_KV_REST_API_URL;
    delete process.env.upstashredis_KV_REST_API_TOKEN;
  });

  it("accepts the Vercel Upstash integration variable names", () => {
    process.env.upstashredis_KV_REST_API_URL = "https://example.upstash.io/";
    process.env.upstashredis_KV_REST_API_TOKEN = "integration-token";

    expect(getUpstashRestConfig()).toEqual({
      url: "https://example.upstash.io",
      token: "integration-token",
    });
  });

  it("ignores unresolved Vercel variable references", () => {
    process.env.UPSTASH_REDIS_REST_URL = "$upstashredis_KV_REST_API_URL";
    process.env.UPSTASH_REDIS_REST_TOKEN = "$upstashredis_KV_REST_API_TOKEN";
    process.env.upstashredis_KV_REST_API_URL = "https://example.upstash.io/";
    process.env.upstashredis_KV_REST_API_TOKEN = "integration-token";

    expect(getUpstashRestConfig()).toEqual({
      url: "https://example.upstash.io",
      token: "integration-token",
    });
  });

  it("allows until limit then blocks", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 1 }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: true }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 59_000 }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 2 }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 58_000 }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 3 }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 57_000 }) } as Response);

    const params = { key: "test-key", limit: 2, windowMs: 60_000 };
    const r1 = await checkUpstashRateLimit(params, config);
    const r2 = await checkUpstashRateLimit(params, config);
    const r3 = await checkUpstashRateLimit(params, config);

    expect(r1?.allowed).toBe(true);
    expect(r2?.allowed).toBe(true);
    expect(r3?.allowed).toBe(false);
    expect(r3?.remaining).toBe(0);
  });

  it("returns null when Upstash responds with error", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    const result = await checkUpstashRateLimit(
      { key: "x", limit: 5, windowMs: 1000 },
      config,
    );
    expect(result).toBeNull();
  });
});
