// Run: tsx src/__tests__/northwing-entry-gateway.test.ts
import {
  createNorthwingCatalogLoader,
  northwingProjectWorkspaceRoots,
  prepareNorthwingSessionDestination,
} from "../northwing/entryGateway";
import type { NorthwingCatalog } from "../northwing/domain/catalog";

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}

function equal<T>(actual: T, expected: T, label: string) {
  if (actual === expected) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}: got ${String(actual)}, expected ${String(expected)}\n`);
  }
}

const catalog: NorthwingCatalog = {
  projects: [],
  works: [],
  activeWorks: [],
  waitingForUser: [],
  recentArtifacts: [],
};

console.log("\nNorthwing product entry gateway");

async function run() {
  let catalogRoots: string[] | undefined;
  const readCatalog = createNorthwingCatalogLoader({
    listProjectTree: async () => [
      {
        key: "global",
        kind: "global_folder" as const,
        label: "Global",
        children: [
          { key: "nested-project", kind: "project" as const, label: "Nested", root: " C:/projects/nested ", children: [] },
        ],
      },
      {
        key: "project-a",
        kind: "project" as const,
        label: "Project A",
        root: "C:/projects/a",
        children: [
          { key: "duplicate-project-a", kind: "project" as const, label: "Duplicate A", root: "C:/projects/a", children: [] },
        ],
      },
      { key: "topic", kind: "topic" as const, label: "Topic", children: [] },
    ],
    readNorthwingCatalog: async (roots) => {
      catalogRoots = roots;
      return catalog;
    },
  });
  const result = await readCatalog();
  ok(result === catalog, "catalog loader returns the bound catalog result");
  equal(catalogRoots?.join("|"), "C:/projects/nested|C:/projects/a", "catalog binding receives recursive unique project roots");

  const windowsRoots = northwingProjectWorkspaceRoots([
    { key: "first", kind: "project", label: "First", root: " C:/Northwing Work/项目 A ", children: [] },
    { key: "case", kind: "project", label: "Case duplicate", root: "c:\\northwing work\\项目 A", children: [] },
    { key: "posix", kind: "project", label: "POSIX", root: "/workspace/Project A", children: [] },
    { key: "posix-case", kind: "project", label: "POSIX case", root: "/workspace/project A", children: [] },
  ]);
  equal(
    windowsRoots.join("|"),
    "C:/Northwing Work/项目 A|/workspace/Project A|/workspace/project A",
    "Windows workspace roots deduplicate case and separator variants while POSIX case remains significant",
  );

  let listFailureVisible = false;
  const failingCatalog = createNorthwingCatalogLoader({
    listProjectTree: async () => { throw new Error("Project tree unavailable"); },
    readNorthwingCatalog: async () => catalog,
  });
  try {
    await failingCatalog();
  } catch (error) {
    listFailureVisible = error instanceof Error && error.message === "Project tree unavailable";
  }
  ok(listFailureVisible, "project tree failures propagate to the caller for visible UI reporting");

  const calls: string[] = [];
  await prepareNorthwingSessionDestination(
    { kind: "work", workspaceRoot: "C:/projects/a", workId: "work-123" },
    {
      EnsureWorkTab: async (root, workId) => {
        calls.push(`ensure-work:${root}:${workId}`);
        return { id: "tab-work" };
      },
      EnsureBlankTab: async () => ({ id: "unused" }),
      SetActiveTab: async (tabId) => { calls.push(`activate:${tabId}`); },
    },
  );
  equal(calls.join("|"), "ensure-work:C:/projects/a:work-123|activate:tab-work", "work destination restores and activates its exact native Work tab");

  calls.length = 0;
  let workFailureVisible = false;
  try {
    await prepareNorthwingSessionDestination(
      { kind: "work", workspaceRoot: "C:/projects/a", workId: "work-123" },
      {
        EnsureWorkTab: async () => { throw new Error("Work session unavailable"); },
        EnsureBlankTab: async () => ({ id: "unused" }),
        SetActiveTab: async (tabId) => { calls.push(`activate:${tabId}`); },
      },
    );
  } catch (error) {
    workFailureVisible = error instanceof Error && error.message === "Work session unavailable";
  }
  ok(workFailureVisible && calls.length === 0, "failed Work restoration propagates without activating a different session");

  calls.length = 0;
  await prepareNorthwingSessionDestination(
    { kind: "quick-chat", tabId: "tab-chat" },
    {
      EnsureWorkTab: async () => ({ id: "unused" }),
      EnsureBlankTab: async () => ({ id: "unused" }),
      SetActiveTab: async (tabId) => { calls.push(`activate:${tabId}`); },
    },
  );
  equal(calls.join("|"), "activate:tab-chat", "quick chat with a tab activates that tab without creating another session");

  calls.length = 0;
  await prepareNorthwingSessionDestination(
    { kind: "quick-chat" },
    {
      EnsureWorkTab: async () => ({ id: "unused" }),
      EnsureBlankTab: async (scope, root) => {
        calls.push(`ensure-chat:${scope}:${root}`);
        return { id: "tab-blank" };
      },
      SetActiveTab: async (tabId) => { calls.push(`activate:${tabId}`); },
    },
  );
  equal(calls.join("|"), "ensure-chat:global:|activate:tab-blank", "quick chat without a tab reuses the lightweight global chat surface");

  calls.length = 0;
  let markAStarted: (() => void) | undefined;
  let releaseA: (() => void) | undefined;
  const aStarted = new Promise<void>((resolve) => { markAStarted = resolve; });
  const aRelease = new Promise<void>((resolve) => { releaseA = resolve; });
  const raceGateway = {
    EnsureWorkTab: async (_root: string, workId: string) => {
      calls.push(`ensure:${workId}`);
      if (workId === "work-a") {
        markAStarted?.();
        await aRelease;
      }
      // The production binding activates as part of EnsureWorkTab. Recording
      // that side effect makes the final-winner assertion meaningful.
      calls.push(`implicit-active:${workId}`);
      return { id: `tab-${workId}` };
    },
    EnsureBlankTab: async () => ({ id: "unused" }),
    SetActiveTab: async (tabId: string) => { calls.push(`activate:${tabId}`); },
  };
  const firstPreparation = prepareNorthwingSessionDestination(
    { kind: "work", workspaceRoot: "C:/projects/a", workId: "work-a" },
    raceGateway,
  );
  await aStarted;
  const secondPreparation = prepareNorthwingSessionDestination(
    { kind: "work", workspaceRoot: "C:/projects/a", workId: "work-b" },
    raceGateway,
  );
  releaseA?.();
  const [firstPrepared, secondPrepared] = await Promise.all([firstPreparation, secondPreparation]);
  ok(!firstPrepared && secondPrepared, "a newer Work destination supersedes an in-flight preparation");
  equal(
    calls.join("|"),
    "ensure:work-a|implicit-active:work-a|ensure:work-b|implicit-active:work-b|activate:tab-work-b",
    "serialized Work preparation leaves the newest destination active",
  );

  calls.length = 0;
  let markGatewayAStarted: (() => void) | undefined;
  let releaseGatewayA: (() => void) | undefined;
  const gatewayAStarted = new Promise<void>((resolve) => { markGatewayAStarted = resolve; });
  const gatewayARelease = new Promise<void>((resolve) => { releaseGatewayA = resolve; });
  const gatewayA = {
    EnsureWorkTab: async () => {
      calls.push("gateway-a:ensure");
      markGatewayAStarted?.();
      await gatewayARelease;
      calls.push("gateway-a:implicit-active");
      return { id: "tab-gateway-a" };
    },
    EnsureBlankTab: async () => ({ id: "unused" }),
    SetActiveTab: async (tabId: string) => { calls.push(`gateway-a:activate:${tabId}`); },
  };
  const gatewayB = {
    EnsureWorkTab: async () => {
      calls.push("gateway-b:ensure");
      calls.push("gateway-b:implicit-active");
      return { id: "tab-gateway-b" };
    },
    EnsureBlankTab: async () => ({ id: "unused" }),
    SetActiveTab: async (tabId: string) => { calls.push(`gateway-b:activate:${tabId}`); },
  };
  const gatewayARequest = prepareNorthwingSessionDestination(
    { kind: "work", workspaceRoot: "C:/projects/a", workId: "work-a" },
    gatewayA,
  );
  await gatewayAStarted;
  const gatewayBRequest = prepareNorthwingSessionDestination(
    { kind: "work", workspaceRoot: "C:/projects/b", workId: "work-b" },
    gatewayB,
  );
  releaseGatewayA?.();
  const [gatewayAPrepared, gatewayBPrepared] = await Promise.all([gatewayARequest, gatewayBRequest]);
  ok(!gatewayAPrepared && gatewayBPrepared, "replacing the session gateway invalidates its in-flight request");
  equal(
    calls.join("|"),
    "gateway-a:ensure|gateway-a:implicit-active|gateway-b:ensure|gateway-b:implicit-active|gateway-b:activate:tab-gateway-b",
    "the newest destination stays active after the session gateway changes",
  );

  if (failed) process.exit(1);
  console.log("Northwing product entry gateway tests passed");
}

void run();
