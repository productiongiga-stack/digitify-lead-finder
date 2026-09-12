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
    await expect(page.locator("table tbody tr, [role=row]").first()).toBeVisible({ timeout: 20_000 });
    const detailRow = page.locator("table tbody tr").filter({ has: page.locator("td") }).first();
    await expect(detailRow).toBeVisible({ timeout: 20_000 });
    await detailRow.press("Enter");
    await page.waitForURL(/\/leads\/[^/]+$/, { timeout: 20_000 });
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 20_000 });
  });
});
