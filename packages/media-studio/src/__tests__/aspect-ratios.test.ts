import { describe, expect, it } from "vitest";
import { aspectRatioForPlacement, PLACEMENT_ASPECT_RATIOS } from "../aspect-ratios";

describe("aspect-ratios", () => {
  it("maps social placements to MuAPI ratios", () => {
    expect(PLACEMENT_ASPECT_RATIOS.SQUARE).toBe("1:1");
    expect(PLACEMENT_ASPECT_RATIOS.PORTRAIT).toBe("4:5");
    expect(PLACEMENT_ASPECT_RATIOS.STORY).toBe("9:16");
    expect(aspectRatioForPlacement("LANDSCAPE")).toBe("16:9");
  });
});
