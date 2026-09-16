import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@digitify/db", () => ({
  prisma: {
    aseLicense: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@digitify/db";
import {
  hashLicenseKey,
  generateLicenseKey,
  normalizeDomain,
  isLicenseUsable,
  createLicenseForEmail,
  issueLicense,
} from "../lib/ase-license";

describe("ase-license helpers", () => {
  it("generates ASE-XXXX-XXXX-XXXX-XXXX keys", () => {
    const key = generateLicenseKey();
    expect(key).toMatch(/^ASE-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it("hashes keys case-insensitively", () => {
    const a = hashLicenseKey("ASE-AAAA-BBBB-CCCC-DDDD");
    const b = hashLicenseKey("ase-aaaa-bbbb-cccc-dddd");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("normalizes domains from site URLs", () => {
    expect(normalizeDomain("https://www.Example.be/path")).toBe("example.be");
    expect(normalizeDomain("example.be")).toBe("example.be");
    expect(normalizeDomain("")).toBe("");
    expect(normalizeDomain("not a url")).toBe("");
  });

  it("isLicenseUsable rejects pending/revoked/expired", () => {
    expect(isLicenseUsable("pending", null)).toBe(false);
    expect(isLicenseUsable("revoked", null)).toBe(false);
    expect(isLicenseUsable("expired", null)).toBe(false);
    expect(isLicenseUsable("issued", null)).toBe(true);
    expect(isLicenseUsable("active", null)).toBe(true);
    expect(isLicenseUsable("active", new Date(Date.now() - 1000))).toBe(false);
  });
});

describe("createLicenseForEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid email", async () => {
    const result = await createLicenseForEmail({ email: "not-an-email" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid_email");
    expect(prisma.aseLicense.create).not.toHaveBeenCalled();
  });

  it("creates an issued license and returns plaintext key once", async () => {
    const row = {
      id: "lic_1",
      email: "klant@voorbeeld.be",
      name: "Jan",
      status: "issued",
      keyPrefix: "ASE-AAAA",
    };
    vi.mocked(prisma.aseLicense.create).mockResolvedValue(row as never);

    const result = await createLicenseForEmail({
      email: " Klant@Voorbeeld.be ",
      name: "Jan",
      siteUrl: "https://www.voorbeeld.be",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.key).toMatch(/^ASE-/);
    expect(result.license).toEqual(row);
    expect(prisma.aseLicense.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "issued",
        email: "klant@voorbeeld.be",
        name: "Jan",
        domain: "voorbeeld.be",
        keyHash: hashLicenseKey(result.key),
        keyPrefix: result.key.slice(0, 12),
      }),
    });
  });
});

describe("issueLicense", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not_found when missing", async () => {
    vi.mocked(prisma.aseLicense.findUnique).mockResolvedValue(null);
    const result = await issueLicense("missing");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("not_found");
  });

  it("returns revoked when license is revoked", async () => {
    vi.mocked(prisma.aseLicense.findUnique).mockResolvedValue({
      id: "lic_1",
      status: "revoked",
    } as never);
    const result = await issueLicense("lic_1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("revoked");
  });

  it("issues a new key for pending requests", async () => {
    vi.mocked(prisma.aseLicense.findUnique).mockResolvedValue({
      id: "lic_1",
      status: "pending",
      issuedAt: null,
      email: "a@b.be",
    } as never);
    vi.mocked(prisma.aseLicense.update).mockImplementation(async ({ data }) => ({
      id: "lic_1",
      email: "a@b.be",
      status: (data as { status: string }).status,
      keyPrefix: (data as { keyPrefix: string }).keyPrefix,
    }) as never);

    const result = await issueLicense("lic_1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.key).toMatch(/^ASE-/);
    expect(result.license.status).toBe("issued");
  });
});
