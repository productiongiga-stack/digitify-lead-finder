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

  it("applies JPEG EXIF orientation when reading dimensions", () => {
    const exifPayload = Buffer.alloc(6 + 8 + 2 + 12 + 4);
    exifPayload.write("Exif\0\0", 0, "ascii");
    exifPayload.write("II", 6, "ascii");
    exifPayload.writeUInt16LE(42, 8);
    exifPayload.writeUInt32LE(8, 10);
    exifPayload.writeUInt16LE(1, 14);
    exifPayload.writeUInt16LE(0x0112, 16);
    exifPayload.writeUInt16LE(3, 18);
    exifPayload.writeUInt32LE(1, 20);
    exifPayload.writeUInt16LE(6, 24);

    const app1 = Buffer.alloc(4 + exifPayload.length);
    app1[0] = 0xff;
    app1[1] = 0xe1;
    app1.writeUInt16BE(exifPayload.length + 2, 2);
    exifPayload.copy(app1, 4);

    const sof0 = Buffer.alloc(19);
    sof0[0] = 0xff;
    sof0[1] = 0xc0;
    sof0.writeUInt16BE(17, 2);
    sof0[4] = 8;
    sof0.writeUInt16BE(1080, 5);
    sof0.writeUInt16BE(1920, 7);

    const buffer = Buffer.concat([Buffer.from([0xff, 0xd8]), app1, sof0, Buffer.from([0xff, 0xd9])]);

    expect(parseImageDimensions(buffer)).toEqual({ width: 1080, height: 1920 });
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
