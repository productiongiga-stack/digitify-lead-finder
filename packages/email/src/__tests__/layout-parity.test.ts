import { describe, expect, it } from "vitest";
import { generateBrandedHtml } from "../html-template";
import { generateLayout } from "../layouts";

const baseOptions = {
  subject: "Test onderwerp",
  body: "Beste {{contactName}},\n\nDit is een test.\n\n{{senderName}}",
  companyName: "Digitify",
  primaryColor: "#f5b04c",
  fromName: "Koen",
  fromEmail: "koen@digitify.be",
  headerSlogan: "Partner in growth",
  recipientCompany: "Acme BV",
  ctaText: "Plan gesprek",
  ctaUrl: "https://example.com/book",
  typographyMode: "compact" as const,
  hidePoweredBy: true,
};

describe("email layout parity", () => {
  const layouts = ["modern", "minimal", "business", "proposal", "followup"] as const;

  for (const layout of layouts) {
    it(`generateBrandedHtml matches generateLayout for ${layout}`, () => {
      const viaBranded = generateBrandedHtml({ ...baseOptions, layout });
      const viaLayout = generateLayout(layout, baseOptions);
      expect(viaBranded).toBe(viaLayout);
    });
  }

  it("sanitizes unsafe CTA urls in output", () => {
    const html = generateBrandedHtml({
      ...baseOptions,
      layout: "modern",
      ctaUrl: "javascript:alert(1)",
    });
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("Plan gesprek");
  });
});
