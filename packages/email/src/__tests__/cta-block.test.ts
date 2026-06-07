import { describe, expect, it } from "vitest";
import {
  buildShellRenderMetaComment,
  parseShellRenderMeta,
  renderCtaBlock,
} from "../cta-block";

describe("renderCtaBlock", () => {
  it("renders pill variant by default", () => {
    const html = renderCtaBlock("Plan gesprek", "https://example.com", "#f9ae5a");
    expect(html).toContain("Plan gesprek");
    expect(html).toContain("border-radius:999px");
    expect(html).toContain("font-weight:700");
    expect(html).toContain('bgcolor="#f9ae5a"');
    expect(html).toContain("background:transparent");
  });

  it("renders outline and soft variants", () => {
    const outline = renderCtaBlock("Klik", "https://example.com", "#112233", { variant: "outline" });
    const soft = renderCtaBlock("Klik", "https://example.com", "#112233", { variant: "soft" });
    expect(outline).toContain("border:2px solid #112233");
    expect(soft).toContain("rgba(17,34,51,0.14)");
  });

  it("supports alignment and full width block style", () => {
    const block = renderCtaBlock("Boek nu", "https://example.com", "#f9ae5a", {
      variant: "block",
      align: "left",
      fullWidth: true,
      size: "lg",
    });
    expect(block).toContain('align="left"');
    expect(block).toContain('width="100%"');
    expect(block).toContain("17px 42px");
    expect(block).toContain("display:block");
  });

  it("keeps placeholder urls for preview rendering", () => {
    const html = renderCtaBlock("Plan gesprek", "{{bookingLink}}", "#f9ae5a");
    expect(html).toContain('href="{{bookingLink}}"');
  });

  it("rejects unsafe urls", () => {
    expect(renderCtaBlock("X", "javascript:alert(1)", "#000")).toBe("");
  });
});

describe("shell render meta", () => {
  it("roundtrips config comment in shell html", () => {
    const comment = buildShellRenderMetaComment({
      v: 1,
      cta: { variant: "rounded", size: "lg", align: "center" },
      logoSize: "lg",
      signatureStyle: "card",
    });
    const shell = `<!DOCTYPE html><html><head>${comment}</head><body></body></html>`;
    const parsed = parseShellRenderMeta(shell);
    expect(parsed?.cta?.variant).toBe("rounded");
    expect(parsed?.logoSize).toBe("lg");
    expect(parsed?.signatureStyle).toBe("card");
  });
});
