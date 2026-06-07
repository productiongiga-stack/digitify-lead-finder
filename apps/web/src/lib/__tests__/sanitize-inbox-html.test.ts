import { describe, expect, it } from "vitest";
import { buildEmailPreviewDocument } from "../sanitize-inbox-html";

describe("buildEmailPreviewDocument", () => {
  it("keeps CTA placeholder links and inline button styles", () => {
    const html = `<!DOCTYPE html><html><head></head><body>
      <a href="{{bookingLink}}" style="display:inline-block;padding:15px 34px;color:#ffffff;background-color:#f9ae5a;text-decoration:none;font-weight:700;border-radius:999px;">
        Plan een gesprek
      </a>
    </body></html>`;

    const preview = buildEmailPreviewDocument(html);
    expect(preview).toContain('href="{{bookingLink}}"');
    expect(preview).toContain("border-radius:999px");
    expect(preview).toContain("Plan een gesprek");
    expect(preview).not.toContain("<span");
  });
});
