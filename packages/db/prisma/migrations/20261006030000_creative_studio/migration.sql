-- CreateTable
CREATE TABLE "creative_drafts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "state" JSONB NOT NULL,
    "jobId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creative_wallets" (
    "userId" TEXT NOT NULL,
    "available" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_wallets_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "creative_ledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creative_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creative_reservations" (
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_reservations_pkey" PRIMARY KEY ("jobId")
);

-- CreateTable
CREATE TABLE "creative_prices" (
    "key" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "credits" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_prices_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "creative_bundles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creative_purchases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "sessionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "creative_drafts_userId_workspaceId_updatedAt_idx" ON "creative_drafts"("userId", "workspaceId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "creative_ledger_reference_key" ON "creative_ledger"("reference");

-- CreateIndex
CREATE INDEX "creative_ledger_userId_createdAt_idx" ON "creative_ledger"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "creative_purchases_sessionId_key" ON "creative_purchases"("sessionId");


ALTER TABLE "creative_drafts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "creative_drafts" FORCE ROW LEVEL SECURITY;
CREATE POLICY server_only ON "creative_drafts" USING (current_user NOT IN ('anon', 'authenticated', 'authenticator')) WITH CHECK (current_user NOT IN ('anon', 'authenticated', 'authenticator'));
REVOKE ALL ON "creative_drafts" FROM PUBLIC;

ALTER TABLE "creative_wallets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "creative_wallets" FORCE ROW LEVEL SECURITY;
CREATE POLICY server_only ON "creative_wallets" USING (current_user NOT IN ('anon', 'authenticated', 'authenticator')) WITH CHECK (current_user NOT IN ('anon', 'authenticated', 'authenticator'));
REVOKE ALL ON "creative_wallets" FROM PUBLIC;

ALTER TABLE "creative_ledger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "creative_ledger" FORCE ROW LEVEL SECURITY;
CREATE POLICY server_only ON "creative_ledger" USING (current_user NOT IN ('anon', 'authenticated', 'authenticator')) WITH CHECK (current_user NOT IN ('anon', 'authenticated', 'authenticator'));
REVOKE ALL ON "creative_ledger" FROM PUBLIC;

ALTER TABLE "creative_reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "creative_reservations" FORCE ROW LEVEL SECURITY;
CREATE POLICY server_only ON "creative_reservations" USING (current_user NOT IN ('anon', 'authenticated', 'authenticator')) WITH CHECK (current_user NOT IN ('anon', 'authenticated', 'authenticator'));
REVOKE ALL ON "creative_reservations" FROM PUBLIC;

ALTER TABLE "creative_prices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "creative_prices" FORCE ROW LEVEL SECURITY;
CREATE POLICY server_only ON "creative_prices" USING (current_user NOT IN ('anon', 'authenticated', 'authenticator')) WITH CHECK (current_user NOT IN ('anon', 'authenticated', 'authenticator'));
REVOKE ALL ON "creative_prices" FROM PUBLIC;

ALTER TABLE "creative_bundles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "creative_bundles" FORCE ROW LEVEL SECURITY;
CREATE POLICY server_only ON "creative_bundles" USING (current_user NOT IN ('anon', 'authenticated', 'authenticator')) WITH CHECK (current_user NOT IN ('anon', 'authenticated', 'authenticator'));
REVOKE ALL ON "creative_bundles" FROM PUBLIC;

ALTER TABLE "creative_purchases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "creative_purchases" FORCE ROW LEVEL SECURITY;
CREATE POLICY server_only ON "creative_purchases" USING (current_user NOT IN ('anon', 'authenticated', 'authenticator')) WITH CHECK (current_user NOT IN ('anon', 'authenticated', 'authenticator'));
REVOKE ALL ON "creative_purchases" FROM PUBLIC;

DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digitify_app') THEN
GRANT SELECT, INSERT, UPDATE, DELETE ON creative_drafts, creative_wallets, creative_ledger, creative_reservations, creative_prices, creative_bundles, creative_purchases TO digitify_app;
END IF;
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
REVOKE ALL ON creative_drafts, creative_wallets, creative_ledger, creative_reservations, creative_prices, creative_bundles, creative_purchases FROM anon;
END IF;
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
REVOKE ALL ON creative_drafts, creative_wallets, creative_ledger, creative_reservations, creative_prices, creative_bundles, creative_purchases FROM authenticated;
END IF;
END $$;
