import { describe, expect, it } from "vitest";
import { workspaceSettingKey } from "../lib/workspace-settings";
import { userSettingKey } from "../lib/user-settings";

const WORKSPACE_INIT_KEY = "workspace.initialized_v2";

describe("workspace initialization keys", () => {
  it("uses workspace-scoped init key for team workspaces", () => {
    const teamWorkspaceId = "clteamworkspace123";
    expect(workspaceSettingKey(teamWorkspaceId, WORKSPACE_INIT_KEY)).toBe(
      "workspace:clteamworkspace123:workspace.initialized_v2",
    );
  });

  it("keeps legacy personal init key for backwards compatibility", () => {
    const userId = "clpersonaluser123";
    expect(userSettingKey(userId, WORKSPACE_INIT_KEY)).toBe(
      "user:clpersonaluser123:workspace.initialized_v2",
    );
  });
});
