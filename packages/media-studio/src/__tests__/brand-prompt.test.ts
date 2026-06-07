import { describe, expect, it } from "vitest";
import { applyBrandToGeneration, buildBrandPromptSuffix } from "../brand-prompt";

describe("brand prompt", () => {
  it("appends company context when enabled", () => {
    const suffix = buildBrandPromptSuffix({
      enabled: true,
      includeLogo: false,
      companyName: "Digitify",
      slogan: "Groei slimmer",
      primaryColor: "#f9ae5a",
    });
    expect(suffix).toContain("Digitify");
    expect(suffix).toContain("Groei slimmer");
    expect(suffix).toContain("#f9ae5a");
  });

  it("returns empty suffix when disabled", () => {
    expect(
      buildBrandPromptSuffix({
        enabled: false,
        includeLogo: true,
        companyName: "Digitify",
      }),
    ).toBe("");
  });

  it("attaches logo for image-to-image models", () => {
    const result = applyBrandToGeneration(
      {
        enabled: true,
        includeLogo: true,
        companyName: "Digitify",
        logoUrl: "https://example.com/logo.png",
      },
      {
        prompt: "Product op marmer",
        modelType: "IMAGE_I2I",
        imagesList: ["https://example.com/product.png"],
      },
    );

    expect(result.brandApplied).toBe(true);
    expect(result.imagesList?.[0]).toBe("https://example.com/logo.png");
    expect(result.prompt).toContain("Digitify");
  });
});
