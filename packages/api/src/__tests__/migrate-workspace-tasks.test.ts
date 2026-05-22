import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lib/user-json-setting", () => ({
  readWorkspaceJsonSetting: vi.fn(),
}));

import { readWorkspaceJsonSetting } from "../lib/user-json-setting";
import { migrateLegacyWorkspaceTasks } from "../lib/migrate-workspace-tasks";

describe("migrateLegacyWorkspaceTasks", () => {
  beforeEach(() => {
    vi.mocked(readWorkspaceJsonSetting).mockReset();
  });

  it("imports JSON tasks when table is empty", async () => {
    vi.mocked(readWorkspaceJsonSetting).mockResolvedValue([
      {
        id: "task-1",
        title: "Bel bakker",
        description: "",
        status: "TODO",
        priority: "MEDIUM",
        dueAt: null,
        relatedType: null,
        relatedId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);

    const db = {
      workspaceTask: {
        count: vi.fn().mockResolvedValue(0),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const result = await migrateLegacyWorkspaceTasks(db as any, {
      workspaceId: "ws-1",
      memberId: "ws-1",
    });

    expect(result.imported).toBe(1);
    expect(db.workspaceTask.createMany).toHaveBeenCalled();
  });

  it("skips when tasks already exist", async () => {
    const db = {
      workspaceTask: { count: vi.fn().mockResolvedValue(2) },
    };
    const result = await migrateLegacyWorkspaceTasks(db as any, {
      workspaceId: "ws-1",
      memberId: "ws-1",
    });
    expect(result.imported).toBe(0);
    expect(readWorkspaceJsonSetting).not.toHaveBeenCalled();
  });
});
