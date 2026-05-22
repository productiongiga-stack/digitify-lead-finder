import { test, expect } from "@playwright/test";

test.describe("public probes", () => {
  test("GET /api/health reports database ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toMatchObject({
      status: "ok",
      db: "ok",
    });
    expect(typeof body.latencyMs).toBe("number");
    expect(body.ts).toBeTruthy();
  });
});
