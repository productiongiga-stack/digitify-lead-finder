import { expect, type Page } from "@playwright/test";

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Wachtwoord").fill(password);

  const [authResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/auth/callback/credentials"),
      { timeout: 30_000 },
    ),
    page.getByRole("button", { name: "Inloggen" }).click(),
  ]);
  expect(authResponse.ok()).toBe(true);

  await expect
    .poll(
      async () => {
        const cookies = await page.context().cookies("http://localhost:3000");
        return cookies.some((cookie) => cookie.name.includes("next-auth.session-token"));
      },
      { timeout: 30_000 },
    )
    .toBe(true);

  await page.goto("/dashboard");
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
}
