import { test, expect } from "@playwright/test";

const adminEmail = process.env.PLAYWRIGHT_LOGIN_EMAIL ?? "admin@digitify.local";
const adminPassword =
  process.env.PLAYWRIGHT_LOGIN_PASSWORD ??
  "DigitifyDev2026!";

const ownerBEmail = process.env.PLAYWRIGHT_OWNER_B_EMAIL ?? "owner-b@digitify.local";
const ownerBPassword =
  process.env.PLAYWRIGHT_OWNER_B_PASSWORD ??
  process.env.PLAYWRIGHT_LOGIN_PASSWORD ??
  "DigitifyDev2026!";

const adminMarkerLead = "Bakkerij Van Damme";
const ownerBMarkerLead = "RLS Workspace B —";

test.describe("RLS cross-tenant (browser)", () => {
  test("OWNER B lead list does not show OWNER A companies", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(ownerBEmail);
    await page.getByLabel("Wachtwoord").fill(ownerBPassword);
    await page.getByRole("button", { name: "Inloggen" }).click();
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });

    await page.goto("/leads");
    await expect(page.getByText(adminMarkerLead)).toHaveCount(0);
    await expect(page.getByText(ownerBMarkerLead).first()).toHaveCount(1, { timeout: 15_000 });
  });

  test("OWNER B cannot open OWNER A lead detail by URL", async ({ page, context }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(adminEmail);
    await page.getByLabel("Wachtwoord").fill(adminPassword);
    await page.getByRole("button", { name: "Inloggen" }).click();
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });

    await page.goto("/leads");
    const leadLink = page.locator('a[href^="/leads/"]').first();
    await expect(leadLink).toBeVisible({ timeout: 15_000 });
    const href = await leadLink.getAttribute("href");
    expect(href).toMatch(/^\/leads\//);

    await context.clearCookies();

    await page.goto("/login");
    await page.getByLabel("E-mail").fill(ownerBEmail);
    await page.getByLabel("Wachtwoord").fill(ownerBPassword);
    await page.getByRole("button", { name: "Inloggen" }).click();
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });

    await page.goto(href!);
    await expect(page.getByText(adminMarkerLead)).toHaveCount(0, { timeout: 15_000 });
  });
});
