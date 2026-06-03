import { describe, it, expect } from "vitest";
import { assertPublicHttpUrl, isBlockedFetchHost } from "../ssrf-guard";

describe("ssrf-guard", () => {
  it("blocks localhost and private IPs", () => {
    expect(isBlockedFetchHost("127.0.0.1")).toBe(true);
    expect(isBlockedFetchHost("10.0.0.1")).toBe(true);
    expect(isBlockedFetchHost("169.254.169.254")).toBe(true);
    expect(isBlockedFetchHost("metadata.google.internal")).toBe(true);
    expect(isBlockedFetchHost("example.com")).toBe(false);
  });

  it("allows public https URLs", async () => {
    await expect(assertPublicHttpUrl("https://example.com/logo.png")).resolves.toBe("https://example.com/logo.png");
  });

  it("rejects javascript and file schemes", async () => {
    await expect(assertPublicHttpUrl("javascript:alert(1)")).rejects.toThrow(/http\(s\)/i);
    await expect(assertPublicHttpUrl("file:///etc/passwd")).rejects.toThrow(/http\(s\)/i);
  });

  it("rejects http://127.0.0.1", async () => {
    await expect(assertPublicHttpUrl("http://127.0.0.1/admin")).rejects.toThrow(/niet toegestaan/i);
  });

  it("rejects URLs with embedded credentials", async () => {
    await expect(assertPublicHttpUrl("https://user:pass@example.com/image.png")).rejects.toThrow(/credentials/i);
  });
});
