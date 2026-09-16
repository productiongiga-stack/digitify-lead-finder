import { createHash, randomBytes } from "crypto";
import { prisma } from "@digitify/db";

export type AseLicenseStatus = "pending" | "issued" | "active" | "revoked" | "expired";

export function hashLicenseKey(key: string) {
  return createHash("sha256").update(String(key).trim().toUpperCase()).digest("hex");
}

export function generateLicenseKey() {
  const parts = [];
  for (let i = 0; i < 4; i += 1) {
    parts.push(randomBytes(2).toString("hex").toUpperCase());
  }
  return `ASE-${parts.join("-")}`;
}

export function normalizeDomain(siteUrl: string) {
  try {
    const raw = String(siteUrl || "").trim();
    if (!raw) return "";
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withProto);
    return u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

export function isLicenseUsable(status: string, expiresAt: Date | null | undefined) {
  if (status === "revoked" || status === "expired" || status === "pending") return false;
  if (status !== "active" && status !== "issued") return false;
  if (expiresAt && expiresAt.getTime() < Date.now()) return false;
  return true;
}

/** Prisma P2021/P2022 when `ase_licenses` migration is not applied yet. */
export function isAseLicenseUnavailableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  return code === "P2021" || code === "P2022";
}

export async function findLicenseByKey(key: string) {
  const keyHash = hashLicenseKey(key);
  return prisma.aseLicense.findUnique({ where: { keyHash } });
}

export async function createLicenseRequest(input: {
  email: string;
  name?: string;
  siteUrl?: string;
  message?: string;
}) {
  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  const domain = input.siteUrl ? normalizeDomain(input.siteUrl) : null;
  // Placeholder hash until issued (unique per request).
  const pendingKey = `PENDING-${randomBytes(16).toString("hex")}`;
  return prisma.aseLicense.create({
    data: {
      keyHash: hashLicenseKey(pendingKey),
      keyPrefix: "PENDING",
      status: "pending",
      email,
      name: input.name?.trim() || null,
      siteUrl: input.siteUrl?.trim() || null,
      domain: domain || null,
      message: input.message?.trim() || null,
    },
  });
}

export async function issueLicense(id: string) {
  const existing = await prisma.aseLicense.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, error: "not_found" };
  if (existing.status === "revoked") return { ok: false as const, error: "revoked" };

  const key = generateLicenseKey();
  const row = await prisma.aseLicense.update({
    where: { id },
    data: {
      keyHash: hashLicenseKey(key),
      keyPrefix: key.slice(0, 12),
      status: existing.status === "active" ? "active" : "issued",
      issuedAt: existing.issuedAt || new Date(),
    },
  });
  return { ok: true as const, key, license: row };
}

/**
 * Create an issued license directly for an email (no pending request).
 * Plaintext key is returned once; only the hash is stored.
 */
export async function createLicenseForEmail(input: {
  email: string;
  name?: string;
  siteUrl?: string;
  message?: string;
}) {
  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false as const, error: "invalid_email" };
  }

  const key = generateLicenseKey();
  const domain = input.siteUrl ? normalizeDomain(input.siteUrl) : null;
  const row = await prisma.aseLicense.create({
    data: {
      keyHash: hashLicenseKey(key),
      keyPrefix: key.slice(0, 12),
      status: "issued",
      email,
      name: input.name?.trim() || null,
      siteUrl: input.siteUrl?.trim() || null,
      domain: domain || null,
      message: input.message?.trim() || null,
      issuedAt: new Date(),
    },
  });
  return { ok: true as const, key, license: row };
}

export async function activateLicense(key: string, siteUrl: string) {
  const domain = normalizeDomain(siteUrl);
  if (!domain) return { ok: false as const, error: "invalid_site_url", status: 400 };

  const row = await findLicenseByKey(key);
  if (!row) return { ok: false as const, error: "invalid_key", status: 404 };
  if (row.status === "revoked") return { ok: false as const, error: "revoked", status: 403 };
  if (row.status === "pending") return { ok: false as const, error: "not_issued", status: 403 };
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    await prisma.aseLicense.update({
      where: { id: row.id },
      data: { status: "expired" },
    });
    return { ok: false as const, error: "expired", status: 403 };
  }

  if (row.domain && row.domain !== domain && row.status === "active") {
    return { ok: false as const, error: "domain_mismatch", status: 409 };
  }

  const updated = await prisma.aseLicense.update({
    where: { id: row.id },
    data: {
      status: "active",
      siteUrl: siteUrl.trim(),
      domain,
      activatedAt: row.activatedAt || new Date(),
      lastSeenAt: new Date(),
    },
  });

  return {
    ok: true as const,
    status: updated.status,
    expiresAt: updated.expiresAt?.toISOString() || null,
    licenseId: updated.id,
    domain: updated.domain,
  };
}

export async function validateLicense(key: string, siteUrl: string) {
  const domain = normalizeDomain(siteUrl);
  const row = await findLicenseByKey(key);
  if (!row) return { ok: false as const, error: "invalid_key", status: 404 };
  if (row.status === "revoked") return { ok: false as const, error: "revoked", status: 403 };
  if (row.status === "pending") return { ok: false as const, error: "not_issued", status: 403 };
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, error: "expired", status: 403 };
  }
  if (row.domain && domain && row.domain !== domain) {
    return { ok: false as const, error: "domain_mismatch", status: 409 };
  }
  if (!isLicenseUsable(row.status, row.expiresAt)) {
    return { ok: false as const, error: "inactive", status: 403 };
  }

  await prisma.aseLicense.update({
    where: { id: row.id },
    data: { lastSeenAt: new Date() },
  });

  return {
    ok: true as const,
    status: row.status,
    expiresAt: row.expiresAt?.toISOString() || null,
    licenseId: row.id,
    domain: row.domain,
  };
}

export async function deactivateLicense(key: string, siteUrl: string) {
  const domain = normalizeDomain(siteUrl);
  const row = await findLicenseByKey(key);
  if (!row) return { ok: false as const, error: "invalid_key", status: 404 };
  if (row.domain && domain && row.domain !== domain) {
    return { ok: false as const, error: "domain_mismatch", status: 409 };
  }
  await prisma.aseLicense.update({
    where: { id: row.id },
    data: {
      status: "issued",
      siteUrl: null,
      domain: null,
      activatedAt: null,
    },
  });
  return { ok: true as const };
}
