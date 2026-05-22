import { test, expect } from "@playwright/test";

const email = process.env.PLAYWRIGHT_LOGIN_EMAIL ?? "admin@digitify.local";
const password = process.env.PLAYWRIGHT_LOGIN_PASSWORD ?? "DigitifyDev2026!";

test.describe("authenticated smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Wachtwoord").fill(password);
    await page.getByRole("button", { name: "Inloggen" }).click();
    await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 30_000 });
  });

  test("templates studio loads", async ({ page }) => {
    await page.goto("/templates");
    await expect(page.getByRole("heading", { name: "Template Studio" })).toBeVisible();
    await expect(page.getByText("Intro — Modern outreach")).toBeVisible();
  });

  test("template studio campaign filter scopes saved templates", async ({ page }) => {
    await page.goto("/templates");
    await expect(page.getByText("Intro - Webdesign")).toBeVisible();
    await expect(page.getByText("Intro - SEO")).toBeVisible();
    await expect(page.getByText("Follow-up 1")).toBeVisible();

    await page.getByTestId("template-campaign-filter").click();
    await page.getByRole("option", { name: "Webdesign Gent" }).click();

    await expect(page.getByText("Intro - Webdesign")).toBeVisible();
    await expect(page.getByText("Follow-up 1")).toBeVisible();
    await expect(page.getByText("Alle campagnes").first()).toBeVisible();
    await expect(page.getByText("Intro - SEO")).toHaveCount(0);
  });

  test("outbound compose shows workspace flow copy", async ({ page }) => {
    await page.goto("/contacts/compose");
    await expect(page.getByRole("heading", { name: "Nieuwe E-mail" })).toBeVisible();
    await expect(page.getByText(/Concept opslaan of ter goedkeuring indienen/i)).toBeVisible();
    await expect(page.getByText(/Campagne \(template-filter\)/i)).toBeVisible();
  });

  test("outbound center shows approval flow", async ({ page }) => {
    await page.goto("/contacts");
    await expect(page.getByRole("heading", { name: "Outbound Center" })).toBeVisible();
    await expect(page.getByText(/Concept.*goedkeuren.*verzenden/i)).toBeVisible();
    await page.getByRole("tab", { name: /info/i }).click();
    await expect(page.getByText(/klaar om te verzenden/i)).toBeVisible();
  });
});
