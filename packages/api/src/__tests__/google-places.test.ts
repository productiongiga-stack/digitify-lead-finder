import { describe, expect, it } from "vitest";
import { formatGooglePlacesErrorMessage } from "../lib/google-places";

describe("formatGooglePlacesErrorMessage", () => {
  it("maps invalid API key responses to Dutch guidance", () => {
    const raw =
      'HTTP 400: { "error": { "code": 400, "message": "API key not valid. Please pass a valid API key.", "status": "INVALID_ARGUMENT" } }';
    expect(formatGooglePlacesErrorMessage(raw)).toContain("wordt door Google geweigerd");
    expect(formatGooglePlacesErrorMessage(raw)).toContain("Places API (New)");
  });

  it("maps disabled API responses", () => {
    const raw =
      'HTTP 403: { "error": { "message": "Places API (New) has not been used in project 123 before or it is disabled." } }';
    expect(formatGooglePlacesErrorMessage(raw)).toContain("niet ingeschakeld");
  });

  it("returns the Google message when no special case matches", () => {
    const raw = 'HTTP 429: { "error": { "message": "Quota exceeded for quota metric." } }';
    expect(formatGooglePlacesErrorMessage(raw)).toBe("Quota exceeded for quota metric.");
  });
});
