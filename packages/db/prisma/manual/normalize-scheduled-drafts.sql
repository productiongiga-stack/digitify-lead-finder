-- Legacy: SCHEDULED on email_drafts was "planned send" but must remain concept until admin approval.
UPDATE email_drafts
SET status = 'DRAFT'
WHERE status = 'SCHEDULED'
  AND sent_at IS NULL;
