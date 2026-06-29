import { expect, type Page } from "@playwright/test";

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Wachtwoord").fill(password);

  await Promise.all([
    page
      .waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().includes("/api/auth/callback/credentials"),
        { timeout: 30_000 },
      )
      .catch(() => null),
    page.getByRole("button", { name: "Inloggen" }).click(),
  ]);

  await page.goto("/dashboard");
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
}
