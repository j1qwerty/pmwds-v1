import type { Page } from "@playwright/test";
import { E2E_BASE_URL, E2E_PASSWORD, type TestUser } from "../config.js";

export async function login(page: Page, user: TestUser): Promise<void> {
  if (!E2E_PASSWORD) {
    throw new Error("E2E_PASSWORD is required for browser tests.");
  }

  await page.goto(`${E2E_BASE_URL}/login`, { waitUntil: "domcontentloaded" });

  const email = page
    .getByLabel(/email/i)
    .or(page.getByPlaceholder(/you@example.com/i))
    .first();
  const password = page
    .getByLabel(/password/i)
    .or(page.getByPlaceholder(/enter your password/i))
    .first();

  await email.fill(user.email);
  await password.fill(E2E_PASSWORD);

  const submit = page
    .locator('button[type="submit"]')
    .or(page.getByRole("button", { name: /sign in|login/i }))
    .first();

  await submit.click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), {
    timeout: 60_000,
  });
  await page.waitForLoadState("networkidle").catch(() => {});
}
