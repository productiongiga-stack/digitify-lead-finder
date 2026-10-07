CREATE TABLE "creative_subscriptions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "stripeSubscriptionId" TEXT NOT NULL,
  "stripeCustomerId" TEXT,
  "priceId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'INCOMPLETE',
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "creative_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "creative_stripe_events" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "creative_stripe_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "creative_subscriptions_stripeSubscriptionId_key" ON "creative_subscriptions"("stripeSubscriptionId");
CREATE INDEX "creative_subscriptions_userId_workspaceId_status_idx" ON "creative_subscriptions"("userId", "workspaceId", "status");
CREATE UNIQUE INDEX "creative_stripe_events_eventId_key" ON "creative_stripe_events"("eventId");
ALTER TABLE "creative_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "creative_subscriptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY server_only ON "creative_subscriptions" USING (current_user NOT IN ('anon', 'authenticated', 'authenticator')) WITH CHECK (current_user NOT IN ('anon', 'authenticated', 'authenticator'));
ALTER TABLE "creative_stripe_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "creative_stripe_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY server_only ON "creative_stripe_events" USING (current_user NOT IN ('anon', 'authenticated', 'authenticator')) WITH CHECK (current_user NOT IN ('anon', 'authenticated', 'authenticator'));
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digitify_app') THEN
  GRANT SELECT, INSERT, UPDATE, DELETE ON creative_subscriptions, creative_stripe_events TO digitify_app;
END IF;
END $$;
