import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import dns from "node:dns/promises";
import {
  diagnoseSmtpHost,
  isCloudflareIpv4,
  looksLikeMailSubdomain,
} from "../lib/smtp-host-diagnostics";

describe("isCloudflareIpv4", () => {
  it("detects known Cloudflare anycast addresses", () => {
    expect(isCloudflareIpv4("104.21.9.226")).toBe(true);
    expect(isCloudflareIpv4("172.67.161.95")).toBe(true);
  });

  it("rejects non-Cloudflare IPs", () => {
    expect(isCloudflareIpv4("185.151.28.68")).toBe(false);
    expect(isCloudflareIpv4("8.8.8.8")).toBe(false);
  });
});

describe("looksLikeMailSubdomain", () => {
  it("matches smtp/mail prefixes", () => {
    expect(looksLikeMailSubdomain("smtp.digitify.be")).toBe(true);
    expect(looksLikeMailSubdomain("mail.example.com")).toBe(true);
    expect(looksLikeMailSubdomain("digitify.be")).toBe(false);
  });
});

describe("diagnoseSmtpHost", () => {
  beforeEach(() => {
    vi.spyOn(dns, "resolve4");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("flags Cloudflare-proxied smtp hosts", async () => {
    vi.mocked(dns.resolve4).mockResolvedValue(["104.21.9.226", "172.67.161.95"]);
    const result = await diagnoseSmtpHost("smtp.digitify.be");
    expect(result.status).toBe("cloudflare_proxy");
    if (result.status === "cloudflare_proxy") {
      expect(result.message).toContain("Cloudflare");
      expect(result.message).toContain("smtp.stackmail.com");
    }
  });

  it("allows real mail hosts", async () => {
    vi.mocked(dns.resolve4).mockResolvedValue(["185.151.28.68"]);
    const result = await diagnoseSmtpHost("smtp.stackmail.com");
    expect(result).toEqual({ status: "ok", addresses: ["185.151.28.68"] });
  });

  it("reports missing DNS", async () => {
    const err = Object.assign(new Error("not found"), { code: "ENOTFOUND" });
    vi.mocked(dns.resolve4).mockRejectedValue(err);
    const result = await diagnoseSmtpHost("smtp.missing.example");
    expect(result.status).toBe("dns_failed");
  });
});
