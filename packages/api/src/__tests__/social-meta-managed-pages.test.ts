import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadMetaManagedPages, resolvePageInstagramLink } from "../lib/social-meta";

function mockGraphJson(body: unknown) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => body,
  } as Response);
}

describe("loadMetaManagedPages", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("paginates through all managed pages", async () => {
    mockGraphJson({
      data: [
        {
          id: "page_1",
          name: "Page One",
          access_token: "token_1",
          instagram_business_account: { id: "ig_1", username: "one" },
        },
      ],
      paging: { cursors: { after: "cursor_1" }, next: "https://graph.facebook.com/next" },
    });
    mockGraphJson({
      data: [
        {
          id: "page_2",
          name: "Page Two",
          access_token: "token_2",
        },
      ],
    });
    mockGraphJson({
      instagram_business_account: { id: "ig_2", username: "two" },
    });

    const pages = await loadMetaManagedPages("user_token");

    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({ id: "page_1", instagramBusinessId: "ig_1" });
    expect(pages[1]).toMatchObject({ id: "page_2", instagramBusinessId: "ig_2", instagramUsername: "two" });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("enriches missing instagram links per page with the page access token", async () => {
    mockGraphJson({
      data: [
        {
          id: "page_1",
          name: "Digitify.be",
          access_token: "token_1",
        },
        {
          id: "page_2",
          name: "Other Page",
          access_token: "token_2",
          instagram_business_account: { id: "ig_2", username: "other" },
        },
      ],
    });
    mockGraphJson({
      instagram_business_account: { id: "ig_1", username: "digitify.be" },
    });

    const pages = await loadMetaManagedPages("user_token");

    expect(pages).toEqual([
      expect.objectContaining({
        id: "page_1",
        instagramBusinessId: "ig_1",
        instagramUsername: "digitify.be",
      }),
      expect.objectContaining({
        id: "page_2",
        instagramBusinessId: "ig_2",
        instagramUsername: "other",
      }),
    ]);
  });
});

describe("resolvePageInstagramLink", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips graph lookup when instagram is already present", async () => {
    const page = {
      id: "page_1",
      name: "Digitify",
      accessToken: "token_1",
      instagramBusinessId: "ig_1",
      instagramUsername: "digitify.be",
    };

    await expect(resolvePageInstagramLink(page)).resolves.toEqual(page);
    expect(fetch).not.toHaveBeenCalled();
  });
});
