import { expect, test } from "@playwright/test";

test("unauthenticated /app calls /auth/me and redirects to login", async ({ page }) => {
  const authRequests: string[] = [];

  await page.route("**/auth/me", async (route) => {
    authRequests.push(route.request().url());
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Unauthorized" }),
    });
  });

  await page.goto("/app");
  await page.waitForURL("**/login**");

  expect(authRequests.length).toBeGreaterThan(0);
  expect(new URL(page.url()).pathname).toBe("/login");
  expect(page.url()).toContain("returnTo=%2Fapp");
});
