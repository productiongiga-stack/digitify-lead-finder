import { describe, expect, it } from "vitest";
import { buildInboxHtmlDocument, sanitizeInboxHtml } from "../sanitize-inbox-html";

describe("sanitizeInboxHtml", () => {
  it("strips script tags and javascript: links", () => {
    const dirty = `<p>Hi</p><script>alert(1)</script><a href="javascript:alert(1)">click</a>`;
    const safe = sanitizeInboxHtml(dirty);
    expect(safe).not.toContain("<script");
    expect(safe).not.toContain("javascript:");
    expect(safe).toContain("<p>Hi</p>");
  });

  it("allows https links with rel noopener", () => {
    const safe = sanitizeInboxHtml('<a href="https://example.com">link</a>');
    expect(safe).toContain('href="https://example.com"');
    expect(safe).toContain('rel="noopener noreferrer"');
  });

  it("buildInboxHtmlDocument uses CSP and safe body only", () => {
    const doc = buildInboxHtmlDocument("<p>Body</p>");
    expect(doc).toContain("Content-Security-Policy");
    expect(doc).toContain("<p>Body</p>");
    expect(doc).not.toContain("<script");
  });
});
