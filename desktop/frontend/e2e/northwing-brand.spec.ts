import { test, expect } from "@playwright/test";

const TEST_APP_URL = "/e2e/test-app/index.html";

test.describe("Northwing brand surface audit", () => {
  test("Home page contains no Reasonix text in user-visible DOM", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 15000 });
    const visibleText = await page.locator("body").innerText();
    expect(visibleText).not.toMatch(/\bReasonix\b/);
  });

  test("Navigation sidebar contains no Reasonix text", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    const nav = page.getByRole("navigation");
    await expect(nav).toBeVisible({ timeout: 15000 });
    const navText = await nav.innerText();
    expect(navText).not.toMatch(/\bReasonix\b/);
  });

  test("page title is Northwing not Reasonix", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    await expect(page).toHaveTitle("Northwing");
  });

  test("meta application-name is Northwing", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    const metaName = await page.locator('meta[name="application-name"]').getAttribute("content");
    expect(metaName).toBe("Northwing");
  });

  test("meta description is Northwing-focused", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    const metaDesc = await page.locator('meta[name="description"]').getAttribute("content");
    expect(metaDesc).toContain("Northwing");
  });

  test("Projects page contains no Reasonix text", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 15000 });
    const projectsLink = page.getByRole("link").filter({ hasText: "Projects" });
    await expect(projectsLink).toBeVisible({ timeout: 5000 });
    await projectsLink.click();
    await expect(page.locator('[data-northwing-page="projects"]').first()).toBeVisible({ timeout: 5000 });
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/\bReasonix\b/);
  });

  test("Artifacts page contains no Reasonix text", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 15000 });
    const artifactsLink = page.getByRole("link").filter({ hasText: "Artifacts" });
    await expect(artifactsLink).toBeVisible({ timeout: 5000 });
    await artifactsLink.click();
    await expect(page.locator('[data-northwing-page="artifacts"]')).toBeVisible({ timeout: 5000 });
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/\bReasonix\b/);
  });

  test("primary CTA uses Northwing terminology", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 15000 });
    const newWorkElements = page.locator("button, a, [role='button']").filter({ hasText: "New Work" });
    const count = await newWorkElements.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("tagline reflects Work-first positioning", async ({ page }) => {
    await page.goto(TEST_APP_URL);
    await expect(page.getByText("From intent to finished work.")).toBeVisible();
  });
});
