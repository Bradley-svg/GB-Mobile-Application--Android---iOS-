import { expect, test } from "@playwright/test";

const idleWaitMs = Number(process.env.WEB_E2E_IDLE_WAIT_MS || "0");
const demoEmail = process.env.WEB_E2E_EMAIL || process.env.DEMO_EMAIL || "demo@greenbro.com";
const demoPassword =
  process.env.WEB_E2E_PASSWORD || process.env.DEMO_PASSWORD || "GreenbroDemo#2025!";

test.describe("session timeout", () => {
  test.skip(
    !process.env.WEB_E2E_IDLE_TEST && idleWaitMs <= 0,
    "Set WEB_E2E_IDLE_TEST=true and WEB_E2E_IDLE_WAIT_MS to run idle timeout check",
  );

  test("expires the session after idle timeout", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill(demoEmail);
    await page.getByLabel("Password").fill(demoPassword);
    await page.getByRole("button", { name: /login/i }).click();
    await page.waitForURL("**/app**", { timeout: 30_000 });

    await page.waitForTimeout(idleWaitMs > 0 ? idleWaitMs : 5000);

    await expect(page).toHaveURL(/login/, { timeout: 15_000 });
    await expect(page.getByText(/session expired/i)).toBeVisible({ timeout: 5_000 });
  });
});
