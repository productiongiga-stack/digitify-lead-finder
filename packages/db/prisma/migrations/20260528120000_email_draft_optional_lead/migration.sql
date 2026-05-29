-- Allow inbox outbound without a linked lead
ALTER TABLE "email_drafts" ALTER COLUMN "leadId" DROP NOT NULL;
