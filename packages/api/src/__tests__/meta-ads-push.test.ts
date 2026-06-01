import { describe, expect, it } from "vitest";
import { defaultTargeting } from "../lib/meta-ads";

describe("meta ads push helpers", () => {
  it("uses valid instagram_positions for default targeting", () => {
    const targeting = defaultTargeting(undefined) as { instagram_positions?: string[] };
    expect(targeting.instagram_positions).toEqual(["feed", "story"]);
    expect(targeting.instagram_positions).not.toContain("stream");
  });
});
