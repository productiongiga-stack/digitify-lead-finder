import { describe, expect, it } from "vitest";
import { isSafeCtaUrl, sanitizeCtaUrl } from "../safe-url";

describe("safe-url", () => {
  it("allows http(s) and mailto", () => {
    expect(isSafeCtaUrl("https://example.com/book")).toBe(true);
    expect(isSafeCtaUrl("mailto:info@example.com")).toBe(true);
  });

  it("allows placeholders and relative paths", () => {
    expect(isSafeCtaUrl("{{bookingLink}}")).toBe(true);
    expect(isSafeCtaUrl("/contact")).toBe(true);
  });

  it("blocks javascript and data URLs", () => {
    expect(isSafeCtaUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeCtaUrl("data:text/html,<script>")).toBe(false);
    expect(sanitizeCtaUrl("javascript:alert(1)")).toBeUndefined();
  });

  it("blocks protocol-relative URLs", () => {
    expect(isSafeCtaUrl("//evil.com")).toBe(false);
  });
});
