CREATE TABLE "account_view_sessions" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'VIEW_AS',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "account_view_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_view_sessions_tokenHash_key" ON "account_view_sessions"("tokenHash");
CREATE INDEX "account_view_sessions_actorUserId_endedAt_expiresAt_idx" ON "account_view_sessions"("actorUserId", "endedAt", "expiresAt");
CREATE INDEX "account_view_sessions_targetUserId_endedAt_expiresAt_idx" ON "account_view_sessions"("targetUserId", "endedAt", "expiresAt");
CREATE INDEX "account_view_sessions_workspaceId_createdAt_idx" ON "account_view_sessions"("workspaceId", "createdAt" DESC);

CREATE TABLE "security_audit_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "actorUserId" TEXT,
    "targetUserId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resourceId" TEXT,
    "result" TEXT NOT NULL,
    "reason" TEXT,
    "requestId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "security_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "security_audit_events_workspaceId_createdAt_idx" ON "security_audit_events"("workspaceId", "createdAt" DESC);
CREATE INDEX "security_audit_events_actorUserId_createdAt_idx" ON "security_audit_events"("actorUserId", "createdAt" DESC);
CREATE INDEX "security_audit_events_targetUserId_createdAt_idx" ON "security_audit_events"("targetUserId", "createdAt" DESC);
CREATE INDEX "security_audit_events_action_createdAt_idx" ON "security_audit_events"("action", "createdAt" DESC);
