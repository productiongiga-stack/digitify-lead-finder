import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

const email = process.env.PLAYWRIGHT_LOGIN_EMAIL ?? process.env.SEED_ADMIN_EMAIL ?? "admin@digitify.local";
const password =
  process.env.PLAYWRIGHT_LOGIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? "DigitifyLocal1!";

test.describe("Leads list smoke", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, email, password);
  });

  test("leads list renders table shell", async ({ page }) => {
    await page.goto("/leads");
    await expect(page.getByRole("heading", { name: /leads/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("table, [role=table]").first()).toBeVisible({ timeout: 20_000 });
  });

  test("leads list opens detail page", async ({ page }) => {
    await page.goto("/leads");
    await expect(page.locator("table tbody tr, [role=row]").first()).toBeVisible({ timeout: 20_000 });
    const openButton = page.locator('button[title="Lead openen"]').first();
    await expect(openButton).toBeVisible({ timeout: 20_000 });
    await openButton.click();
    await page.waitForURL(/\/leads\/[^/]+$/, { timeout: 20_000 });
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 20_000 });
  });
});
