import { test, expect } from "@playwright/test";

const email = process.env.PLAYWRIGHT_LOGIN_EMAIL ?? process.env.SEED_ADMIN_EMAIL ?? "admin@digitify.local";
const password =
  process.env.PLAYWRIGHT_LOGIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? "DigitifyLocal1!";

test.describe("Dashboard smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Wachtwoord").fill(password);
    await page.getByRole("button", { name: "Inloggen" }).click();
    await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 30_000 });
  });

  test("dashboard loads overview widgets", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/vaak gebruikt|snelkoppelingen|actiecentrum/i).first()).toBeVisible();
  });
});
