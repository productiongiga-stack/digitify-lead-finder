import { afterEach, describe, expect, it, vi } from "vitest";
import { publishFacebookImageStory } from "../lib/social-meta";

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
