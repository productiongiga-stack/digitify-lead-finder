import { describe, expect, it, vi, afterEach } from "vitest";
import {
  fetchRemoteAsset,
  isTerminalFailure,
  isTerminalSuccess,
  MuapiError,
  pollMuapiResult,
} from "../muapi-client";

describe("muapi terminal states", () => {
  it("detects success statuses", () => {
    expect(isTerminalSuccess("completed")).toBe(true);
    expect(isTerminalSuccess("succeeded")).toBe(true);
    expect(isTerminalSuccess("pending")).toBe(false);
  });

  it("detects failure statuses", () => {
    expect(isTerminalFailure("failed")).toBe(true);
    expect(isTerminalFailure("error")).toBe(true);
    expect(isTerminalFailure("processing")).toBe(false);
  });
});

describe("pollMuapiResult", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns on terminal success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ status: "completed", output: { url: "https://cdn.muapi.ai/out.png" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const result = await pollMuapiResult("test-key", "req-1", { intervalMs: 0, maxAttempts: 1 });
    expect(result.status).toBe("completed");
    expect(result.url).toBe("https://cdn.muapi.ai/out.png");
  });

  it("throws on terminal failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ status: "failed", error: "GPU busy" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(pollMuapiResult("test-key", "req-2", { intervalMs: 0, maxAttempts: 1 })).rejects.toBeInstanceOf(
      MuapiError,
    );
  });
});

describe("fetchRemoteAsset", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects disallowed hosts", async () => {
    await expect(fetchRemoteAsset("https://evil.example.com/asset.png")).rejects.toBeInstanceOf(MuapiError);
  });

  it("downloads allowed MuAPI assets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(Buffer.from("ok"), {
          status: 200,
          headers: { "content-type": "image/png", "content-length": "2" },
        }),
      ),
    );

    const result = await fetchRemoteAsset("https://cdn.muapi.ai/test.png");
    expect(result.contentType).toBe("image/png");
    expect(result.bytes.toString()).toBe("ok");
  });
});
