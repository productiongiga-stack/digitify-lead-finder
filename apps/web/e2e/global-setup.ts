import fs from "node:fs/promises";
import { chromium, expect, type FullConfig } from "@playwright/test";
import { authStateDir, authStatePath } from "./auth-state";

const emptyState = JSON.stringify({ cookies: [], origins: [] });

async function login(baseURL: string, name: string, email: string | undefined, password: string | undefined) {
  const target = authStatePath(name);
  if (!email || !password) {
    await fs.writeFile(target, emptyState, "utf8");
    return;
  }

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    // Wait for the client login handler to hydrate before clicking. Without
    // this, a cold Next.js page can submit the native form to /login? instead
    // of calling NextAuth's credentials flow.
    await page.waitForLoadState("networkidle");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Wachtwoord").fill(password);
    await page.getByRole("button", { name: "Inloggen" }).click();
    await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 30_000 });
    await context.storageState({ path: target });
    await context.close();
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(config: FullConfig) {
  await fs.mkdir(authStateDir, { recursive: true });
  const baseURL = String(config.projects[0]?.use.baseURL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000");
  const adminPassword = process.env.PLAYWRIGHT_LOGIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;
  const viewerPassword = process.env.PLAYWRIGHT_VIEWER_PASSWORD ?? process.env.SEED_VIEWER_PASSWORD ?? adminPassword;
  const teamPassword = process.env.PLAYWRIGHT_TEAM_PASSWORD ?? process.env.SEED_TEAM_PASSWORD ?? adminPassword;

  await login(baseURL, "admin", process.env.PLAYWRIGHT_LOGIN_EMAIL ?? process.env.SEED_ADMIN_EMAIL ?? "admin@digitify.local", adminPassword);
  await login(baseURL, "viewer", process.env.PLAYWRIGHT_VIEWER_EMAIL ?? process.env.SEED_VIEWER_EMAIL ?? "viewer@digitify.local", viewerPassword);
  await login(baseURL, "module-restricted", process.env.PLAYWRIGHT_MODULE_RESTRICTED_EMAIL ?? process.env.SEED_MODULE_RESTRICTED_EMAIL ?? "module-restricted@digitify.local", teamPassword);
  await login(baseURL, "moderator", process.env.PLAYWRIGHT_MODERATOR_EMAIL ?? process.env.SEED_MODERATOR_EMAIL ?? "moderator@digitify.local", teamPassword);
  await login(baseURL, "member", process.env.PLAYWRIGHT_MEMBER_EMAIL ?? process.env.SEED_MEMBER_EMAIL ?? "member@digitify.local", teamPassword);
}
