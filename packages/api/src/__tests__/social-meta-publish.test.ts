import { afterEach, describe, expect, it, vi } from "vitest";
import { publishFacebookImageStory, publishFacebookVideoStory } from "../lib/social-meta";

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => body,
  } as Response;
}

describe("publishFacebookImageStory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads an unpublished photo before publishing the story", async () => {
    const bodies: string[] = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(init?.body?.toString() || "");

      if (bodies.length === 1) {
        expect(bodies[0]).toContain("published=false");
        expect(bodies[0]).toContain("url=https%3A%2F%2Fexample.com%2Fstory.jpg");
        return jsonResponse({ id: "photo_123" });
      }

      if (bodies.length === 2) {
        expect(bodies[1]).toContain("photo_id=photo_123");
        expect(bodies[1]).not.toContain("url=");
        return jsonResponse({ post_id: "story_456" });
      }

      return jsonResponse({ id: "story_456", permalink_url: "https://facebook.com/story/456" });
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await publishFacebookImageStory({
      pageId: "page_1",
      pageAccessToken: "page-token",
      imageUrl: "https://example.com/story.jpg",
    });

    expect(result).toEqual({
      id: "story_456",
      permalink: "https://facebook.com/story/456",
      verified: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("publishFacebookVideoStory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the Facebook Story video upload phases before publishing", async () => {
    const graphBodies: string[] = [];
    const uploadBodies: Uint8Array[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();

      if (url === "https://cdn.example.com/story.mp4") {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "video/mp4", "content-length": "4" }),
          arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
        } as Response;
      }

      if (url === "https://upload.facebook.com/story-session") {
        uploadBodies.push(init?.body as Uint8Array);
        expect(init?.headers).toMatchObject({
          Authorization: "OAuth page-token",
          "Content-Type": "video/mp4",
        });
        return jsonResponse({ success: true });
      }

      if (init?.method === "GET") {
        return jsonResponse({ id: "story_video_456", permalink_url: "https://facebook.com/story/video-456" });
      }

      graphBodies.push(init?.body?.toString() || "");
      if (graphBodies.length === 1) {
        expect(url).toContain("/page_1/video_stories");
        expect(graphBodies[0]).toContain("upload_phase=start");
        return jsonResponse({
          video_id: "video_123",
          upload_url: "https://upload.facebook.com/story-session",
        });
      }

      if (graphBodies.length === 2) {
        expect(url).toContain("/page_1/video_stories");
        expect(graphBodies[1]).toContain("upload_phase=finish");
        expect(graphBodies[1]).toContain("video_id=video_123");
        return jsonResponse({ post_id: "story_video_456", success: true });
      }
      return jsonResponse({ error: { message: "Unexpected request" } }, false);
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await publishFacebookVideoStory({
      pageId: "page_1",
      pageAccessToken: "page-token",
      videoUrl: "https://cdn.example.com/story.mp4",
    });

    expect(result).toEqual({
      id: "story_video_456",
      permalink: "https://facebook.com/story/video-456",
      verified: true,
    });
    expect(graphBodies).toHaveLength(2);
    expect(uploadBodies).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
