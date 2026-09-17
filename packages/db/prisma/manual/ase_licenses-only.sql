-- Manual catch-up for ASE licenses (safe to re-run).
-- Apply in Supabase SQL Editor if `prisma migrate deploy` is unavailable.
-- Migration name: 20260916170000_ase_licenses

CREATE TABLE IF NOT EXISTS "ase_licenses" (
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
);

CREATE UNIQUE INDEX IF NOT EXISTS "ase_licenses_keyHash_key" ON "ase_licenses"("keyHash");
CREATE INDEX IF NOT EXISTS "ase_licenses_status_createdAt_idx" ON "ase_licenses"("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ase_licenses_email_idx" ON "ase_licenses"("email");
CREATE INDEX IF NOT EXISTS "ase_licenses_domain_idx" ON "ase_licenses"("domain");

-- After running this SQL, mark the Prisma migration applied (from repo root, with DIRECT_URL):
--   pnpm --filter @digitify/db exec prisma migrate resolve --applied 20260916170000_ase_licenses
