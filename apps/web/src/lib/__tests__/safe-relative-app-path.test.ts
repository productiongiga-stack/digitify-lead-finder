import { describe, it, expect } from "vitest";
import { safeRelativeAppPath } from "../utils";

describe("safeRelativeAppPath", () => {
  it("allows internal app paths", () => {
    expect(safeRelativeAppPath("/quotes/abc123")).toBe("/quotes/abc123");
    expect(safeRelativeAppPath("/quotes/new?quoteId=x")).toBe("/quotes/new?quoteId=x");
  });

  it("blocks absolute and protocol-relative URLs", () => {
    expect(safeRelativeAppPath("https://evil.com")).toBeNull();
    expect(safeRelativeAppPath("//evil.com/phish")).toBeNull();
  });

  it("blocks javascript and backslash tricks", () => {
    expect(safeRelativeAppPath("javascript:alert(1)")).toBeNull();
    expect(safeRelativeAppPath("/quotes\\@evil.com")).toBeNull();
  });
});
