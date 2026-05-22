import { test, expect } from "@playwright/test";

const ownerBEmail = process.env.PLAYWRIGHT_OWNER_B_EMAIL ?? "owner-b@digitify.local";
const ownerBPassword =
  process.env.PLAYWRIGHT_OWNER_B_PASSWORD ??
  process.env.PLAYWRIGHT_LOGIN_PASSWORD ??
  "DigitifyDev2026!";

const adminMarkerLead = "Bakkerij Van Damme";
const ownerBMarkerLead = "RLS Workspace B —";

test.describe("RLS cross-tenant (browser)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(ownerBEmail);
    await page.getByLabel("Wachtwoord").fill(ownerBPassword);
    await page.getByRole("button", { name: "Inloggen" }).click();
    await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 30_000 });
  });

  test("OWNER B lead list does not show OWNER A companies", async ({ page }) => {
    await page.goto("/leads");
    await expect(page.getByText(adminMarkerLead)).toHaveCount(0);
    await expect(page.getByText(ownerBMarkerLead).first()).toBeVisible({ timeout: 15_000 });
  });
});
