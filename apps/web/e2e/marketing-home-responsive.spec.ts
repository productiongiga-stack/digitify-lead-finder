import { expect, test } from "@playwright/test";

for (const viewport of [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 1024 },
]) {
  test(`marketing hero blijft leesbaar op ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const heading = page.getByRole("heading", { name: /Van lead naar klant/ });
    const preview = page.locator(".animate-slide-right").first();
    const firstModuleIcon = preview.getByRole("button").first().locator("svg");

    await expect(heading).toBeVisible();
    await expect(preview).toBeVisible();
    const scrollWidth = await page.locator("body").evaluate((element) => element.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewport.width);

    const [headingBox, previewBox, iconBox] = await Promise.all([
      heading.boundingBox(),
      preview.boundingBox(),
      firstModuleIcon.boundingBox(),
    ]);

    expect(headingBox).not.toBeNull();
    expect(previewBox).not.toBeNull();
    expect(iconBox).not.toBeNull();

    if (viewport.width < 1024) {
      expect(previewBox!.y).toBeGreaterThan(headingBox!.y + headingBox!.height);
      expect(iconBox!.width).toBeLessThanOrEqual(16);
    } else {
      expect(iconBox!.width).toBeGreaterThanOrEqual(20);
    }
  });
}
