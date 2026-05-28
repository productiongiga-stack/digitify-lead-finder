import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lib/user-json-setting", () => ({
  readWorkspaceJsonSetting: vi.fn(),
  writeWorkspaceJsonSetting: vi.fn(),
}));

import {
  countLegacyLibraryEntries,
  migrateLegacyTemplateLibrary,
} from "../lib/migrate-legacy-template-library";
import { readWorkspaceJsonSetting, writeWorkspaceJsonSetting } from "../lib/user-json-setting";

const scope = { workspaceId: "ws_1", memberId: "mem_1" };

describe("migrateLegacyTemplateLibrary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts valid legacy entries only", () => {
    expect(
      countLegacyLibraryEntries([
        { id: "1", type: "EMAIL", name: "A", subject: "S", content: "Body" },
        { broken: true },
      ]),
    ).toBe(1);
  });

  it("migrates templates and clears library JSON", async () => {
    vi.mocked(readWorkspaceJsonSetting)
      .mockResolvedValueOnce([
        { id: "1", type: "EMAIL", name: "Old intro", subject: "Hi", content: "Hello" },
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(writeWorkspaceJsonSetting).mockResolvedValue({} as never);

    const findMany = vi.fn().mockResolvedValue([]);
    const create = vi.fn().mockResolvedValue({ id: "tpl_1" });
    const db = {
      emailTemplate: { findMany, create },
    } as never;

    const result = await migrateLegacyTemplateLibrary(db, scope);

    expect(result.migrated).toBe(1);
    expect(result.remaining).toBe(0);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdById: "ws_1",
          name: "[Legacy] Old intro",
        }),
      }),
    );
    expect(writeWorkspaceJsonSetting).toHaveBeenCalledWith(db, scope, "templates.library_json", []);
  });

  it("returns zero when library is empty", async () => {
    vi.mocked(readWorkspaceJsonSetting).mockResolvedValue([]);
    const db = {
      emailTemplate: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
    } as never;

    const result = await migrateLegacyTemplateLibrary(db, scope);
    expect(result).toEqual({ migrated: 0, remaining: 0 });
  });
});
