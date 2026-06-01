import { describe, expect, it } from "vitest";
import {
  isValidGoogleOAuthClientId,
  isValidGoogleOAuthClientSecret,
  sanitizeOAuthClientValue,
} from "../lib/oauth-credentials";

describe("oauth-credentials", () => {
  it("strips quotes and trailing commas from env-style values", () => {
    expect(sanitizeOAuthClientValue('"123-abc.apps.googleusercontent.com",')).toBe(
      "123-abc.apps.googleusercontent.com",
    );
    expect(sanitizeOAuthClientValue("GOCSPX-secret,")).toBe("GOCSPX-secret");
  });

  it("validates Google OAuth client id format", () => {
    expect(isValidGoogleOAuthClientId("1234567890-abc.apps.googleusercontent.com")).toBe(true);
    expect(isValidGoogleOAuthClientId("not-a-client-id")).toBe(false);
    expect(isValidGoogleOAuthClientId("")).toBe(false);
  });

  it("validates Google OAuth client secret prefix", () => {
    expect(isValidGoogleOAuthClientSecret("GOCSPX-abc123")).toBe(true);
    expect(isValidGoogleOAuthClientSecret("wrong-secret")).toBe(false);
  });
});
