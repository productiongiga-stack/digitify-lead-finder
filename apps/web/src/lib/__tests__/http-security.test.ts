import { describe, expect, it } from "vitest";
import { getClientIp } from "../http-security";

describe("getClientIp", () => {
  it("uses the Cloudflare visitor IP for a marked proxied request", () => {
    const request = new Request("https://example.test", {
      headers: {
        "cf-connecting-ip": "203.0.113.10",
        "cf-ray": "abc123-BRU",
        "x-forwarded-for": "198.51.100.4",
      },
    });

    expect(getClientIp(request)).toBe("203.0.113.10");
  });

  it("does not trust an unmarked Cloudflare header on direct-origin traffic", () => {
    const request = new Request("https://example.test", {
      headers: {
        "cf-connecting-ip": "203.0.113.10",
        "x-forwarded-for": "198.51.100.4",
      },
    });

    expect(getClientIp(request)).toBe("198.51.100.4");
  });
});
