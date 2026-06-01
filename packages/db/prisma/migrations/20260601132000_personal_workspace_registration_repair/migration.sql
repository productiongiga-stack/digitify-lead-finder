-- Global registrations should receive a personal workspace, not the website-owner workspace.
-- Targeted team invitations keep targetWorkspaceOwnerId and remain shared workspaces.
WITH personal_users AS (
  SELECT
    u."id" AS user_id,
    u."workspaceOwnerId" AS old_workspace_id
  FROM "users" u
  JOIN "registration_requests" r ON lower(r."email") = lower(u."email")
  WHERE r."status" = 'APPROVED'
    AND r."targetWorkspaceOwnerId" IS NULL
    AND u."workspaceOwnerId" IS NOT NULL
    AND u."role" IN ('MEMBER', 'TRIAL', 'TESTER', 'VIEWER')
)
UPDATE "leads" lead
SET
  "createdById" = personal_users.user_id,
  "assignedToId" = CASE WHEN lead."assignedToId" = personal_users.user_id THEN lead."assignedToId" ELSE NULL END,
  "pipelineStageId" = NULL
FROM personal_users
WHERE lead."createdById" = personal_users.old_workspace_id
  AND lead."savedById" = personal_users.user_id;

DELETE FROM "lead_tags" lt
USING "leads" lead, "tags" tag
WHERE lt."leadId" = lead."id"
  AND lt."tagId" = tag."id"
  AND tag."createdById" IS DISTINCT FROM lead."createdById";

DELETE FROM "campaign_leads" cl
USING "leads" lead, "campaigns" campaign
WHERE cl."leadId" = lead."id"
  AND cl."campaignId" = campaign."id"
  AND campaign."createdById" IS DISTINCT FROM lead."createdById";

WITH personal_users AS (
  SELECT u."id" AS user_id
  FROM "users" u
  JOIN "registration_requests" r ON lower(r."email") = lower(u."email")
  WHERE r."status" = 'APPROVED'
    AND r."targetWorkspaceOwnerId" IS NULL
    AND u."workspaceOwnerId" IS NOT NULL
    AND u."role" IN ('MEMBER', 'TRIAL', 'TESTER', 'VIEWER')
)
UPDATE "users" u
SET "workspaceOwnerId" = NULL
FROM personal_users
WHERE u."id" = personal_users.user_id;
