import { describe, expect, it, vi } from "vitest";
import {
  extractTenantOwnerIdFromSettingKey,
  extractUserIdFromScopedSettingKey,
  ensurePublicTenantToken,
  normalizePublicTenantToken,
  publicTenantLookupKey,
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

  it("builds stable lookup keys for tenant tokens", () => {
    const token = "a".repeat(24);
    expect(publicTenantLookupKey(token)).toBe(`public_tenant_lookup:${token}`);
  });

  it("keeps workspace initialization working when RLS blocks the global lookup index", async () => {
    const token = "b".repeat(24);
    const upsert = vi.fn(async ({ where }: { where: { key: string } }) => {
      if (where.key.startsWith("public_tenant_lookup:")) {
        throw new Error("new row violates row-level security policy for table settings");
      }
      return { key: where.key, value: token };
    });
    const db = {
      setting: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert,
      },
    } as never;

    await expect(ensurePublicTenantToken(db, "workspace-rls-test")).resolves.toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(upsert).toHaveBeenCalled();
  });
});
