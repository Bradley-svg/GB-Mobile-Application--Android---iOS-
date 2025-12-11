import { expect, test } from "@playwright/test";

const demoEmail = process.env.WEB_E2E_EMAIL || "demo@greenbro.com";
const demoPassword = process.env.WEB_E2E_PASSWORD || "password";

test("embedded dashboard: login inside iframe view and hide chrome", async ({ page }) => {
  await page.goto("/embed");

  await page.waitForURL("**/login**", { timeout: 15_000 });
  await expect(page.getByLabel("Email")).toBeInViewport();
  await expect(page.getByLabel("Password")).toBeVisible();
  expect(page.url()).toContain("embed=true");

  await page.getByLabel("Email").fill(demoEmail);
  await page.getByLabel("Password").fill(demoPassword);
  await page.getByRole("button", { name: /login/i }).click();

  await page.waitForURL("**/app**", { timeout: 30_000 });
  expect(page.url()).toContain("embed=true");

  await expect(page.getByRole("link", { name: /open in full window/i })).toBeVisible();
  await expect(page.locator(".gb-shell__sidebar")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Fleet overview/i })).toBeVisible({ timeout: 30_000 });
});
