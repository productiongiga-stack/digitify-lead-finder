/**
 * Redis rate limit — runs when RUN_REDIS_INTEGRATION=1 and REDIS_URL is set.
 */
import { afterEach, describe, expect, it } from "vitest";
import { checkRateLimitDistributed } from "../lib/rate-limit-distributed";
import { resetRedisRateLimitClient } from "../lib/rate-limit-redis";

const runIntegration =
  process.env.RUN_REDIS_INTEGRATION === "1" && Boolean(process.env.REDIS_URL?.trim());

describe.skipIf(!runIntegration)("rate limit redis (integration)", () => {
  afterEach(() => {
    resetRedisRateLimitClient();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("enforces limit across calls via REDIS_URL", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const key = `integration:${Date.now()}`;
    const params = { key, limit: 2, windowMs: 60_000 };

    const r1 = await checkRateLimitDistributed(params);
    const r2 = await checkRateLimitDistributed(params);
    const r3 = await checkRateLimitDistributed(params);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(false);
  });
});
