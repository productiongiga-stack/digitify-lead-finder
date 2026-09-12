import { expect, test } from "@playwright/test";

for (const viewport of [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
]) {
  test(`review embed zonder tenant blijft bruikbaar op ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/embed/reviews?company=Testbedrijf");

    await expect(page.getByText("Deze reviewwidget is niet gekoppeld aan een werkruimte.")).toBeVisible();
    await expect(page.getByRole("button", { name: "1 sterren" })).toBeDisabled();
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", viewport.width);
  });
}

test("onbekend publiek formulier geeft een veilige 404", async ({ request }) => {
  const response = await request.get("/api/public/forms/unknown-public-key");
  expect(response.status()).toBe(404);
  await expect(response.json()).resolves.toEqual({ error: "Formulier niet gevonden." });
});
