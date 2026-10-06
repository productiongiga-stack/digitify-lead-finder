import { test, expect } from "@playwright/test";
import { authStatePath } from "./auth-state";

const password =
  process.env.PLAYWRIGHT_LOGIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? "";

test.describe("Leads list smoke", () => {
  test.use({ storageState: authStatePath("admin") });
  test.beforeEach(() => {
    test.skip(!password, "Set PLAYWRIGHT_LOGIN_PASSWORD or SEED_ADMIN_PASSWORD for authenticated E2E tests.");
  });

  test("leads list renders table shell", async ({ page }) => {
    await page.goto("/leads");
    await expect(page.locator("h1.app-page-title", { hasText: /leads/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("table, [role=table]").first()).toBeVisible({ timeout: 20_000 });
  });

  test("leads list opens detail page", async ({ page }) => {
    await page.goto("/leads");
    const detailRow = page.locator('table tbody tr[tabindex="0"]').first();
    await expect(detailRow).toBeVisible({ timeout: 20_000 });
    await detailRow.press("Enter");
    // The App Router uses a client-side transition here, so wait for the URL
    // commit instead of a full document load.
    await page.waitForURL(/\/leads\/[^/]+$/, { timeout: 20_000, waitUntil: "commit" });
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 20_000 });
  });
});
