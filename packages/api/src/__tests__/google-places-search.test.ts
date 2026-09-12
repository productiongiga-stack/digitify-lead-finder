import { afterEach, describe, expect, it, vi } from "vitest";
import { searchGooglePlaces } from "../lib/google-places-search";

afterEach(() => vi.unstubAllGlobals());
describe("Google Places search budgets", () => {
  it("uses one query when enough results are returned and preserves provider ranking", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ places: [{ id: "b" }, { id: "a" }] }));
    vi.stubGlobal("fetch", fetcher);
    expect(await searchGooglePlaces("bakker Gent", "test-key", 2)).toEqual([{ id: "b" }, { id: "a" }]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ signal: expect.any(AbortSignal) });
  });
  it("follows page tokens, deduplicates and keeps the original query", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ places: [{ id: "b" }, { id: "a" }], nextPageToken: "next" }))
      .mockResolvedValueOnce(Response.json({ places: [{ id: "a" }, { id: "c" }] }));
    vi.stubGlobal("fetch", fetcher);
    expect(await searchGooglePlaces("bakker Gent", "test-key", 4)).toEqual([{ id: "b" }, { id: "a" }, { id: "c" }]);
    expect(JSON.parse(fetcher.mock.calls[1]![1].body)).toEqual({ textQuery: "bakker Gent", pageSize: 2, pageToken: "next" });
  });
  it("stops when the provider repeats a page token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => Response.json({ places: [], nextPageToken: "repeat" })));
    await searchGooglePlaces("bakker Gent", "test-key", 80);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("returns a Dutch timeout without leaking credentials", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("secret-key")));
    await expect(searchGooglePlaces("bakker Gent", "secret-key", 20)).rejects.toMatchObject({ code: "TIMEOUT", message: "De zoekdienst reageert niet. Probeer het opnieuw." });
  });
});
