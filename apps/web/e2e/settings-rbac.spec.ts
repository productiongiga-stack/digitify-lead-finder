import { test, expect } from "@playwright/test";

const viewerEmail = process.env.PLAYWRIGHT_VIEWER_EMAIL ?? process.env.SEED_VIEWER_EMAIL ?? "viewer@digitify.local";
const viewerPassword =
  process.env.PLAYWRIGHT_VIEWER_PASSWORD ??
  process.env.SEED_VIEWER_PASSWORD ??
  process.env.PLAYWRIGHT_LOGIN_PASSWORD ??
  "DigitifyDev2026!";

test.describe("Settings RBAC matrix", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(viewerEmail);
    await page.getByLabel("Wachtwoord").fill(viewerPassword);
    await page.getByRole("button", { name: "Inloggen" }).click();
    await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 30_000 });
  });

  test("VIEWER sees only allowed settings sections", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Instellingen" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /weergave/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /team & rollen/i })).toHaveCount(0);
  });

  test("VIEWER cannot open team settings", async ({ page }) => {
    await page.goto("/settings/team");
    await expect(page.getByText(/geen toegang|niet gevonden|dashboard/i)).toBeVisible({ timeout: 15_000 });
  });
});

const moderatorEmail = process.env.PLAYWRIGHT_MODERATOR_EMAIL ?? process.env.SEED_MODERATOR_EMAIL ?? "moderator@digitify.local";
const memberEmail = process.env.PLAYWRIGHT_MEMBER_EMAIL ?? process.env.SEED_MEMBER_EMAIL ?? "member@digitify.local";

test.describe("Settings RBAC — MODERATOR", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(moderatorEmail);
    await page.getByLabel("Wachtwoord").fill(viewerPassword);
    await page.getByRole("button", { name: "Inloggen" }).click();
    await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 30_000 });
  });

  test("MODERATOR cannot open branding settings", async ({ page }) => {
    await page.goto("/settings/branding");
    await expect(page.getByText(/geen toegang|niet gevonden|dashboard/i)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Settings RBAC — MEMBER", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(memberEmail);
    await page.getByLabel("Wachtwoord").fill(viewerPassword);
    await page.getByRole("button", { name: "Inloggen" }).click();
    await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 30_000 });
  });

  test("MEMBER cannot open team settings", async ({ page }) => {
    await page.goto("/settings/team");
    await expect(page.getByText(/geen toegang|niet gevonden|dashboard/i)).toBeVisible({ timeout: 15_000 });
  });
});
