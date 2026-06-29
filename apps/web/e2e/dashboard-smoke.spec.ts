import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

const email = process.env.PLAYWRIGHT_LOGIN_EMAIL ?? process.env.SEED_ADMIN_EMAIL ?? "admin@digitify.local";
const password =
  process.env.PLAYWRIGHT_LOGIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? "DigitifyLocal1!";

test.describe("Dashboard smoke", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, email, password);
  });

  test("dashboard loads overview widgets", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/vaak gebruikt|snelkoppelingen|actiecentrum/i).first()).toBeVisible();
  });
});
