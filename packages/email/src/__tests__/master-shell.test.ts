import { describe, expect, it } from "vitest";
import { renderCtaBlock, renderMasterShell, DEFAULT_MASTER_SHELL_HTML } from "../master-shell";

describe("renderMasterShell", () => {
  it("injects text content and branding placeholders", () => {
    const html = renderMasterShell({
      shellHtml: DEFAULT_MASTER_SHELL_HTML,
      content: "Beste Jan,\n\nDit is een test.",
      contentFormat: "TEXT",
      branding: {
        companyName: "Digitify",
        primaryColor: "#f9ae5a",
        headerSlogan: "Digitale groei",
        signature: "Met vriendelijke groeten,\nTeam Digitify",
        footer: "Digitify BV",
      },
      subject: "Test onderwerp",
    });

    expect(html).toContain("Digitify");
    expect(html).toContain("#f9ae5a");
    expect(html).toContain("Beste Jan");
    expect(html).toContain("Team Digitify");
    expect(html).not.toContain("{{content}}");
  });

  it("renders CTA block only for safe URLs", () => {
    const block = renderCtaBlock("Plan gesprek", "https://example.com/book", "#112233");
    expect(block).toContain("https://example.com/book");
    expect(renderCtaBlock("Plan gesprek", "javascript:alert(1)", "#112233")).toBe("");
  });
});
