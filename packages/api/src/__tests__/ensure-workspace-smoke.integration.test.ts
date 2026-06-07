import { describe, expect, it } from "vitest";
import { PrismaClient } from "@digitify/db";
import { ensureUserWorkspace } from "../lib/user-workspace";

const run = process.env.RUN_DB_INTEGRATION === "1" ? it : it.skip;

describe("ensureUserWorkspace integration", () => {
  run("initializes active workspace without FK errors", async () => {
    const db = new PrismaClient();
    try {
      const admin = await db.user.findFirst({
        where: { email: "admin@digitify.local" },
        select: { id: true, activeWorkspaceId: true },
      });
      expect(admin).toBeTruthy();

      const workspaceId = admin!.activeWorkspaceId || admin!.id;
      await expect(ensureUserWorkspace(db, workspaceId, "Digitify")).resolves.toBeUndefined();

      const team = await db.workspace.findFirst({
        where: { type: "TEAM" },
        select: { id: true },
      });
      if (team) {
        await expect(ensureUserWorkspace(db, team.id, "Team workspace")).resolves.toBeUndefined();
      }
    } finally {
      await db.$disconnect();
    }
  });
});
