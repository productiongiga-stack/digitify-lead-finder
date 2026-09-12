CREATE TYPE "LeadFormStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "lead_forms" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "status" "LeadFormStatus" NOT NULL DEFAULT 'DRAFT',
    "fields" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lead_forms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_submissions" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "leadId" TEXT,
    "fingerprint" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lead_forms_publicKey_key" ON "lead_forms"("publicKey");
CREATE INDEX "lead_forms_createdById_status_idx" ON "lead_forms"("createdById", "status");
CREATE UNIQUE INDEX "form_submissions_formId_fingerprint_key" ON "form_submissions"("formId", "fingerprint");
CREATE INDEX "form_submissions_formId_createdAt_idx" ON "form_submissions"("formId", "createdAt" DESC);
CREATE INDEX "form_submissions_leadId_idx" ON "form_submissions"("leadId");

ALTER TABLE "lead_forms" ADD CONSTRAINT "lead_forms_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_formId_fkey" FOREIGN KEY ("formId") REFERENCES "lead_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
