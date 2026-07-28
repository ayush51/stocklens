import { test, expect } from "@playwright/test";

test.describe("unauthenticated smoke path", () => {
  test("marketing page loads with sign-in/sign-up entry points", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /track the thesis behind every position/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("sign-in page renders the credentials form", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  // Protected routes must never render tenant data for an unauthenticated
  // visitor — this is the boundary every RLS/auth fix in this app exists to
  // protect, so it's asserted directly rather than assumed.
  for (const route of ["/dashboard", "/portfolios"]) {
    test(`${route} redirects an unauthenticated visitor to /sign-in`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/sign-in/);
    });
  }
});
