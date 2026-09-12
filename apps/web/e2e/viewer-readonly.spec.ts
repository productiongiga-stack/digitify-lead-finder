import { test, expect } from "@playwright/test";
import { authStatePath } from "./auth-state";

const viewerEmail = process.env.PLAYWRIGHT_VIEWER_EMAIL ?? process.env.SEED_VIEWER_EMAIL ?? "";
const viewerPassword =
  process.env.PLAYWRIGHT_VIEWER_PASSWORD ??
  process.env.SEED_VIEWER_PASSWORD ??
  process.env.PLAYWRIGHT_LOGIN_PASSWORD ??
  "";

test.describe("VIEWER read-only RBAC", () => {
  test.use({ storageState: authStatePath("viewer") });
  test.beforeEach(() => {
    test.skip(
      !viewerEmail || !viewerPassword,
      "Set VIEWER email and password through PLAYWRIGHT_* or SEED_* variables.",
    );
  });

  test("VIEWER krijgt geen bulkacties in de UI", async ({ page }) => {
    await page.goto("/leads");
    await expect(page.locator("h1.app-page-title", { hasText: /leads/i })).toBeVisible({ timeout: 15_000 });

    await expect(page.locator("tbody input[type=checkbox]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Verwijderen" })).toHaveCount(0);
  });

  test("VIEWER settings index hides owner-only sections", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Instellingen" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /weergave/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /team & rollen/i })).toHaveCount(0);
  });
});
