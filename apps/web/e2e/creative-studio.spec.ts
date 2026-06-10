import { test, expect } from "@playwright/test";

const email = process.env.PLAYWRIGHT_LOGIN_EMAIL ?? "admin@digitify.local";
const password = process.env.PLAYWRIGHT_LOGIN_PASSWORD ?? "DigitifyDev2026!";

test.describe("Creative Studio smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Wachtwoord").fill(password);
    await page.getByRole("button", { name: "Inloggen" }).click();
    await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 30_000 });
  });

  test("creative studio page loads with tabs", async ({ page }) => {
    await page.goto("/creative-studio");
    await expect(page.getByRole("heading", { name: "Creative Studio" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Afbeeldingen" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Merkkit" })).toBeVisible();
  });

  test("tab deep link syncs URL", async ({ page }) => {
    await page.goto("/creative-studio?tab=brand");
    await expect(page.getByText("Merkkit voor AI")).toBeVisible();
    await page.getByRole("tab", { name: "Historie" }).click();
    await expect(page).toHaveURL(/tab=history/);
  });

  test("lip sync tab and dual-mode image UI render", async ({ page }) => {
    await page.goto("/creative-studio?tab=images");
    await expect(page.getByRole("button", { name: /Tekst → beeld/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Bewerken/i })).toBeVisible();
    await page.getByRole("tab", { name: /Lip sync/i }).click();
    await expect(page).toHaveURL(/tab=lipsync/);
    await expect(page.getByText("Lip Sync Studio")).toBeVisible();
  });

  test("integrations page shows MuAPI key section", async ({ page }) => {
    await page.goto("/settings/integrations?tab=muapi");
    await expect(page.getByRole("heading", { name: /Integraties & API-sleutels/i })).toBeVisible();
    await expect(page.getByText("MuAPI (Creative Studio)")).toBeVisible();
    await expect(page.getByText("Automatisch opslaan in bibliotheek")).toBeVisible();
  });
});
