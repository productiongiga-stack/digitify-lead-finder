-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE INDEX "leads_gmbPlaceId_idx" ON "leads"("gmbPlaceId");

-- CreateIndex
CREATE INDEX "leads_createdById_gmbPlaceId_idx" ON "leads"("createdById", "gmbPlaceId");

-- CreateIndex
CREATE INDEX "notes_leadId_idx" ON "notes"("leadId");

-- CreateIndex
CREATE INDEX "lead_contacts_leadId_idx" ON "lead_contacts"("leadId");
