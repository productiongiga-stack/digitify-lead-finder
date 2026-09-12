import { test, expect } from "@playwright/test";
import { authStatePath } from "./auth-state";

const password =
  process.env.PLAYWRIGHT_LOGIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? "";

test.describe("Dashboard smoke", () => {
  test.use({ storageState: authStatePath("admin") });
  test.beforeEach(() => {
    test.skip(!password, "Set PLAYWRIGHT_LOGIN_PASSWORD or SEED_ADMIN_PASSWORD for authenticated E2E tests.");
  });

  test("dashboard loads overview widgets", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Snelle acties", { exact: true })).toBeVisible({ timeout: 30_000 });
  });
});
