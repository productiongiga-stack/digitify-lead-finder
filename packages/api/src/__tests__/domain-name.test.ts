import { describe, expect, it } from "vitest";
import { isValidDomainName, normalizeDomainName } from "../lib/domain-name";

describe("normalizeDomainName", () => {
  it("strips protocol and www", () => {
    expect(normalizeDomainName("https://www.Example.be/path")).toBe("example.be");
  });

  it("keeps bare hostnames", () => {
    expect(normalizeDomainName("digitify.be")).toBe("digitify.be");
  });
});

describe("isValidDomainName", () => {
  it("accepts valid hosts", () => {
    expect(isValidDomainName("digitify.be")).toBe(true);
  });

  it("rejects empty values", () => {
    expect(isValidDomainName("")).toBe(false);
  });
});
