import { describe, expect, it } from "vitest";
import { tokenHash } from "../routers/presentation.router";

describe("presentation share tokens", () => {
  it("hashes the same token deterministically", () => {
    expect(tokenHash("example-token")).toBe(tokenHash("example-token"));
    expect(tokenHash("example-token")).not.toBe(tokenHash("other-token"));
    expect(tokenHash("example-token")).toHaveLength(64);
  });
});
