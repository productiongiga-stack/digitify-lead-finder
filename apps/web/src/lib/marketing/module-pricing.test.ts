import { describe, expect, it } from "vitest";
import {
  getMarketingBundlesTotal,
  getMarketingSuiteSavings,
  getMarketingTechnicalModuleIds,
  MARKETING_BUNDLES,
  MARKETING_SUITE_PRICING,
} from "@/lib/marketing/module-pricing";
import { ALL_MODULES } from "@/lib/navigation";

describe("marketing bundle pricing", () => {
  it("maps every technical module to exactly one commercial bundle", () => {
    const moduleIds = getMarketingTechnicalModuleIds();
    expect(MARKETING_BUNDLES).toHaveLength(7);
    expect(moduleIds).toHaveLength(26);
    expect(new Set(moduleIds).size).toBe(moduleIds.length);
    expect(new Set(moduleIds)).toEqual(new Set(ALL_MODULES.map((module) => module.id)));
  });

  it("calculates the bundle total and suite saving", () => {
    expect(getMarketingBundlesTotal()).toBe(693);
    expect(MARKETING_SUITE_PRICING.monthly).toBe(499);
    expect(getMarketingSuiteSavings()).toBe(194);
  });
});
