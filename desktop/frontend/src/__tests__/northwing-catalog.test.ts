// Run: tsx src/__tests__/northwing-catalog.test.ts
import { normalizeNorthwingCatalog } from "../northwing/domain/catalog";
import { countWorksByStatus, filterWorks } from "../northwing/Work/workFilters";

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
    process.stdout.write(`  FAIL  ${label}: got ${actual}, expected ${expected}\n`);
  }
}

console.log("\nNorthwing product catalog normalization");

const fixture = {
  projects: [
    {
      workspace: "/workspace/medical-strategy",
      exists: true,
      id: "proj-1",
      name: "Medical strategy",
      workCount: 2,
      artifactCount: 1,
    },
  ],
  activeWorks: [
    {
      workId: "work-123",
      projectId: "proj-1",
      projectName: "Medical strategy",
      workspace: "/workspace/medical-strategy",
      title: "Draft report",
      stage: "planning",
      quality: "standard",
      sourcePolicy: "project_plus_web",
      completedCriteria: 1,
      totalCriteria: 4,
      sessionKind: "work",
      bindingStatus: "native",
      updatedAt: "2026-08-03T12:02:00Z",
    },
    {
      workId: "work-456",
      projectId: "proj-1",
      projectName: "Medical strategy",
      workspace: "/workspace/medical-strategy",
      title: "Build slides",
      stage: "waiting_user",
      updatedAt: "2026-08-03T12:03:00Z",
    },
  ],
  waitingForUser: [
    {
      workId: "work-456",
      projectId: "proj-1",
      projectName: "Medical strategy",
      workspace: "/workspace/medical-strategy",
      title: "Build slides",
      stage: "waiting_user",
      quality: "deep",
      sourcePolicy: "verified_web",
      completedCriteria: 2,
      totalCriteria: 5,
      sessionKind: "work",
      bindingStatus: "native",
      updatedAt: "2026-08-03T12:03:00Z",
    },
  ],
  works: [
    {
      workId: "work-123",
      projectId: "proj-1",
      projectName: "Medical strategy",
      workspace: "/workspace/medical-strategy",
      title: "Draft report",
      stage: "planning",
      updatedAt: "2026-08-03T12:02:00Z",
    },
    {
      workId: "work-456",
      projectId: "proj-1",
      projectName: "Medical strategy",
      workspace: "/workspace/medical-strategy",
      title: "Build slides",
      stage: "waiting_user",
      updatedAt: "2026-08-03T12:03:00Z",
    },
    {
      workId: "work-done",
      projectId: "proj-1",
      projectName: "Medical strategy",
      workspace: "/workspace/medical-strategy",
      title: "Completed report",
      stage: "completed",
      updatedAt: "2026-08-03T12:01:00Z",
    },
    {
      workId: "work-failed",
      projectId: "proj-1",
      projectName: "Medical strategy",
      workspace: "/workspace/medical-strategy",
      title: "Failed import",
      stage: "failed",
      updatedAt: "2026-08-03T12:00:00Z",
    },
    {
      workId: "work-456",
      projectId: "proj-1",
      projectName: "Medical strategy",
      workspace: "/workspace/medical-strategy",
      title: "Build slides duplicate",
      stage: "waiting_user",
      updatedAt: "2026-08-03T12:03:00Z",
    },
  ],
  recentArtifacts: [
    {
      id: "art-1",
      path: "deliverables/work-456/slides.pptx",
      kind: "pptx",
      workId: "work-456",
      version: 2,
      final: true,
      projectId: "proj-1",
      projectName: "Medical strategy",
      workspace: "/workspace/medical-strategy",
      createdAt: "2026-08-03T12:04:00Z",
    },
  ],
};

const catalog = normalizeNorthwingCatalog(fixture);

equal(catalog.activeWorks[0].sessionKind, "work", "active work exposes sessionKind=work");
equal(catalog.activeWorks[0].stage, "planning", "active work stage is preserved");
equal(catalog.activeWorks.length, 1, "active projection excludes waiting Work");
equal(catalog.waitingForUser[0].stage, "waiting_user", "waiting work stage is waiting_user");
equal(catalog.recentArtifacts[0].final, true, "recent artifact final flag is preserved");
equal(catalog.recentArtifacts[0].workId, "work-456", "recent artifact work id is preserved");
ok(Array.isArray(catalog.projects), "projects is an array");
ok(catalog.projects[0].exists, "first project exists");

const allWorks = (catalog as typeof catalog & { works?: typeof catalog.activeWorks }).works ?? [];
equal(allWorks.length, 4, "all Work collection is complete and deduplicated");
equal(new Set(allWorks.map((work) => work.workId)).size, 4, "all Work collection has no duplicate workId");
equal(allWorks.map((work) => work.workId).join(","), "work-456,work-123,work-done,work-failed", "all Work ordering is stable");
equal(filterWorks(allWorks, { status: "waiting" }).length, 1, "Waiting filter returns one Work");
equal(filterWorks(allWorks, { status: "completed" })[0]?.workId, "work-done", "Completed filter includes completed Work");
equal(filterWorks(allWorks, { status: "failed" })[0]?.workId, "work-failed", "Failed filter includes failed Work");
const counts = countWorksByStatus(allWorks);
equal(counts.all, 4, "All count is correct");
equal(counts.active, 1, "Active count is correct");

const empty = normalizeNorthwingCatalog(undefined);
ok(Array.isArray(empty.projects), "undefined input yields empty projects");
ok(Array.isArray(empty.activeWorks), "undefined input yields empty activeWorks");
ok(Array.isArray(empty.waitingForUser), "undefined input yields empty waitingForUser");
ok(Array.isArray((empty as typeof empty & { works?: unknown[] }).works), "undefined input yields empty works");
ok(Array.isArray(empty.recentArtifacts), "undefined input yields empty recentArtifacts");

if (failed) process.exit(1);
console.log("Northwing product catalog normalization tests passed");
