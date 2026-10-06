import { describe, expect, it, vi, beforeEach } from "vitest";
import sharp from "sharp";
vi.mock("@digitify/media-studio", () => ({ fetchRemoteAsset: vi.fn() }));
vi.mock("../lib/import-media-to-blob", () => ({
  storeGeneratedAssetBytes: vi
    .fn()
    .mockResolvedValue({
      url: "https://test.public.blob.vercel-storage.com/crop.jpg",
      storage: "blob",
    }),
}));
import { fetchRemoteAsset } from "@digitify/media-studio";
import { storeGeneratedAssetBytes } from "../lib/import-media-to-blob";
import { prepareGoogleCreativeAsset } from "../lib/creative-google-asset";
const input = {
  sourceUrl: "https://cdn.muapi.ai/input.png",
  workspaceId: "workspace",
  userId: "user",
  jobId: "job",
};
beforeEach(() => vi.clearAllMocks());
describe("Google Ads media compatibility", () => {
  it("creates an exact landscape or square asset", async () => {
    const bytes = await sharp({
      create: { width: 1024, height: 1024, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    vi.mocked(fetchRemoteAsset).mockResolvedValue({
      bytes,
      contentType: "image/png",
    });
    for (const slot of ["landscape", "square"] as const) {
      await prepareGoogleCreativeAsset({ ...input, slot });
      const saved = vi.mocked(storeGeneratedAssetBytes).mock.calls.at(-1)![0];
      const meta = await sharp(saved.bytes).metadata();
      expect(meta.width).toBe(1200);
      expect(meta.height).toBe(slot === "square" ? 1200 : 628);
    }
  });
  it("rejects small images and local files outside the workspace", async () => {
    const bytes = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    vi.mocked(fetchRemoteAsset).mockResolvedValue({
      bytes,
      contentType: "image/png",
    });
    await expect(
      prepareGoogleCreativeAsset({ ...input, slot: "square" }),
    ).rejects.toThrow("te klein");
    await expect(
      prepareGoogleCreativeAsset({
        ...input,
        sourceUrl: "http://localhost:3001/secret",
        slot: "square",
      }),
    ).rejects.toThrow("niet bij deze workspace");
    expect(storeGeneratedAssetBytes).not.toHaveBeenCalled();
  });
});
