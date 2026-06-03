import { describe, it, expect } from "vitest";
import { safeExternalUrl } from "../utils";

describe("safeExternalUrl", () => {
  it("allows https", () => {
    expect(safeExternalUrl("https://example.com")).toMatch(/^https:/);
  });

  it("blocks javascript", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
  });

  it("blocks data URLs", () => {
    expect(safeExternalUrl("data:text/html,<script>")).toBeNull();
  });
});
