import { describe, expect, it } from "vitest";
import {
  computeSocialImageValidity,
  fetchSocialImageInfo,
  isMetaPublishableImageUrl,
  isMetaPublishableVideoUrl,
  isWorkspaceUploadImagePath,
  parseImageDimensions,
  probeSocialImage,
} from "../lib/social-image";

describe("social image parsing", () => {
  it("reads PNG dimensions without external image libraries", () => {
    const buffer = Buffer.alloc(32);
    Buffer.from("89504e470d0a1a0a", "hex").copy(buffer, 0);
    buffer.writeUInt32BE(13, 8);
    buffer.write("IHDR", 12, "ascii");
    buffer.writeUInt32BE(1080, 16);
    buffer.writeUInt32BE(1350, 20);

    expect(parseImageDimensions(buffer)).toEqual({ width: 1080, height: 1350 });
  });

  it("reads dimensions from a base64 data URL", async () => {
    const buffer = Buffer.alloc(32);
    Buffer.from("89504e470d0a1a0a", "hex").copy(buffer, 0);
    buffer.writeUInt32BE(13, 8);
    buffer.write("IHDR", 12, "ascii");
    buffer.writeUInt32BE(1080, 16);
    buffer.writeUInt32BE(1080, 20);
    const dataUrl = `data:image/png;base64,${buffer.toString("base64")}`;

    const info = await fetchSocialImageInfo(dataUrl);
    expect(info.width).toBe(1080);
    expect(info.height).toBe(1080);
    expect(computeSocialImageValidity(info).validForInstagram).toBe(true);
    expect(isMetaPublishableImageUrl(dataUrl)).toBe(false);
  });

  it("returns structured probe results for invalid URLs", async () => {
    const result = await probeSocialImage("not-a-url");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it("accepts only https video URLs for reels", () => {
    expect(isMetaPublishableVideoUrl("https://cdn.example.com/reel.mp4")).toBe(true);
    expect(isMetaPublishableVideoUrl("http://cdn.example.com/reel.mp4")).toBe(false);
    expect(isMetaPublishableVideoUrl("not-a-url")).toBe(false);
  });

  it("blocks SSRF targets such as localhost", async () => {
    const result = await probeSocialImage("http://127.0.0.1/image.png");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/niet toegestaan/i);
    }
  });

  it("recognizes workspace upload paths and rejects traversal", () => {
    expect(isWorkspaceUploadImagePath("/uploads/workspaces/w1/social/image.jpg")).toBe(true);
    expect(isWorkspaceUploadImagePath("/uploads/../etc/passwd")).toBe(false);
    expect(isMetaPublishableImageUrl("/uploads/workspaces/w1/social/image.jpg")).toBe(false);
  });
});
