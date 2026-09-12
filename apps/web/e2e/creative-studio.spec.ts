import { test, expect } from "@playwright/test";
import { authStatePath } from "./auth-state";

const password = process.env.PLAYWRIGHT_LOGIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? "";

test.describe("Creative Studio smoke", () => {
  test.use({ storageState: authStatePath("admin") });
  test.beforeEach(() => {
    test.skip(!password, "Set PLAYWRIGHT_LOGIN_PASSWORD or SEED_ADMIN_PASSWORD for authenticated E2E tests.");
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

  test("generatoren tonen een veilige MuAPI-key status zonder configuratie", async ({ page }) => {
    await page.goto("/creative-studio?tab=images");
    await expect(page.getByText("MuAPI-key vereist")).toBeVisible();
    await expect(page.getByRole("link", { name: "MuAPI-key instellen" })).toBeVisible();
    await page.getByRole("tab", { name: /Lip sync/i }).click();
    await expect(page).toHaveURL(/tab=lipsync/);
    await expect(page.getByText("MuAPI-key vereist")).toBeVisible();
  });

  test("integrations page shows MuAPI key section", async ({ page }) => {
    await page.goto("/settings/integrations?tab=muapi");
    await expect(page.getByRole("heading", { name: /Integraties & API-sleutels/i })).toBeVisible();
    await expect(page.getByText("MuAPI (Creative Studio)")).toBeVisible();
    await expect(page.getByText("Automatisch opslaan in bibliotheek")).toBeVisible();
  });
});
