import { test, expect } from "@playwright/test";

const restrictedEmail =
  process.env.PLAYWRIGHT_MODULE_RESTRICTED_EMAIL ??
  process.env.SEED_MODULE_RESTRICTED_EMAIL ??
  "module-restricted@digitify.local";
const password =
  process.env.PLAYWRIGHT_LOGIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? "DigitifyLocal1!";

test.describe("Module access guard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(restrictedEmail);
    await page.getByLabel("Wachtwoord").fill(password);
    await page.getByRole("button", { name: "Inloggen" }).click();
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
  });

  test("disabled module shows blocked state", async ({ page }) => {
    await page.goto("/social");
    await expect(page.getByText(/module niet beschikbaar/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: /naar dashboard/i })).toBeVisible();
  });
});
