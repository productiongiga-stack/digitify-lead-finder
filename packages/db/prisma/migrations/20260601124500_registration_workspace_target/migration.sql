-- Tie team invitations and registration approvals to a specific workspace.
ALTER TABLE "registration_requests"
ADD COLUMN "targetWorkspaceOwnerId" TEXT,
ADD COLUMN "invitedById" TEXT;

CREATE INDEX "registration_requests_targetWorkspaceOwnerId_status_createdAt_idx"
ON "registration_requests"("targetWorkspaceOwnerId", "status", "createdAt");

CREATE INDEX "registration_requests_invitedById_idx"
ON "registration_requests"("invitedById");
