import { test, expect } from "@playwright/test";
import { authStatePath } from "./auth-state";
const password =
  process.env.PLAYWRIGHT_LOGIN_PASSWORD ??
  process.env.SEED_ADMIN_PASSWORD ??
  "";
test.describe("Creative Studio wizards", () => {
  test.use({ storageState: authStatePath("admin") });
  test.beforeEach(() =>
    test.skip(
      !password,
      "Set PLAYWRIGHT_LOGIN_PASSWORD for authenticated E2E tests.",
    ),
  );
  test("starts from goals and provides library, brand and credit navigation", async ({
    page,
  }) => {
    await page.goto("/creative-studio");
    await expect(
      page.getByRole("heading", { name: "Creative Studio", level: 1 }),
    ).toBeVisible();
    for (const name of [
      "Social post",
      "Advertentiemateriaal",
      "Afbeelding maken of bewerken",
      "Video maken",
      "Sprekende video",
    ])
      await expect(
        page.getByRole("button", { name: new RegExp(`^${name}`) }),
      ).toBeVisible();
    for (const name of ["Bibliotheek", "Merkkits", "Credits"])
      await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  });
  test("preserves brand and history deep links", async ({ page }) => {
    await page.goto("/creative-studio?tab=brand");
    await expect(
      page.getByText("Merkkit voor AI", { exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Bibliotheek", exact: true }).click();
    await expect(page).toHaveURL(/tab=history/);
  });
  test("saves video input and the active step across refresh", async ({
    page,
  }) => {
    await page.goto("/creative-studio?tab=video");
    await page.getByRole("button", { name: "Volgende", exact: true }).click();
    const idea = "Een korte video van een bakker met verse croissants.";
    await page.getByLabel("Beschrijf je idee", { exact: true }).fill(idea);
    await expect(page.getByText("Geavanceerd", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Volgende", exact: true }).click();
    await expect(page).toHaveURL(/draft=/);
    await expect(
      page.getByText("Concept opgeslagen", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Genereer video", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "2. Inhoud", exact: true }).click();
    await expect(
      page.getByLabel("Beschrijf je idee", { exact: true }),
    ).toHaveValue(idea);
  });
  test("mobile goals fit the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/creative-studio");
    await expect(
      page.getByRole("button", { name: /^Social post/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
  test("central generation does not ask customers for a personal key", async ({
    page,
  }) => {
    await page.goto("/settings/integrations?tab=muapi");
    await expect(
      page.getByText("AI via Digitify", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Mijn credits", exact: true }),
    ).toBeVisible();
  });
});
