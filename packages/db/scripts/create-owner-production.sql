-- Run in Supabase SQL Editor (production DB for leads.digitify.be)
-- Creates OWNER account contact@digitify.be with personal workspace

DO $$
DECLARE
  uid text;
  pwd text := 'c14a9cb637f5dbd43a2a1ea9f41970c6:6fd6c25ace7edd3f2310f0e852a91e27873621f462f2d976f0394347d081dc20b9ad468653249bb1ee99cf2522be71639fec3152116c5a59d0c73a0fc12d19cb';
BEGIN
  SELECT id INTO uid FROM users WHERE email = 'contact@digitify.be';

  IF uid IS NULL THEN
    uid := 'cmqcontactdigitify01';
    INSERT INTO users (id, email, name, "passwordHash", "emailVerified", role, "createdAt", "updatedAt")
    VALUES (uid, 'contact@digitify.be', 'Digitify Contact', pwd, NOW(), 'OWNER', NOW(), NOW());
  ELSE
    UPDATE users
    SET role = 'OWNER',
        name = 'Digitify Contact',
        "passwordHash" = pwd,
        "emailVerified" = NOW(),
        "workspaceOwnerId" = NULL,
        "updatedAt" = NOW()
    WHERE id = uid;
  END IF;

  INSERT INTO workspaces (id, name, type, "ownerUserId", "createdAt", "updatedAt")
  VALUES (uid, 'Digitify Contact — persoonlijk', 'PERSONAL', uid, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      type = 'PERSONAL',
      "updatedAt" = NOW();

  INSERT INTO workspace_memberships (id, "workspaceId", "userId", role, status, "createdAt", "updatedAt")
  VALUES ('cmqcontactdigitify01m', uid, uid, 'OWNER', 'ACTIVE', NOW(), NOW())
  ON CONFLICT ("workspaceId", "userId") DO UPDATE
  SET role = 'OWNER',
      status = 'ACTIVE',
      "updatedAt" = NOW();

  UPDATE users
  SET "activeWorkspaceId" = uid,
      "updatedAt" = NOW()
  WHERE id = uid;
END $$;
