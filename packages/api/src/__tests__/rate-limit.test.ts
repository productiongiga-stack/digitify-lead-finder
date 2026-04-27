import { describe, it, expect } from "vitest";
import { createBucketStore } from "../lib/rate-limit-bucket";

describe("rate-limit bucket", () => {
  it("allows requests under the limit", () => {
    const store = createBucketStore();
    const params = { key: "k", limit: 3, windowMs: 60_000, now: 1_000 };
    const r1 = store.check(params);
    const r2 = store.check({ ...params, now: 1_010 });
    const r3 = store.check({ ...params, now: 1_020 });
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("denies requests beyond the limit until the window resets", () => {
    const store = createBucketStore();
    const params = { key: "k", limit: 2, windowMs: 1_000, now: 1_000 };
    store.check(params);
    store.check({ ...params, now: 1_100 });
    const denied = store.check({ ...params, now: 1_200 });
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.resetAt).toBe(2_000);
  });

  it("resets the bucket after the window expires", () => {
    const store = createBucketStore();
    const params = { key: "k", limit: 1, windowMs: 500, now: 1_000 };
    store.check(params);
    const beforeReset = store.check({ ...params, now: 1_400 });
    expect(beforeReset.allowed).toBe(false);
    const afterReset = store.check({ ...params, now: 1_600 });
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.resetAt).toBe(1_600 + 500);
  });

  it("isolates buckets by key", () => {
    const store = createBucketStore();
    const a = store.check({ key: "a", limit: 1, windowMs: 1_000, now: 1_000 });
    const b = store.check({ key: "b", limit: 1, windowMs: 1_000, now: 1_000 });
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
    const a2 = store.check({ key: "a", limit: 1, windowMs: 1_000, now: 1_010 });
    expect(a2.allowed).toBe(false);
    const b2 = store.check({ key: "b", limit: 1, windowMs: 1_000, now: 1_010 });
    expect(b2.allowed).toBe(false);
  });

  it("garbage-collects expired buckets opportunistically", () => {
    const store = createBucketStore();
    store.check({ key: "stale", limit: 1, windowMs: 100, now: 1_000 });
    expect(store.size()).toBe(1);
    // First call after expiry should prune the stale bucket.
    store.check({ key: "fresh", limit: 1, windowMs: 1_000, now: 5_000 });
    // Stale bucket pruned, fresh bucket retained.
    expect(store.size()).toBe(1);
  });
});
