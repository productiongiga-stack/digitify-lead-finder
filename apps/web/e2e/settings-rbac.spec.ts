import { test, expect } from "@playwright/test";
import { authStatePath } from "./auth-state";

const viewerPassword =
  process.env.PLAYWRIGHT_VIEWER_PASSWORD ??
  process.env.SEED_VIEWER_PASSWORD ??
  process.env.PLAYWRIGHT_LOGIN_PASSWORD ??
  "";

test.describe("Settings RBAC matrix", () => {
  test.use({ storageState: authStatePath("viewer") });
  test.beforeEach(() => {
    test.skip(!viewerPassword, "Set a PLAYWRIGHT_* or SEED_* password for authenticated E2E tests.");
  });

  test("VIEWER sees only allowed settings sections", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Instellingen" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /weergave/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /branding/i })).toHaveCount(0);
  });

  test("VIEWER cannot open team settings", async ({ page }) => {
    await page.goto("/settings/team");
    await expect(page.getByText(/geen toegang|niet gevonden|dashboard/i)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Settings RBAC — MODERATOR", () => {
  test.use({ storageState: authStatePath("moderator") });
  test.beforeEach(() => {
    test.skip(!viewerPassword, "Set a PLAYWRIGHT_* or SEED_* password for authenticated E2E tests.");
  });

  test("MODERATOR cannot open branding settings", async ({ page }) => {
    await page.goto("/settings/branding");
    await expect(page.getByText(/geen toegang|niet gevonden|dashboard/i)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Settings RBAC — MEMBER", () => {
  test.use({ storageState: authStatePath("member") });
  test.beforeEach(() => {
    test.skip(!viewerPassword, "Set a PLAYWRIGHT_* or SEED_* password for authenticated E2E tests.");
  });

  test("MEMBER cannot open team settings", async ({ page }) => {
    await page.goto("/settings/team");
    await expect(page.getByText(/geen toegang|niet gevonden|dashboard/i)).toBeVisible({ timeout: 15_000 });
  });
});
