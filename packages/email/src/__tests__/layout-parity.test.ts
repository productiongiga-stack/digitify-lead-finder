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

  it("produces structurally different HTML per layout", () => {
    const htmlByLayout = Object.fromEntries(
      layouts.map((layout) => [layout, generateLayout(layout, baseOptions)]),
    ) as Record<(typeof layouts)[number], string>;

    expect(htmlByLayout.modern).toContain("UPDATE");
    expect(htmlByLayout.minimal).toContain("Georgia");
    expect(htmlByLayout.business).toContain("Betreft:");
    expect(htmlByLayout.proposal).toContain("OFFERTE");
    expect(htmlByLayout.followup).toContain("Follow-up");

    for (const left of layouts) {
      for (const right of layouts) {
        if (left === right) continue;
        expect(htmlByLayout[left]).not.toBe(htmlByLayout[right]);
      }
    }
  });

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
