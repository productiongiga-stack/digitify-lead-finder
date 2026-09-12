export async function probeRedis(url: string): Promise<"ok" | "error"> {
  let client: ReturnType<typeof import("redis").createClient> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const { createClient } = await import("redis");
    client = createClient({ url, socket: { connectTimeout: 3_000 } });
    client.on("error", () => {});
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Redis probe timed out")), 3_000);
    });
    const pong = await Promise.race([
      (async () => {
        await client!.connect();
        return client!.ping();
      })(),
      timeout,
    ]);
    return pong === "PONG" ? "ok" : "error";
  } catch {
    return "error";
  } finally {
    if (timer) clearTimeout(timer);
    client?.disconnect();
  }
}
