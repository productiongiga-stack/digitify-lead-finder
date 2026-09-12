import { test, expect } from "@playwright/test";
import { authStatePath } from "./auth-state";

const password =
  process.env.PLAYWRIGHT_LOGIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? "";

test.describe("Module access guard", () => {
  test.use({ storageState: authStatePath("module-restricted") });
  test.beforeEach(() => {
    test.skip(!password, "Set PLAYWRIGHT_LOGIN_PASSWORD or SEED_ADMIN_PASSWORD for authenticated E2E tests.");
  });

  test("disabled module shows blocked state", async ({ page }) => {
    await page.goto("/social");
    await expect(page.getByText(/module niet beschikbaar/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: /naar dashboard/i })).toBeVisible();
  });
});
