import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lib/user-json-setting", () => ({
  readWorkspaceJsonSetting: vi.fn(),
}));

import { readWorkspaceJsonSetting } from "../lib/user-json-setting";
import { migrateLegacyWorkspaceSavedSearches } from "../lib/migrate-workspace-saved-searches";

describe("migrateLegacyWorkspaceSavedSearches", () => {
  beforeEach(() => {
    vi.mocked(readWorkspaceJsonSetting).mockReset();
  });

  it("imports JSON saved searches when table is empty", async () => {
    vi.mocked(readWorkspaceJsonSetting).mockResolvedValue([
      {
        id: "search-1",
        name: "Bakkers Gent",
        query: "bakker",
        city: "Gent",
        country: "België",
        niche: "",
        pageSize: 20,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);

    const db = {
      workspaceSavedSearch: {
        count: vi.fn().mockResolvedValue(0),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const result = await migrateLegacyWorkspaceSavedSearches(db as any, {
      workspaceId: "ws-1",
      memberId: "ws-1",
    });

    expect(result.imported).toBe(1);
    expect(db.workspaceSavedSearch.createMany).toHaveBeenCalled();
  });

  it("skips when saved searches already exist", async () => {
    const db = {
      workspaceSavedSearch: { count: vi.fn().mockResolvedValue(1) },
    };
    const result = await migrateLegacyWorkspaceSavedSearches(db as any, {
      workspaceId: "ws-1",
      memberId: "ws-1",
    });
    expect(result.imported).toBe(0);
    expect(readWorkspaceJsonSetting).not.toHaveBeenCalled();
  });
});
