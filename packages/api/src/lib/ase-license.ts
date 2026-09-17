import { createHash, randomBytes } from "crypto";
import { PrismaClient, prisma } from "@digitify/db";

export type AseLicenseStatus = "pending" | "issued" | "active" | "revoked" | "expired";

const ASE_LICENSE_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS "ase_licenses" (
    "id" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "email" TEXT NOT NULL,
    "name" TEXT,
    "siteUrl" TEXT,
    "domain" TEXT,
    "message" TEXT,
    "issuedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ase_licenses_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ase_licenses_keyHash_key" ON "ase_licenses"("keyHash")`,
  `CREATE INDEX IF NOT EXISTS "ase_licenses_status_createdAt_idx" ON "ase_licenses"("status", "createdAt" DESC)`,
  `CREATE INDEX IF NOT EXISTS "ase_licenses_email_idx" ON "ase_licenses"("email")`,
  `CREATE INDEX IF NOT EXISTS "ase_licenses_domain_idx" ON "ase_licenses"("domain")`,
] as const;

const ASE_SCHEMA_FAILURE_RETRY_MS = 5 * 60 * 1000;

let aseSchemaEnsurePromise: Promise<void> | null = null;
let aseSchemaEnsured = false;
let aseSchemaFailedAt = 0;

/** Prefer DIRECT_URL / non-pooling for DDL; transaction poolers often reject CREATE. */
function resolveDdlDatabaseUrl() {
  const candidates = [
    process.env.DIRECT_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DATABASE_URL,
  ];
  for (const value of candidates) {
    const url = value?.trim();
    if (!url) continue;
    if (url.includes("pooler") && candidates.some((c) => c?.trim() && !c.includes("pooler"))) {
      continue;
    }
    return url;
  }
  return process.env.DATABASE_URL?.trim() || "";
}

function errorText(err: unknown): string {
  if (!err || typeof err !== "object") return String(err ?? "");
  const metaMsg =
    typeof (err as { meta?: { message?: unknown } }).meta?.message === "string"
      ? (err as { meta: { message: string } }).meta.message
      : "";
  return [(err as { message?: string }).message, (err as { code?: string }).code, metaMsg]
    .filter(Boolean)
    .join(" ");
}

/**
 * Idempotent catch-up when migration `20260916170000_ase_licenses` was not deployed yet.
 * Soft-fails on DDL permission/pooler errors so public routes can still return 503 unavailable
 * (via P2021 on the subsequent query) instead of opaque 500.
 */
export async function ensureAseLicensesSchema() {
  if (aseSchemaEnsured) return;
  const now = Date.now();
  if (aseSchemaFailedAt > 0 && now - aseSchemaFailedAt < ASE_SCHEMA_FAILURE_RETRY_MS) {
    return;
  }
  if (aseSchemaEnsurePromise) {
    await aseSchemaEnsurePromise;
    return;
  }

  aseSchemaEnsurePromise = (async () => {
    const ddlUrl = resolveDdlDatabaseUrl();
    const appUrl = (process.env.DATABASE_URL || "").trim();
    const useDedicated = Boolean(ddlUrl) && ddlUrl !== appUrl;

    let ddlPrisma: PrismaClient = prisma;
    let dedicated: PrismaClient | null = null;
    if (useDedicated) {
      dedicated = new PrismaClient({
        datasources: { db: { url: ddlUrl } },
      });
      ddlPrisma = dedicated;
    }

    try {
      for (const statement of ASE_LICENSE_SCHEMA_SQL) {
        await ddlPrisma.$executeRawUnsafe(statement);
      }
      aseSchemaEnsured = true;
      aseSchemaFailedAt = 0;
    } catch (err) {
      aseSchemaFailedAt = Date.now();
      console.warn(
        "[ase-license] schema ensure failed — run migrate or ase_licenses-only.sql:",
        errorText(err).slice(0, 240),
      );
    } finally {
      if (dedicated) {
        await dedicated.$disconnect().catch(() => undefined);
      }
    }
  })().finally(() => {
    aseSchemaEnsurePromise = null;
  });

  await aseSchemaEnsurePromise;
}

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

/** Missing table/column, or DDL ensure failure that would otherwise become opaque 500. */
export function isAseLicenseUnavailableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  if (code === "P2021" || code === "P2022") return true;
  const text = errorText(err).toLowerCase();
  if (code === "P2010" && (text.includes("ase_licenses") || text.includes("does not exist") || text.includes("42501") || text.includes("permission denied"))) {
    return true;
  }
  if (text.includes("ase_licenses") && (text.includes("does not exist") || text.includes("permission denied") || text.includes("42501"))) {
    return true;
  }
  return false;
}

export async function findLicenseByKey(key: string) {
  await ensureAseLicensesSchema();
  const keyHash = hashLicenseKey(key);
  return prisma.aseLicense.findUnique({ where: { keyHash } });
}

export async function createLicenseRequest(input: {
  email: string;
  name?: string;
  siteUrl?: string;
  message?: string;
}) {
  await ensureAseLicensesSchema();
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
  await ensureAseLicensesSchema();
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
  await ensureAseLicensesSchema();
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
