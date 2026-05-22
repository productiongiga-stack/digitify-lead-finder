export async function probeRedis(url: string): Promise<"ok" | "error"> {
  try {
    const { createClient } = await import("redis");
    const client = createClient({ url });
    client.on("error", () => {});
    await client.connect();
    const pong = await client.ping();
    await client.quit();
    return pong === "PONG" ? "ok" : "error";
  } catch {
    return "error";
  }
}
