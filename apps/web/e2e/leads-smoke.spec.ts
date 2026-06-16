import { test, expect } from "@playwright/test";

const email = process.env.PLAYWRIGHT_LOGIN_EMAIL ?? process.env.SEED_ADMIN_EMAIL ?? "admin@digitify.local";
const password =
  process.env.PLAYWRIGHT_LOGIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? "DigitifyLocal1!";

test.describe("Leads list smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Wachtwoord").fill(password);
    await page.getByRole("button", { name: "Inloggen" }).click();
    await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 30_000 });
  });

  test("leads list renders table shell", async ({ page }) => {
    await page.goto("/leads");
    await expect(page.getByRole("heading", { name: /leads/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("table, [role=table]").first()).toBeVisible({ timeout: 20_000 });
  });

  test("leads list opens detail page", async ({ page }) => {
    await page.goto("/leads");
    await expect(page.locator("table tbody tr, [role=row]").first()).toBeVisible({ timeout: 20_000 });
    const detailLink = page.locator('table tbody tr a[href*="/leads/"], [role=row] a[href*="/leads/"]').first();
    await expect(detailLink).toBeVisible({ timeout: 20_000 });
    await detailLink.click();
    await page.waitForURL(/\/leads\/[^/]+$/, { timeout: 20_000 });
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 20_000 });
  });
});
