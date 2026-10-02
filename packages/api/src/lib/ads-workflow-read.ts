import { setTimeout as delay } from "node:timers/promises";

// Only safe reads are retried; mutations can have committed before a timeout.
export async function retryAdRead<T>(read: () => Promise<T>, wait: (ms: number) => Promise<unknown> = delay): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await read(); }
    catch (error) {
      const e = error as { status?: number; code?: string | number; message?: string };
      const transient = e.status === 429 || (Number(e.status) >= 500 && Number(e.status) <= 599) ||
        [4, 8, 14, "ETIMEDOUT", "ECONNRESET"].includes(e.code as any) ||
        /RESOURCE_EXHAUSTED|UNAVAILABLE|temporar(?:y|ily)|network|fetch failed|timed?\s*out/i.test(e.message || "");
      if (!transient || attempt >= 2) throw error;
      await wait(attempt === 0 ? 500 : 1500);
    }
  }
}
