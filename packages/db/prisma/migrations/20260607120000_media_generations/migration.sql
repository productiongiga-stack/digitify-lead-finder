-- CreateEnum
CREATE TYPE "MediaGenerationType" AS ENUM ('IMAGE', 'VIDEO', 'MARKETING_AD');

-- CreateEnum
CREATE TYPE "MediaGenerationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "media_generations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "MediaGenerationType" NOT NULL,
    "model" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" "MediaGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "requestId" TEXT,
    "outputUrl" TEXT,
    "blobUrl" TEXT,
    "metadata" JSONB,
    "socialPostId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_generations_workspaceId_createdAt_idx" ON "media_generations"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "media_generations_userId_createdAt_idx" ON "media_generations"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "media_generations_status_updatedAt_idx" ON "media_generations"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "media_generations" ADD CONSTRAINT "media_generations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
