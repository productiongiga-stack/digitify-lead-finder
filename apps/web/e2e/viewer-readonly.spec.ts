import { test, expect } from "@playwright/test";

const viewerEmail = process.env.PLAYWRIGHT_VIEWER_EMAIL ?? process.env.SEED_VIEWER_EMAIL ?? "";
const viewerPassword =
  process.env.PLAYWRIGHT_VIEWER_PASSWORD ??
  process.env.SEED_VIEWER_PASSWORD ??
  process.env.PLAYWRIGHT_LOGIN_PASSWORD ??
  "DigitifyDev2026!";

test.describe("VIEWER read-only RBAC", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!viewerEmail, "Seed a VIEWER user with SEED_VIEWER_EMAIL / PLAYWRIGHT_VIEWER_EMAIL.");

    await page.goto("/login");
    await page.getByLabel("E-mail").fill(viewerEmail);
    await page.getByLabel("Wachtwoord").fill(viewerPassword);
    await page.getByRole("button", { name: "Inloggen" }).click();
    await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 30_000 });
  });

  test("VIEWER cannot access bulk delete controls", async ({ page }) => {
    await page.goto("/leads");
    await expect(page.getByRole("heading", { name: /leads/i })).toBeVisible({ timeout: 15_000 });

    const rowCheckbox = page.locator("tbody input[type=checkbox]").first();
    await expect(rowCheckbox).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Verwijderen" })).toHaveCount(0);
  });

  test("VIEWER settings index hides owner-only sections", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Instellingen" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /weergave/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /team & rollen/i })).toHaveCount(0);
  });
});
