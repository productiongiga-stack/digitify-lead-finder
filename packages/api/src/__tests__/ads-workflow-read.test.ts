import { describe, expect, it, vi } from "vitest";
import { retryAdRead } from "../lib/ads-workflow-read";

describe("veilige provider read-retries", () => {
  it("herhaalt tijdelijke fouten met begrensde backoff", async () => {
    const read = vi.fn().mockRejectedValueOnce({ status: 429 }).mockRejectedValueOnce({ code: 14 }).mockResolvedValue("ok");
    const wait = vi.fn().mockResolvedValue(undefined);
    expect(await retryAdRead(read, wait)).toBe("ok");
    expect(wait.mock.calls).toEqual([[500], [1500]]);
  });
  it("herhaalt ontbrekende rechten of credentials niet", async () => {
    const read = vi.fn().mockRejectedValue({ status: 403 });
    await expect(retryAdRead(read, vi.fn())).rejects.toEqual({ status: 403 });
    expect(read).toHaveBeenCalledOnce();
  });
  it("stopt na maximaal drie reads", async () => {
    const read = vi.fn().mockRejectedValue({ status: 503 });
    await expect(retryAdRead(read, vi.fn().mockResolvedValue(undefined))).rejects.toEqual({ status: 503 });
    expect(read).toHaveBeenCalledTimes(3);
  });
});
