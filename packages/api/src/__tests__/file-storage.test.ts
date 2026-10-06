import { describe, expect, it } from "vitest";
import { sha256 } from "../lib/file-storage";

describe("workspace file storage helpers", () => {
  it("produces a stable sha256 checksum for idempotent uploads", () => {
    expect(sha256(Buffer.from("digitify"))).toBe("87061895b4aff20dad36c6619b30dd0da0c8929c0351c64b50ff45ffef34d6e8");
  });
});
