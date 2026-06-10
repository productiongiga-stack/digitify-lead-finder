import { describe, expect, it } from "vitest";
import {
  applyBrandToGeneration,
  aspectRatioForPlacement,
  buildImagePayload,
  formatModelCostDetail,
  formatModelCostEur,
  formatModelCostUsd,
  getModelById,
  listAllModels,
  MODEL_COST_USD,
} from "./index";

describe("media studio models", () => {
  it("exposes image and marketing models", () => {
    const models = listAllModels();
    expect(models.some((model) => model.id === "flux-dev")).toBe(true);
    expect(models.some((model) => model.id === "flux-schnell")).toBe(true);
    expect(models.some((model) => model.type === "MARKETING_AD")).toBe(true);
    expect(models.some((model) => model.type === "LIP_SYNC")).toBe(true);
    expect(models.length).toBeGreaterThan(70);
  });

  it("resolves known model metadata", () => {
    const model = getModelById("flux-dev");
    expect(model?.endpoint).toBe("flux-dev-image");
    expect(model?.type).toBe("IMAGE");
    expect(getModelById("seedream-5.0")?.endpoint).toBe("seedream-5.0");
    expect(getModelById("kling-v2.1")?.endpoint).toBe("kling-v2.1-master-t2v");
    expect(getModelById("flux-kontext-dev")?.endpoint).toBe("flux-kontext-dev-i2i");
    expect(getModelById("seedance-2-vip-omni-reference")?.endpoint).toBe("seedance-2-vip-omni-reference");
    expect(getModelById("grok-imagine-t2v")?.endpoint).toBe("grok-imagine-text-to-video");
    expect(getModelById("infinitetalk-image-to-video")?.lipSyncMode).toBe("PORTRAIT");
  });

  it("includes 1080p marketing ad endpoint cost", () => {
    expect(MODEL_COST_USD["sd-2-vip-omni-reference-1080p"]).toBe(2.25);
  });

  it("uses model-specific reference image fields", () => {
    expect(getModelById("nano-banana-2-edit")?.imageField).toBe("images_list");
    expect(buildImagePayload({
      model: "nano-banana-2-edit",
      prompt: "Maak een premium productbeeld",
      images_list: ["https://example.com/a.png", "https://example.com/b.png"],
    })).toMatchObject({
      images_list: ["https://example.com/a.png", "https://example.com/b.png"],
    });
  });

  it("maps social placements to aspect ratios", () => {
    expect(aspectRatioForPlacement("STORY")).toBe("9:16");
    expect(aspectRatioForPlacement("SQUARE")).toBe("1:1");
  });

  it("exposes MuAPI cost metadata on models", () => {
    const flux = getModelById("flux-schnell");
    expect(flux?.costUsd).toBe(0.003);
    expect(formatModelCostEur(flux?.costUsd)).toBe("€0,0028");
    expect(formatModelCostUsd(flux?.costUsd)).toBe("$0.0030");
    expect(formatModelCostDetail(flux?.costUsd, "beeld")).toContain("€0,0028 per beeld");
  });

  it("enriches prompts with brand context", () => {
    const result = applyBrandToGeneration(
      {
        enabled: true,
        includeLogo: false,
        companyName: "Digitify",
        slogan: "Groei slimmer",
      },
      { prompt: "Productfoto", modelType: "IMAGE" },
    );
    expect(result.brandApplied).toBe(true);
    expect(result.prompt).toContain("Digitify");
  });
});
