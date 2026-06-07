-- CreateTable
CREATE TABLE "workspace_analytics_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT,
    "userId" TEXT,
    "sessionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_analytics_events_workspaceId_createdAt_idx" ON "workspace_analytics_events"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "workspace_analytics_events_workspaceId_category_createdAt_idx" ON "workspace_analytics_events"("workspaceId", "category", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "workspace_analytics_events_userId_createdAt_idx" ON "workspace_analytics_events"("userId", "createdAt" DESC);
