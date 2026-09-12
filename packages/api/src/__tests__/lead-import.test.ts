import { describe, expect, it } from "vitest";
import { sameLeadIdentity } from "../lib/lead-import";

const branch = { companyName: "Acme BV", address: "Kerkstraat 1", city: "Gent", gmbPlaceId: "PlaceA" };
describe("conservative lead identity", () => {
  it("recognizes a provider ID even when a business changed its name", () => {
    expect(sameLeadIdentity(branch, { companyName: "Nieuwe naam", gmbPlaceId: "PlaceA" })).toBe(true);
  });
  it("does not merge different provider locations, even with the same name and address", () => {
    expect(sameLeadIdentity(branch, { ...branch, gmbPlaceId: "PlaceB" })).toBe(false);
  });
  it("normalizes whitespace and case for a name with location", () => {
    expect(sameLeadIdentity(branch, { companyName: " acme  bv ", address: " kerkstraat 1 ", city: "gent" })).toBe(true);
  });
  it("preserves same-name businesses in other cities and records with insufficient location data", () => {
    expect(sameLeadIdentity(branch, { ...branch, gmbPlaceId: null, city: "Brugge" })).toBe(false);
    expect(sameLeadIdentity(branch, { companyName: "Acme BV" })).toBe(false);
    expect(sameLeadIdentity({ companyName: "Acme", address: "Straat 1" }, { companyName: "Acme", address: "Straat 1" })).toBe(false);
  });
  it("does not strip legal names or accents", () => {
    expect(sameLeadIdentity(branch, { ...branch, companyName: "Acme NV", gmbPlaceId: null })).toBe(false);
  });
});
