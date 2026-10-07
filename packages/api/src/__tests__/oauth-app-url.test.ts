import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveOAuthAppUrl } from "../lib/oauth-app-url";

describe("resolveOAuthAppUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the canonical configured origin in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXTAUTH_URL", "https://leads.digitify.be/");
    expect(resolveOAuthAppUrl(new Request("https://project-preview.vercel.app/api/connect"))).toBe("https://leads.digitify.be");
  });

  it("keeps the request origin for local development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXTAUTH_URL", "https://leads.digitify.be");
    expect(resolveOAuthAppUrl(new Request("http://localhost:3001/api/connect"))).toBe("http://localhost:3001");
  });
});
