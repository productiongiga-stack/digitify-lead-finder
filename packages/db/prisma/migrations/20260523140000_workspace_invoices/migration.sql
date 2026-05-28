-- CreateEnum
CREATE TYPE "WorkspaceInvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "workspace_invoices" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "quoteId" TEXT,
    "leadId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT,
    "clientCompany" TEXT,
    "clientAddress" TEXT,
    "clientVat" TEXT,
    "status" "WorkspaceInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL,
    "vatAmount" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "paymentReference" TEXT NOT NULL,
    "notes" TEXT,
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "workspace_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_invoices_createdById_status_idx" ON "workspace_invoices"("createdById", "status");

-- CreateIndex
CREATE INDEX "workspace_invoices_createdById_issueDate_idx" ON "workspace_invoices"("createdById", "issueDate");

-- CreateIndex
CREATE INDEX "workspace_invoices_quoteId_idx" ON "workspace_invoices"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_invoices_createdById_invoiceNumber_key" ON "workspace_invoices"("createdById", "invoiceNumber");

-- CreateIndex
CREATE INDEX "workspace_invoice_items_invoiceId_idx" ON "workspace_invoice_items"("invoiceId");

-- AddForeignKey
ALTER TABLE "workspace_invoices" ADD CONSTRAINT "workspace_invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invoices" ADD CONSTRAINT "workspace_invoices_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invoice_items" ADD CONSTRAINT "workspace_invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "workspace_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "workspace_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_invoices" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "workspace_invoices";
CREATE POLICY workspace_isolation ON "workspace_invoices"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());

ALTER TABLE "workspace_invoice_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_invoice_items" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "workspace_invoice_items";
CREATE POLICY workspace_isolation ON "workspace_invoice_items"
  USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "workspace_invoices" i
      WHERE i.id = "workspace_invoice_items"."invoiceId"
        AND i."createdById" = app_workspace_id()
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "workspace_invoices" i
      WHERE i.id = "workspace_invoice_items"."invoiceId"
        AND i."createdById" = app_workspace_id()
    )
  );
