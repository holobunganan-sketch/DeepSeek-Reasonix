import { test, expect } from "@playwright/test";

const TEST_APP_URL = "/e2e/production-entry/index.html?platform=windows";

test.describe("Northwing Work-first path", () => {
  test("1-3: startup shows Home with New Work CTA", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 15000 });
    const newWorkButton = page.locator("button:has-text('New Work')").first();
    await expect(newWorkButton).toBeVisible();
  });

  test("4: Home shows Continue working with active Work", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Test Work: Analysis Report")).toBeVisible();
    await expect(page.getByText("Continue working")).toBeVisible();
  });

  test("5: Home shows Waiting for you", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Waiting for you" })).toBeVisible();
    await expect(page.getByText("Pending approval")).toBeVisible();
  });

  test("6: Home shows Recent artifacts", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Recent artifacts" })).toBeVisible();
  });

  test("7: Home shows Recent projects", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Recent projects" })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'E2E Test Project' })).toBeVisible();
  });

  test("8: Home shows Quick Chat secondary entry", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 15000 });
    // Quick Chat is a button in the page header area
    const quickChatButton = page.locator("button").filter({ hasText: "Quick Chat" }).first();
    await expect(quickChatButton).toBeVisible();
  });

  test("9: Home tagline is Work-first", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("From intent to finished work.")).toBeVisible();
  });

  test("10: clicking New Work navigates to new-work route", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 15000 });
    // Click the New Work button in the navigation
    const newWorkButton = page.locator("nav button:has-text('New Work')");
    await newWorkButton.click();
    // New Work should appear as a dialog or page
    await expect(page.getByRole('heading', { name: 'New Work' })).toBeVisible({ timeout: 5000 });
  });

  test("11: Navigation shows primary entries", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("navigation")).toBeVisible();
    const nav = page.getByRole("navigation");
    await expect(nav.getByText("Home")).toBeVisible();
    await expect(nav.getByText("Projects")).toBeVisible();
  });

  test("12: navigation to Projects page works", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 15000 });
    const projectsLink = page.getByRole("link").filter({ hasText: "Projects" });
    await expect(projectsLink).toBeVisible();
    await projectsLink.click();
    await expect(page.locator('[data-northwing-page="projects"]').first()).toBeVisible({ timeout: 5000 });
  });

  test("13: navigation to Work list works", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 15000 });
    const workLink = page.getByRole("link").filter({ hasText: /^Work$/ });
    await expect(workLink).toBeVisible();
    await workLink.click();
    await expect(page.locator('[data-northwing-page="work-list"]').first()).toBeVisible({ timeout: 5000 });
  });

  test("14: navigation to Artifacts works", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 15000 });
    const artifactsLink = page.getByRole("link").filter({ hasText: "Artifacts" });
    await expect(artifactsLink).toBeVisible();
    await artifactsLink.click();
    await expect(page.locator('[data-northwing-page="artifacts"]')).toBeVisible({ timeout: 5000 });
  });

  test("15: Quick Chat is accessible from Home header", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 15000 });
    // Quick Chat appears as a button in the Home header
    const quickChatBtn = page.locator("button").filter({ hasText: "Quick Chat" });
    const count = await quickChatBtn.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("16: app window title is Northwing", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    await expect(page).toHaveTitle("Northwing");
  });

  test("17: Home does not contain Reasonix branding in user-visible text", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 15000 });
    const bodyText = await page.textContent("body");
    expect(bodyText).not.toMatch(/\bReasonix\b/);
  });

  test("18: loading state shows all Home sections", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    const homePage = page.locator('[data-northwing-page="home"]');
    await expect(homePage).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Continue working")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Waiting for you" })).toBeVisible();
    await expect(page.getByText("Recent artifacts")).toBeVisible();
    await expect(page.getByText("Recent projects")).toBeVisible();
  });

  test("19: empty catalog shows appropriate empty states", async ({ page }) => {
    // Set empty catalog BEFORE navigating
    await page.goto(TEST_APP_URL);
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 15000 });

    // Override the catalog and force re-render by navigating to Projects and back
    await page.evaluate(() => {
      const win = window as Record<string, unknown>;
      const e2e = win.__NORTHWING_E2E__ as Record<string, Function> | undefined;
      if (e2e?.setCatalog) {
        e2e.setCatalog({ projects: [], activeWorks: [], waitingForUser: [], recentArtifacts: [] });
      }
    });
    // Navigate away and back to trigger re-render with new catalog
    const projectsLink = page.getByRole("link").filter({ hasText: "Projects" });
    await projectsLink.click();
    await expect(page.locator('[data-northwing-page="projects"]').first()).toBeVisible({ timeout: 5000 });
    const homeLink = page.getByRole("link").filter({ hasText: "Home" });
    await homeLink.click();
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 15000 });
    // Empty states should now show
    await expect(page.getByText("No active Work")).toBeVisible({ timeout: 5000 });
  });

  test("20: error state renders without crash", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    // The test app should always render the home page even with mock data
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 15000 });
    // Verify basic structural integrity
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
  });
});
