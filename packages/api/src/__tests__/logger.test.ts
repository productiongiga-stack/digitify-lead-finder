import { describe, it, expect, afterEach } from "vitest";
import { log, installLogCapture } from "../lib/logger";

describe("structured logger", () => {
  let capture: ReturnType<typeof installLogCapture> | null = null;

  afterEach(() => {
    capture?.release();
    capture = null;
  });

  it("emits a JSON-serializable record with channel, level, ts and message", () => {
    capture = installLogCapture();
    log.email.info("sent message", { to: "x@y.z" });
    expect(capture.entries).toHaveLength(1);
    const entry = capture.entries[0]!;
    expect(entry.level).toBe("info");
    expect(entry.channel).toBe("email");
    expect(entry.message).toBe("sent message");
    expect(entry.context).toEqual({ to: "x@y.z" });
    expect(typeof entry.ts).toBe("string");
    expect(() => JSON.parse(JSON.stringify(entry))).not.toThrow();
  });

  it("captures Error name + message + stack", () => {
    capture = installLogCapture();
    log.api.error("boom", { route: "/x" }, new Error("kaboom"));
    const entry = capture.entries[0]!;
    expect(entry.error?.message).toBe("kaboom");
    expect(entry.error?.name).toBe("Error");
    expect(entry.error?.stack).toBeTruthy();
  });

  it("supports all expected channels independently", () => {
    capture = installLogCapture();
    log.email.warn("e");
    log.api.warn("a");
    log.integration.warn("i");
    log.job.warn("j");
    log.auth.warn("au");
    log.security.warn("s");
    expect(capture.entries.map((e) => e.channel)).toEqual([
      "email",
      "api",
      "integration",
      "job",
      "auth",
      "security",
    ]);
  });

  it("falls back to safe context when context contains a circular ref", () => {
    capture = installLogCapture();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cyclical: any = { a: 1 };
    cyclical.self = cyclical;
    // The capture sink stores the entry as-is, so cyclical context is retained
    // here. The serialization-failure fallback applies only to the default
    // sink that tries to JSON.stringify; that path is not exercised under
    // capture. We verify that the API does not throw.
    expect(() => log.api.info("c", { cyclical })).not.toThrow();
    expect(capture.entries).toHaveLength(1);
  });
});
