import { describe, expect, it } from "vitest";
import {
  BLANK_SHELL_WIZARD_CONFIG,
  buildEmailShellHtml,
  createInitialWizardConfig,
  DEFAULT_SHELL_WIZARD_CONFIG,
  wizardConfigToAiInstructions,
} from "../email-shell-builder";

const REQUIRED_PLACEHOLDERS = [
  "{{content}}",
  "{{ctaBlock}}",
  "{{signatureBlock}}",
  "{{footerBlock}}",
  "{{companyName}}",
  "{{primaryColor}}",
  "{{headerSlogan}}",
  "{{logoBlock}}",
  "{{unsubscribeBlock}}",
];

describe("buildEmailShellHtml", () => {
  it("includes all required placeholders for default config", () => {
    const html = buildEmailShellHtml(DEFAULT_SHELL_WIZARD_CONFIG);
    for (const token of REQUIRED_PLACEHOLDERS) {
      expect(html).toContain(token);
    }
  });

  it("generates distinct html per base style", () => {
    const blank = buildEmailShellHtml(BLANK_SHELL_WIZARD_CONFIG);
    const brief = buildEmailShellHtml({ ...DEFAULT_SHELL_WIZARD_CONFIG, baseStyle: "brief" });
    const convert = buildEmailShellHtml({ ...DEFAULT_SHELL_WIZARD_CONFIG, baseStyle: "convert" });
    expect(blank).not.toEqual(brief);
    expect(brief).not.toEqual(convert);
  });

  it("always starts from blank", () => {
    const config = createInitialWizardConfig();
    expect(config.baseStyle).toBe("blank");
    expect(config.showHeader).toBe(false);
    expect(config.cardShadow).toBe("none");
  });

  it("respects card width and shadow options", () => {
    const wide = buildEmailShellHtml({ ...DEFAULT_SHELL_WIZARD_CONFIG, cardWidth: "wide" });
    const narrow = buildEmailShellHtml({ ...DEFAULT_SHELL_WIZARD_CONFIG, cardWidth: "narrow" });
    expect(wide).toContain("680px");
    expect(narrow).toContain("520px");
  });

  it("builds ai instructions from wizard config", () => {
    const instructions = wizardConfigToAiInstructions(DEFAULT_SHELL_WIZARD_CONFIG);
    expect(instructions).toContain("studio");
    expect(instructions).toContain("cool");
    expect(instructions).toContain("Tekstgrootte");
    expect(instructions).toContain("Kaartrand");
  });

  it("embeds render metadata for CTA and signature styling", () => {
    const html = buildEmailShellHtml({
      ...DEFAULT_SHELL_WIZARD_CONFIG,
      ctaStyle: "outline",
      ctaSize: "lg",
      logoSize: "lg",
      signatureStyle: "card",
    });
    expect(html).toContain("digitify-shell-config:");
    expect(html).toContain('"variant":"outline"');
    expect(html).toContain('"signatureStyle":"card"');
  });

  it("applies typography and border customization", () => {
    const html = buildEmailShellHtml({
      ...DEFAULT_SHELL_WIZARD_CONFIG,
      bodySize: "lg",
      contentAlign: "center",
      cardBorder: "accent",
      headerSize: "lg",
      headerFont: "georgia",
      bodyFont: "verdana",
      lineHeight: "relaxed",
      headerWeight: "extrabold",
    });
    expect(html).toContain("17px");
    expect(html).toContain("text-align:center");
    expect(html).toContain("border-top:4px solid {{primaryColor}}");
    expect(html).toContain("32px");
    expect(html).toContain("Georgia,'Times New Roman',Times,serif");
    expect(html).toContain("Verdana,Geneva,sans-serif");
    expect(html).toContain("line-height:1.92");
    expect(html).toContain("font-weight:800");
  });
});
