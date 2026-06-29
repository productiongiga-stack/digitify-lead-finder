import { test, expect } from "@playwright/test";

const email = process.env.PLAYWRIGHT_LOGIN_EMAIL ?? "admin@digitify.local";
const password = process.env.PLAYWRIGHT_LOGIN_PASSWORD ?? "DigitifyDev2026!";

test.describe("authenticated smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Wachtwoord").fill(password);
    await page.getByRole("button", { name: "Inloggen" }).click();
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
  });

  test("templates studio loads", async ({ page }) => {
    await page.goto("/templates");
    await expect(page.getByRole("heading", { name: "Standaard e-mailberichten" })).toBeVisible();
    await expect(page.getByText("Opmaak vs. inhoud")).toBeVisible();
  });

  test("template studio campaign filter scopes saved templates", async ({ page }) => {
    await page.goto("/templates");
    await expect(page.getByText(/berichten/).first()).toBeVisible();
    await page.getByRole("button", { name: /Handmatige teksten/i }).click();
    await expect(page.getByRole("link", { name: /Nieuw bericht opstellen/i })).toBeVisible();
  });

  test("compose saves email draft when lead is selected", async ({ page }) => {
    await page.goto("/contacts/compose");
    await expect(page.getByRole("heading", { name: "Nieuwe E-mail" })).toBeVisible();

    const leadTrigger = page.getByRole("combobox").first();
    await leadTrigger.click();
    const firstLead = page.getByRole("option").nth(1);
    await firstLead.click();

    await page.getByLabel(/onderwerp/i).fill("E2E test onderwerp");
    await page.locator("textarea").first().fill("E2E test body voor concept.");
    await page.getByRole("button", { name: /Opslaan als concept/i }).click();
    await expect(page.getByText(/Draft opgeslagen/i)).toBeVisible({ timeout: 15_000 });
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
