import { describe, expect, it } from "vitest";
import { defaultTargeting, resolveAdsetDestinationType, resolveAdsetOptimizationGoal } from "../lib/meta-ads";

describe("meta ads push helpers", () => {
  it("uses valid instagram_positions for default targeting", () => {
    const targeting = defaultTargeting(undefined) as { instagram_positions?: string[] };
    expect(targeting.instagram_positions).toEqual(["feed", "story"]);
    expect(targeting.instagram_positions).not.toContain("stream");
  });

  it("remaps legacy instagram stream position in custom targeting", () => {
    const targeting = defaultTargeting({
      geo_locations: { countries: ["BE"] },
      instagram_positions: ["stream", "story"],
    }) as { instagram_positions?: string[] };
    expect(targeting.instagram_positions).toEqual(["feed", "story"]);
  });

  it("omits WEBSITE destination_type for OUTCOME_TRAFFIC (Meta rejects it)", () => {
    expect(resolveAdsetDestinationType("OUTCOME_TRAFFIC")).toBeUndefined();
    expect(resolveAdsetDestinationType("LINK_CLICKS")).toBeUndefined();
    expect(resolveAdsetOptimizationGoal("OUTCOME_TRAFFIC")).toBe("LINK_CLICKS");
  });

  it("uses WEBSITE destination_type for lead/sales outcomes", () => {
    expect(resolveAdsetDestinationType("OUTCOME_LEADS")).toBe("WEBSITE");
    expect(resolveAdsetDestinationType("OUTCOME_SALES")).toBe("WEBSITE");
  });
});
