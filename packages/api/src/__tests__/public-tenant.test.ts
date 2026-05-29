import { describe, expect, it } from "vitest";
import {
  extractTenantOwnerIdFromSettingKey,
  extractUserIdFromScopedSettingKey,
  normalizePublicTenantToken,
} from "../lib/public-tenant";

describe("public-tenant", () => {
  it("normalizes valid tokens", () => {
    const token = "a".repeat(24);
    expect(normalizePublicTenantToken(token)).toBe(token);
    expect(normalizePublicTenantToken(`  ${token}  `)).toBe(token);
  });

  it("rejects invalid tokens", () => {
    expect(normalizePublicTenantToken("short")).toBe("");
    expect(normalizePublicTenantToken("has spaces in token value!!")).toBe("");
  });

  it("extracts owner id from user-scoped keys", () => {
    expect(
      extractUserIdFromScopedSettingKey("user:owner_1:chatbot.public_tenant_token"),
    ).toBe("owner_1");
    expect(
      extractTenantOwnerIdFromSettingKey("user:owner_1:chatbot.public_tenant_token"),
    ).toBe("owner_1");
  });

  it("extracts owner id from workspace-scoped keys", () => {
    expect(
      extractTenantOwnerIdFromSettingKey("workspace:ws_1:chatbot.public_tenant_token"),
    ).toBe("ws_1");
  });
});
