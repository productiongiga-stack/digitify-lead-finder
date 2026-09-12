-- Historical failures do not distinguish rejection from acceptance followed by a timeout.
UPDATE "email_drafts" SET "status" = 'DELIVERY_UNKNOWN',
  "rejectionNote" = 'Eerdere verzendpoging vereist controle bij de mailprovider.'
WHERE "status" IN ('FAILED', 'SENDING');
