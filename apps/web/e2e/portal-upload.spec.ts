import { test, expect } from "@playwright/test";

test.describe("Client portal upload API", () => {
  test("rejects portal upload without valid token", async ({ request }) => {
    const response = await request.post("/api/public/portal/test-quote-id", {
      multipart: {
        token: "invalid-token",
        file: {
          name: "proof.png",
          mimeType: "image/png",
          buffer: Buffer.from("fake-png"),
        },
      },
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });
});
