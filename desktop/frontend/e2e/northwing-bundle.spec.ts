import { test, expect } from "@playwright/test";

const TEST_APP_URL = "/e2e/test-app/index.html";

/**
 * Bundle / chunk boundary checks.
 *
 * In dev mode (Vite), all modules are loaded on demand as ESM.
 * The production bundle budget is enforced by scripts/check-bundle-budget.mjs.
 *
 * These browser tests verify:
 * 1. The Home page renders without crashing
 * 2. No JS console errors on load
 * 3. The HTML document has proper structure
 */
test.describe("Northwing bundle boundaries", () => {
  test("Home renders without JS console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(TEST_APP_URL);
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 15000 });
    expect(errors).toEqual([]);
  });

  test("Home renders within acceptable time", async ({ page }) => {
    const start = Date.now();
    await page.goto(TEST_APP_URL);
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 20000 });
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(30000);
  });

  test("Home HTML element has lang attribute", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    const lang = await page.locator("html").getAttribute("lang");
    expect(lang).toBeTruthy();
  });

  test("Home page has Northwing window title", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    await expect(page).toHaveTitle("Northwing");
  });

  test("no unstyled content flash (body has rendered children)", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 15000 });
    // The root div should have rendered children (not empty)
    const rootChildren = await page.locator("#root > *").count();
    expect(rootChildren).toBeGreaterThan(0);
  });

  test("viewport meta is present", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    const viewportMeta = page.locator('meta[name="viewport"]');
    await expect(viewportMeta).toBeAttached();
  });
});
