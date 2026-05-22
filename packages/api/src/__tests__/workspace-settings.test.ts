import { describe, expect, it, vi } from "vitest";
import {
  isMemberScopedSettingKey,
  loadWorkspaceSettingRows,
  resolveSettingDbKey,
  workspaceSettingKey,
} from "../lib/workspace-settings";

describe("workspace settings scope", () => {
  it("routes shared keys to workspace storage", () => {
    expect(resolveSettingDbKey({ workspaceId: "ws_owner", memberId: "mem_1" }, "email.smtp_host")).toBe(
      "workspace:ws_owner:email.smtp_host",
    );
  });

  it("keeps member-only keys on the member", () => {
    expect(resolveSettingDbKey({ workspaceId: "ws_owner", memberId: "mem_1" }, "modules.disabled")).toBe(
      "user:mem_1:modules.disabled",
    );
    expect(isMemberScopedSettingKey("display.theme")).toBe(true);
  });

  it("prefers workspace prefix over legacy user owner prefix", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { key: workspaceSettingKey("ws_owner", "branding.company_name"), value: "Workspace Co" },
      { key: "user:ws_owner:branding.company_name", value: "Legacy Co" },
    ]);
    const db = { setting: { findMany } } as any;

    const rows = await loadWorkspaceSettingRows(
      db,
      { workspaceId: "ws_owner", memberId: "mem_1" },
      ["branding.company_name"],
    );

    expect(rows).toEqual([{ key: "branding.company_name", value: "Workspace Co" }]);
  });
});
