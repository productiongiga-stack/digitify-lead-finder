import { describe, expect, it, vi } from "vitest";
import { reconcileStaleMediaJobs } from "../lib/reconcile-media-jobs";

vi.mock("../lib/muapi-key", () => ({
  loadUserMuapiKey: vi.fn().mockResolvedValue("test-key"),
}));

vi.mock("@digitify/media-studio", async (importActual) => {
  const actual = await importActual<typeof import("@digitify/media-studio")>();
  return {
    ...actual,
    fetchMuapiResultOnce: vi.fn().mockResolvedValue({
      status: "succeeded",
      url: "https://example.com/output.png",
    }),
    isTerminalSuccess: vi.fn().mockReturnValue(true),
    isTerminalFailure: vi.fn().mockReturnValue(false),
  };
});

describe("reconcileStaleMediaJobs", () => {
  it("reconciles stale processing jobs", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "job_1",
        userId: "user_1",
        requestId: "req_1",
        status: "PROCESSING",
      },
    ]);
    const update = vi.fn().mockResolvedValue({});
    const db = { mediaGeneration: { findMany, update } } as any;

    const summary = await reconcileStaleMediaJobs(db);
    expect(summary.scanned).toBe(1);
    expect(summary.completed).toBe(1);
    expect(update).toHaveBeenCalled();
  });
});
