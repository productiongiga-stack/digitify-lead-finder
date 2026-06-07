-- createdById stores the workspace tenant id (personal user id or team workspace id),
-- not always a users.id row. Drop user FK constraints on starter-pack tables.

ALTER TABLE "pipeline_stages" DROP CONSTRAINT IF EXISTS "pipeline_stages_createdById_fkey";
ALTER TABLE "tags" DROP CONSTRAINT IF EXISTS "tags_createdById_fkey";
ALTER TABLE "email_templates" DROP CONSTRAINT IF EXISTS "email_templates_createdById_fkey";
ALTER TABLE "service_catalog" DROP CONSTRAINT IF EXISTS "service_catalog_createdById_fkey";
