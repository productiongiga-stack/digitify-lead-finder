ALTER TABLE ad_sync_operations ADD COLUMN "resourceKey" TEXT;
CREATE UNIQUE INDEX "ad_sync_operations_resourceKey_key" ON ad_sync_operations("resourceKey");
