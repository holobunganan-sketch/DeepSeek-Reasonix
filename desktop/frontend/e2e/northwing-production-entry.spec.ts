import { expect, test, type Page } from "@playwright/test";

const PRODUCTION_ENTRY = "/e2e/production-entry/index.html?platform=windows";

async function openProduction(page: Page) {
  await page.goto(PRODUCTION_ENTRY);
  await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 20_000 });
}

async function bridgeCalls(page: Page, name: string): Promise<unknown[][]> {
  return page.evaluate((method) => {
    const control = (window as unknown as { __NORTHWING_E2E__: { getCalls: (name: string) => unknown[][] } }).__NORTHWING_E2E__;
    return control.getCalls(method);
  }, name);
}

test.describe("Northwing production entry", () => {
  test("starts src/main.tsx on Home with the Windows bridge", async ({ page }) => {
    await openProduction(page);
    await expect(page).toHaveTitle("Northwing");
    await expect(page.getByRole("navigation", { name: "Northwing" })).toBeVisible();
    await expect(page.getByLabel("Window controls")).toBeVisible();
    expect(await bridgeCalls(page, "NorthwingCatalog")).not.toHaveLength(0);
  });

  test("Home and navigation New Work use the production router", async ({ page }) => {
    await openProduction(page);
    await page.locator('[data-northwing-page="home"] button').filter({ hasText: "New Work" }).first().click();
    await expect(page.locator('[data-northwing-page="new-work"]')).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible();
    await page.locator("nav").getByRole("button", { name: "New Work" }).click();
    await expect(page.getByRole("dialog", { name: "New Work" })).toBeVisible();
  });

  test("New Project registers, creates, enters, and survives a production reload", async ({ page }) => {
    await openProduction(page);
    await page.getByRole("link", { name: "Projects" }).click();
    await page.getByRole("button", { name: "New Project" }).first().click();
    await expect(page.locator('[data-northwing-page="project"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "新项目 空格" })).toBeVisible();
    expect(await bridgeCalls(page, "PickWorkspace")).toHaveLength(1);
    expect(await bridgeCalls(page, "CreateCoworkProject")).toHaveLength(1);

    await page.reload();
    await expect(page.locator('[data-northwing-page="home"]')).toBeVisible({ timeout: 20_000 });
    await page.getByRole("link", { name: "Projects" }).click();
    await expect(page.getByText("新项目 空格")).toBeVisible();
  });

  test("Project New Work preserves and locks the selected Project", async ({ page }) => {
    await openProduction(page);
    await page.getByRole("link", { name: "Projects" }).click();
    await page.getByText("E2E Test Project").click();
    await expect(page.locator('[data-northwing-page="project"]')).toBeVisible();
    await page.getByRole("button", { name: "New Work" }).first().click();
    const project = page.getByLabel("Project folder");
    await expect(project).toBeDisabled();
    await expect(project).toHaveValue("C:\\Northwing E2E\\项目 A");
  });

  test("Work List is complete, deduplicated, and filters terminal states", async ({ page }) => {
    await openProduction(page);
    await page.getByRole("link", { name: "Work" }).click();
    await expect(page.locator('[data-northwing-page="work-list"]')).toBeVisible();
    await expect(page.getByText("Pending approval: Literature Review")).toHaveCount(1);
    await page.getByRole("tab", { name: /Waiting/ }).click();
    await expect(page.getByText("Pending approval: Literature Review")).toHaveCount(1);
    await page.getByRole("tab", { name: /Completed/ }).click();
    await expect(page.getByText("Completed market brief")).toBeVisible();
    await page.getByRole("tab", { name: /Failed/ }).click();
    await expect(page.getByText("Failed data import")).toBeVisible();
    await page.getByRole("tab", { name: /All/ }).click();
    await expect(page.locator(".work-list-item")).toHaveCount(4);
  });

  test("Work opens through SessionWorkspace and Back returns to Work List", async ({ page }) => {
    await openProduction(page);
    await page.getByRole("link", { name: "Work" }).click();
    await page.getByText("Test Work: Analysis Report").click();
    await expect(page.locator('[data-northwing-page="work"]')).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Back to Work list" }).click();
    await expect(page.locator('[data-northwing-page="work-list"]')).toBeVisible();
  });

  test("Artifact preview, open, reveal, final, search, and ownership use production bindings", async ({ page }) => {
    await openProduction(page);
    await page.getByRole("link", { name: "Artifacts" }).click();
    await expect(page.getByText("Project: E2E Test Project · Work: work-active")).toBeVisible();
    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByText("Production bridge artifact preview")).toBeVisible();
    await page.getByRole("button", { name: "Open", exact: true }).click();
    await page.getByRole("button", { name: "Reveal" }).click();
    expect(await bridgeCalls(page, "OpenWorkspacePathForTab")).toHaveLength(1);
    expect(await bridgeCalls(page, "RevealWorkspacePathForTab")).toHaveLength(1);
    await page.getByRole("button", { name: "Set final" }).click();
    await expect(page.getByText("Final", { exact: true })).toBeVisible();
    expect(await bridgeCalls(page, "SetCoworkArtifactFinal")).toHaveLength(1);
    await page.getByLabel("Search artifacts").fill("does-not-exist");
    await expect(page.getByText("No artifacts match the current filters.")).toBeVisible();
  });

  test("configured models and no-model Settings recovery are production states", async ({ page }) => {
    await openProduction(page);
    await page.locator("nav").getByRole("button", { name: "New Work" }).click();
    await expect(page.getByLabel("Model")).toContainText("openai / gpt-5.6");
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.evaluate(() => {
      (window as unknown as { __NORTHWING_E2E__: { setNoModels: (value: boolean) => void } }).__NORTHWING_E2E__.setNoModels(true);
    });
    await page.locator("nav").getByRole("button", { name: "New Work" }).click();
    await expect(page.getByText("No usable model configured", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start Work" })).toBeDisabled();
    await page.getByRole("button", { name: "Configure models" }).click();
    await expect(page.locator('[data-northwing-page="settings"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  });

  test("fresh workspace creates Project and durable Work before initial submission", async ({ page }) => {
    await openProduction(page);
    await page.locator("nav").getByRole("button", { name: "New Work" }).click();
    await page.getByLabel("Project folder").fill("C:\\Northwing E2E\\Fresh Workspace");
    await page.getByLabel("Work title").fill("Fresh production Work");
    await page.getByLabel("Work objective").fill("Produce a verified production-entry result");
    await page.getByRole("button", { name: "Start Work" }).click();
    await expect(page.locator('[data-northwing-page="work"]')).toBeVisible({ timeout: 20_000 });
    const sequence = await page.evaluate(() => {
      const calls = (window as unknown as { __NORTHWING_E2E__: { calls: Record<string, unknown[][]> } }).__NORTHWING_E2E__.calls;
      return {
        create: calls.CreateCoworkProject?.length ?? 0,
        validate: calls.ValidateCoworkProjectWritable?.length ?? 0,
        ensure: calls.EnsureWorkTab?.length ?? 0,
        upsert: calls.UpsertCoworkWork?.length ?? 0,
        submit: calls.SubmitInitialGoalToTab?.length ?? 0,
      };
    });
    expect(sequence).toEqual({ create: 1, validate: 1, ensure: 1, upsert: 2, submit: 1 });
  });

  test("submission failure stays visible and retains durable Work metadata", async ({ page }) => {
    await openProduction(page);
    await page.evaluate(() => {
      (window as unknown as { __NORTHWING_E2E__: { setSubmitError: (message: string) => void } }).__NORTHWING_E2E__.setSubmitError("provider unavailable in production bridge");
    });
    await page.locator("nav").getByRole("button", { name: "New Work" }).click();
    await page.getByLabel("Project folder").fill("C:\\Northwing E2E\\项目 A");
    await page.getByLabel("Work title").fill("Recoverable failed Work");
    await page.getByLabel("Work objective").fill("Exercise the failure surface");
    await page.getByRole("button", { name: "Start Work" }).click();
    await expect(page.getByRole("alert")).toContainText("provider unavailable in production bridge");
    expect(await bridgeCalls(page, "UpsertCoworkWork")).toHaveLength(1);
    expect(await bridgeCalls(page, "SubmitInitialGoalToTab")).toHaveLength(1);
    await expect(page.locator('[data-northwing-page="new-work"]')).toBeVisible();
  });

  test("production catalog errors render an actionable error surface", async ({ page }) => {
    await openProduction(page);
    await page.evaluate(() => {
      (window as unknown as { __NORTHWING_E2E__: { setCatalogError: (message: string) => void } }).__NORTHWING_E2E__.setCatalogError("catalog unavailable from production bridge");
    });
    await page.getByRole("link", { name: "Projects" }).click();
    await expect(page.getByText("catalog unavailable from production bridge")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  test("Quick Chat mounts the shared production session boundary", async ({ page }) => {
    await openProduction(page);
    await page.getByRole("button", { name: "Quick Chat" }).click();
    await expect(page.locator('[data-northwing-page="quick-chat"]')).toBeVisible();
    await expect(page.getByText("Quick Chat", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Convert to Work" })).toBeVisible({ timeout: 20_000 });
    expect(await bridgeCalls(page, "EnsureBlankTab")).not.toHaveLength(0);
  });

  test("Windows controls call the real bridge contract and stay inside minimum viewport", async ({ page }) => {
    await page.setViewportSize({ width: 760, height: 480 });
    await openProduction(page);
    for (const name of ["Minimize window", "Maximize or restore window", "Close window"]) {
      const button = page.getByRole("button", { name });
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(760);
    }
    await page.getByRole("button", { name: "Minimize window" }).click();
    await page.getByRole("button", { name: "Maximize or restore window" }).click();
    await expect(page.getByRole("button", { name: "Maximize or restore window" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Close window" }).click();
    expect(await bridgeCalls(page, "MinimiseMainWindow")).toHaveLength(1);
    expect(await bridgeCalls(page, "ToggleMaximiseMainWindow")).toHaveLength(1);
    expect(await bridgeCalls(page, "CloseMainWindow")).toHaveLength(1);
  });
});
