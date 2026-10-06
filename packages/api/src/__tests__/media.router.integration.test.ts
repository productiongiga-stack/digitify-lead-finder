import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

vi.mock("../lib/muapi-key", () => ({
  loadUserMuapiKey: vi.fn(),
  requireUserMuapiKey: vi.fn(),
  saveUserMuapiKey: vi.fn(),
  clearUserMuapiKey: vi.fn(),
}));

vi.mock("../lib/creative-brand", () => ({
  loadCreativeBrandContext: vi.fn().mockResolvedValue({ enabled: false, includeLogo: false }),
  saveCreativeBrandKit: vi.fn(),
  saveCreativeAutoImport: vi.fn(),
  enrichGenerationWithBrand: vi.fn((_, input) => ({
    prompt: input.prompt,
    brandApplied: false,
  })),
}));

vi.mock("@digitify/media-studio", async (importActual) => ({
  ...await importActual<typeof import("@digitify/media-studio")>(),
  fetchMuapiResultOnce: vi.fn().mockResolvedValue({status:"processing"}),
}));
import { fetchMuapiResultOnce } from "@digitify/media-studio";

import * as muapiKey from "../lib/muapi-key";
import { mediaRouter } from "../routers/media.router";

const TEST_USER_ID = "user_owner";

function makeCtx(db: Record<string, unknown> = {}) {
  return {
    db: {
      mediaGeneration: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
      },
      setting: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn() },
      ...db,
    } as any,
    user: {
      id: TEST_USER_ID,
      email: "owner@example.com",
      name: "Owner",
      role: "OWNER",
      workspaceId: TEST_USER_ID,
    },
    requestId: "req_media_test",
  };
}

describe("media router", () => {
  beforeEach(() => {
    vi.stubEnv("CREATIVE_CREDITS_ENABLED", "false");
    vi.mocked(muapiKey.loadUserMuapiKey).mockResolvedValue("");
    vi.mocked(muapiKey.requireUserMuapiKey).mockResolvedValue("test-key");
  });

  it("listModels returns EUR cost labels", async () => {
    const caller = mediaRouter.createCaller(makeCtx());
    const models = await caller.listModels();
    const flux = models.find((model) => model.id === "flux-schnell");
    expect(flux?.costLabel).toBe("€0,0028");
    expect(flux?.costDetail).toContain("per beeld");
  });

  it("getMuapiKeyStatus reflects stored key", async () => {
    vi.mocked(muapiKey.loadUserMuapiKey).mockResolvedValue("secret");
    const caller = mediaRouter.createCaller(makeCtx());
    const status = await caller.getMuapiKeyStatus();
    expect(status.hasKey).toBe(true);
  });

  it("polls a legacy job using its author's key, not the viewer's key",async()=>{
    const findFirst=vi.fn().mockResolvedValue({id:"job_shared",workspaceId:TEST_USER_ID,userId:"original_author",requestId:"provider_request",status:"PROCESSING",metadata:{},type:"IMAGE",prompt:"test"});
    const caller=mediaRouter.createCaller(makeCtx({mediaGeneration:{findFirst}}));
    await caller.getJobStatus({jobId:"job_shared"});
    expect(muapiKey.requireUserMuapiKey).toHaveBeenCalledWith(expect.anything(),"original_author");
  });
  it("keeps the job processing after a temporary polling failure",async()=>{
    const update=vi.fn();
    const findFirst=vi.fn().mockResolvedValue({id:"job_shared",workspaceId:TEST_USER_ID,userId:"original_author",requestId:"provider_request",status:"PROCESSING",metadata:{},type:"IMAGE",prompt:"test"});
    vi.mocked(fetchMuapiResultOnce).mockRejectedValueOnce(new Error("Temporary network error"));
    await expect(mediaRouter.createCaller(makeCtx({mediaGeneration:{findFirst,update}})).getJobStatus({jobId:"job_shared"})).rejects.toThrow("tijdelijk niet beschikbaar");
    expect(update).not.toHaveBeenCalled();
  });
  it("deleteGeneration removes workspace job", async () => {
    const deleteMock = vi.fn().mockResolvedValue({ id: "job_1" });
    const findFirst = vi.fn().mockResolvedValue({ id: "job_1", workspaceId: TEST_USER_ID });
    const caller = mediaRouter.createCaller(
      makeCtx({
        mediaGeneration: { findFirst, delete: deleteMock },
      }),
    );
    const result = await caller.deleteGeneration({ jobId: "job_1" });
    expect(result.ok).toBe(true);
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "job_1" } });
  });

  it("deleteGeneration rejects missing jobs", async () => {
    const caller = mediaRouter.createCaller(
      makeCtx({
        mediaGeneration: { findFirst: vi.fn().mockResolvedValue(null) },
      }),
    );
    await expect(caller.deleteGeneration({ jobId: "missing" })).rejects.toBeInstanceOf(TRPCError);
  });
});
