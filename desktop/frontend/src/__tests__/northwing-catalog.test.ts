// Run: tsx src/__tests__/northwing-catalog.test.ts
import { normalizeNorthwingCatalog } from "../northwing/domain/catalog";

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
equal(catalog.waitingForUser[0].stage, "waiting_user", "waiting work stage is waiting_user");
equal(catalog.recentArtifacts[0].final, true, "recent artifact final flag is preserved");
equal(catalog.recentArtifacts[0].workId, "work-456", "recent artifact work id is preserved");
ok(Array.isArray(catalog.projects), "projects is an array");
ok(catalog.projects[0].exists, "first project exists");

const empty = normalizeNorthwingCatalog(undefined);
ok(Array.isArray(empty.projects), "undefined input yields empty projects");
ok(Array.isArray(empty.activeWorks), "undefined input yields empty activeWorks");
ok(Array.isArray(empty.waitingForUser), "undefined input yields empty waitingForUser");
ok(Array.isArray(empty.recentArtifacts), "undefined input yields empty recentArtifacts");

if (failed) process.exit(1);
console.log("Northwing product catalog normalization tests passed");
