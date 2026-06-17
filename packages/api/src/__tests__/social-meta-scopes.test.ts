import { afterEach, describe, expect, it } from "vitest";
import {
  META_ADS_OAUTH_SCOPES,
  META_FACEBOOK_LOGIN_PUBLISHING_SCOPES,
  META_INSTAGRAM_LOGIN_PUBLISHING_SCOPES,
  formatMetaApiError,
  missingMetaPublishScopes,
  normalizeMetaOAuthScopes,
  resolveMetaOAuthIncludeAds,
  resolveMetaOAuthLoginMode,
  resolveMetaOAuthScopes,
  resolveRequiredMetaPublishScopes,
} from "../lib/social-meta";

const ENV_KEYS = [
  "META_OAUTH_SCOPES",
  "META_OAUTH_LOGIN_MODE",
  "META_OAUTH_INCLUDE_ADS",
  "META_OAUTH_SCOPE_LEVEL",
] as const;

function clearMetaOAuthEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

afterEach(() => {
  clearMetaOAuthEnv();
});

describe("resolveMetaOAuthScopes", () => {
  it("defaults to Facebook Login publishing scopes without ads", () => {
    clearMetaOAuthEnv();
    expect(resolveMetaOAuthLoginMode()).toBe("facebook");
    expect(resolveMetaOAuthIncludeAds()).toBe(false);
    expect(resolveMetaOAuthScopes()).toEqual([...META_FACEBOOK_LOGIN_PUBLISHING_SCOPES]);
    expect(resolveMetaOAuthScopes()).not.toContain("instagram_business_basic");
  });

  it("can include Marketing API scopes when enabled", () => {
    process.env.META_OAUTH_INCLUDE_ADS = "true";
    expect(resolveMetaOAuthScopes()).toEqual([
      ...META_FACEBOOK_LOGIN_PUBLISHING_SCOPES,
      ...META_ADS_OAUTH_SCOPES,
    ]);
  });

  it("supports Instagram Login mode scopes", () => {
    process.env.META_OAUTH_LOGIN_MODE = "instagram";
    expect(resolveMetaOAuthScopes()).toEqual([...META_INSTAGRAM_LOGIN_PUBLISHING_SCOPES]);
  });

  it("respects META_OAUTH_SCOPES override", () => {
    process.env.META_OAUTH_SCOPES = "pages_show_list,instagram_basic";
    expect(resolveMetaOAuthScopes()).toEqual(["pages_show_list", "instagram_basic"]);
  });

  it("remaps deprecated instagram_business_* scopes from env override", () => {
    process.env.META_OAUTH_SCOPES =
      "pages_show_list,pages_manage_posts,instagram_business_basic,instagram_business_content_publish";
    expect(resolveMetaOAuthScopes()).toEqual([
      "pages_show_list",
      "pages_manage_posts",
      "instagram_basic",
      "instagram_content_publish",
    ]);
  });

  it("normalizes legacy scope names", () => {
    expect(
      normalizeMetaOAuthScopes([
        "instagram_business_basic",
        "instagram_business_content_publish",
        "instagram_basic",
      ]),
    ).toEqual(["instagram_basic", "instagram_content_publish"]);
  });

  it("supports minimal scope level", () => {
    process.env.META_OAUTH_SCOPE_LEVEL = "minimal";
    expect(resolveMetaOAuthScopes()).toEqual([
      "pages_show_list",
      "instagram_basic",
      "instagram_content_publish",
    ]);
  });

  it("detects missing publish scopes on debug token", () => {
    expect(
      missingMetaPublishScopes(
        ["pages_show_list", "instagram_basic"],
        resolveRequiredMetaPublishScopes(["FACEBOOK", "INSTAGRAM"]),
      ),
    ).toEqual(["pages_manage_posts", "instagram_content_publish"]);
  });

  it("adds a clear hint for OAuth permission errors", () => {
    const message = formatMetaApiError({
      message: "Application does not have permission for this action",
      code: 10,
      type: "OAuthException",
    });
    expect(message).toContain("pages_manage_posts");
  });

  it("adds a clear hint for Instagram aspect-ratio publish errors", () => {
    const message = formatMetaApiError({
      message: "Invalid aspect ratio",
      code: 36003,
      type: "OAuthException",
      error_subcode: 2207009,
    });

    expect(message).toContain("Afbeeldingsverhouding ongeldig");
    expect(message).toContain("1080x1080");
    expect(message).toContain("code 36003");
    expect(message).toContain("subcode 2207009");
  });
});
