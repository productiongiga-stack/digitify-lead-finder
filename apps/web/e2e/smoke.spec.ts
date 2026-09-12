import { test, expect } from "@playwright/test";
import { authStatePath } from "./auth-state";

const password = process.env.PLAYWRIGHT_LOGIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? "";

test.describe("authenticated smoke", () => {
  test.use({ storageState: authStatePath("admin") });
  test.beforeEach(() => {
    test.skip(!password, "Set PLAYWRIGHT_LOGIN_PASSWORD or SEED_ADMIN_PASSWORD for authenticated E2E tests.");
  });

  test("templates studio loads", async ({ page }) => {
    await page.goto("/templates");
    await expect(page.getByRole("heading", { name: "Standaard e-mailberichten" })).toBeVisible();
    await expect(page.getByText("Opmaak vs. inhoud")).toBeVisible();
  });

  test("template preview and editor load on demand", async ({ page }) => {
    await page.goto("/templates");
    const firstTemplate = page.getByRole("article").first();
    await expect(firstTemplate).toBeVisible();

    await firstTemplate.getByRole("button", { name: "Preview" }).click();
    const previewDialog = page.getByRole("dialog");
    await expect(previewDialog).toBeVisible();
    await expect(previewDialog.getByText("Onderwerp:")).toBeVisible();

    await previewDialog.getByRole("button", { name: "Bewerken" }).click();
    const editorDialog = page.getByRole("dialog");
    await expect(editorDialog.getByLabel("Onderwerp")).toBeVisible();
    await expect(editorDialog.getByRole("button", { name: "Opslaan" })).toBeVisible();
    await editorDialog.getByRole("button", { name: "Annuleren" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("template studio module filter updates the URL", async ({ page }) => {
    await page.goto("/templates");
    await expect(page.getByRole("button", { name: "Alle modules" })).toBeVisible();

    const moduleButton = page.getByRole("button", { name: /Authenticatie & team/i });
    await expect(moduleButton).toBeVisible();
    await moduleButton.click();

    await expect(page).toHaveURL(/\/templates\?module=AUTH$/);
  });

  test("compose saves email draft when lead is selected", async ({ page }) => {
    await page.goto("/contacts/compose");
    await expect(page.getByRole("heading", { name: "Nieuwe E-mail" })).toBeVisible();

    const leadTrigger = page.getByRole("combobox").first();
    await leadTrigger.click();
    const firstLead = page.getByRole("option").first();
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
    await expect(page.locator("h1.app-page-title", { hasText: "Outbound Center" })).toBeVisible();
    await expect(page.getByText(/Concept.*goedkeuren.*verzenden/i)).toBeVisible();
    await page.getByRole("tab", { name: /info/i }).click();
    await expect(page.getByText(/klaar om te verzenden/i)).toBeVisible();
  });
});
