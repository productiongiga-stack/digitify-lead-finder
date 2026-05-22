import { describe, expect, it } from "vitest";
import {
  planWorkspaceSettingsMigration,
  resolveWorkspaceOwnerIds,
  workspaceSettingKey,
} from "../lib/migrate-workspace-settings";

describe("migrate workspace settings plan", () => {
  it("copies shared legacy keys only", () => {
    const workspaceId = "owner_1";
    const plan = planWorkspaceSettingsMigration(
      workspaceId,
      [
        { key: "user:owner_1:email.smtp_host", value: "smtp.example.com" },
        { key: "user:owner_1:modules.disabled", value: [] },
        { key: "user:owner_1:display.theme", value: "dark" },
      ],
      new Set(),
    );

    expect(plan.filter((item) => item.action === "copy")).toHaveLength(1);
    expect(plan.find((item) => item.logicalKey === "email.smtp_host")?.workspaceKey).toBe(
      workspaceSettingKey(workspaceId, "email.smtp_host"),
    );
    expect(plan.filter((item) => item.action === "skip_member")).toHaveLength(2);
  });

  it("skips when workspace key already exists", () => {
    const workspaceId = "owner_1";
    const existing = new Set([workspaceSettingKey(workspaceId, "branding.company_name")]);
    const plan = planWorkspaceSettingsMigration(
      workspaceId,
      [{ key: "user:owner_1:branding.company_name", value: "Acme" }],
      existing,
    );
    expect(plan[0]?.action).toBe("skip_exists");
  });

  it("resolves workspace owner ids from users", async () => {
    const ids = await resolveWorkspaceOwnerIds([
      { id: "owner", role: "OWNER", workspaceOwnerId: null },
      { id: "mem", role: "MEMBER", workspaceOwnerId: "owner" },
    ]);
    expect(ids.sort()).toEqual(["owner"]);
  });
});
