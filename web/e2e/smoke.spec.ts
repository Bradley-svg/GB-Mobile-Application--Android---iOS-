import { expect, test } from "@playwright/test";

const demoEmail = process.env.WEB_E2E_EMAIL || "demo@greenbro.com";
const demoPassword = process.env.WEB_E2E_PASSWORD || "password";

test("web smoke flow: login, fleet, device history, alerts", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill(demoEmail);
  await page.getByLabel("Password").fill(demoPassword);
  await page.getByRole("button", { name: /login/i }).click();

  await page.waitForURL("**/app**", { timeout: 30_000 });

  const deviceLinks = page.locator('a[href^="/app/devices/"]');
  await expect(deviceLinks.first()).toBeVisible({ timeout: 30_000 });

  await deviceLinks.first().click();
  await page.waitForURL("**/app/devices/**", { timeout: 30_000 });

  await page.getByRole("button", { name: "History" }).click();
  const historyChart = page.locator('div:has(> h2:has-text("History")) svg');
  await expect(historyChart.first()).toBeVisible({ timeout: 20_000 });

  await page.getByRole("link", { name: "View alerts" }).click();
  await page.waitForURL("**/app/alerts**", { timeout: 30_000 });

  const viewButtons = page.getByRole("button", { name: "View" });
  await expect(viewButtons.first()).toBeVisible({ timeout: 20_000 });
  await viewButtons.first().click();

  await page.waitForURL(/\/app\/alerts\/.+/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Quick actions" })).toBeVisible({ timeout: 20_000 });
});
