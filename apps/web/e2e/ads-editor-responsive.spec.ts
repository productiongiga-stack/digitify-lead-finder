import { test, expect } from "@playwright/test";
import { authStatePath } from "./auth-state";

const password = process.env.PLAYWRIGHT_LOGIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? "";

test.describe("Ads Editor productiekwaliteit", () => {
  test.use({ storageState: authStatePath("admin") });
  test.beforeEach(() => {
    test.skip(!password, "Set PLAYWRIGHT_LOGIN_PASSWORD or SEED_ADMIN_PASSWORD for authenticated E2E tests.");
  });

  for (const viewport of [
    { name: "mobile", width: 375, height: 812 },
    { name: "desktop", width: 1440, height: 1024 },
  ]) {
    test(`Meta en Google blijven bruikbaar op ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      for (const route of ["/meta-ads", "/google-ads"]) {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 20_000 });
        await expect(page.locator("body")).not.toContainText("Application error");
        await expect(page.getByText("Nieuwe campagne", { exact: true })).toBeVisible({ timeout: 20_000 });
        await expect(page.getByText("Bestaande campagne", { exact: true })).toBeVisible();
        const dimensions = await page.evaluate(() => ({
          bodyScrollWidth: document.body.scrollWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        }));
        expect(dimensions.bodyScrollWidth, `${route} body overflow`).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
        expect(dimensions.documentScrollWidth, `${route} document overflow`).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
      }
    });
  }
});
