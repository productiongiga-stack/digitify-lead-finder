CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'SIGNED', 'DECLINED', 'EXPIRED');

CREATE TABLE "contracts" (
  "id" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "projectId" TEXT,
  "quoteId" TEXT,
  "name" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "clientEmail" TEXT,
  "content" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
  "sentAt" TIMESTAMP(3),
  "viewedAt" TIMESTAMP(3),
  "signedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "contracts_createdById_status_updatedAt_idx" ON "contracts"("createdById", "status", "updatedAt" DESC);
CREATE INDEX "contracts_createdById_projectId_idx" ON "contracts"("createdById", "projectId");
CREATE INDEX "contracts_createdById_quoteId_idx" ON "contracts"("createdById", "quoteId");
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
