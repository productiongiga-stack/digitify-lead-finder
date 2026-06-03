import { describe, it, expect } from "vitest";
import { analyzeWebsite } from "../website-analyzer";

describe("analyzeWebsite SSRF guard", () => {
  it("rejects localhost without fetching", async () => {
    const result = await analyzeWebsite("http://127.0.0.1/admin");
    expect(result.statusCode).toBe(0);
    expect(result.errors.join(" ")).toMatch(/niet toegestaan/i);
  });
});
