// Run: tsx src/__tests__/northwing-work-projection.test.ts
// Break caught: a refresh that lacks an authoritative native Work runtime must
// leave the saved Work projection intact instead of resetting it to intake.
import {
  loadNorthwingWorkProjection,
  type NorthwingWorkProjectionGateway,
} from "../northwing/Work/useNorthwingWorkProjection";

let failed = 0;

function equal<T>(actual: T, expected: T, label: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    process.stdout.write(`  PASS  ${label}\n`);
    return;
  }
  failed += 1;
  process.stdout.write(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}\n`);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const savedWork = {
  id: "work-review",
  title: "Review the briefing package",
  profile: "delivery",
  stage: "reviewing",
  currentHarnessStep: "review",
  acceptance: [
    { id: "acc-1", text: "Source list is complete", status: "done", evidence: "sources.md" },
    { id: "acc-2", text: "Review findings are addressed", status: "pending" },
  ],
  unresolvedFindings: ["Confirm publication date"],
  completedCriteria: 1,
  totalCriteria: 2,
};

let syncArtifactsRequested = false;
const noRuntimeGateway: NorthwingWorkProjectionGateway = {
  readProjectState: async (_workspaceRoot, syncArtifacts) => {
    syncArtifactsRequested = syncArtifacts;
    return ({
    exists: true,
    project: {
      version: 1,
      id: "project-1",
      name: "Briefing",
      createdAt: "2026-08-09T00:00:00Z",
      updatedAt: "2026-08-09T00:00:00Z",
      works: [savedWork],
      artifacts: [
        { id: "artifact-current", path: "deliverables/work-review/report.docx", kind: "docx", workId: "work-review", version: 1, sha256: "one", size: 1, createdAt: "2026-08-10T00:00:00Z" },
        { id: "artifact-other", path: "deliverables/work-other/report.docx", kind: "docx", workId: "work-other", version: 1, sha256: "two", size: 1, createdAt: "2026-08-10T00:00:00Z" },
      ],
    },
  });
  },
  listTabs: async () => [],
  metaForTab: async () => {
    throw new Error("MetaForTab must not run without a native Work tab");
  },
  activeWorkForTab: async () => {
    throw new Error("ActiveWorkForTab must not run without a native Work tab");
  },
  updateProjection: async () => {
    throw new Error("Refresh without runtime evidence must not write the saved projection");
  },
};

const loaded = await loadNorthwingWorkProjection("C:/workspace", "work-review", noRuntimeGateway);

equal(loaded.projection.stage, "reviewing", "saved reviewing stage survives without runtime evidence");
equal(loaded.projection.currentHarnessStep, "review", "saved review step survives without runtime evidence");
equal(loaded.projection.acceptance, savedWork.acceptance, "mixed saved acceptance survives without runtime evidence");
equal(loaded.projection.unresolvedFindings, ["Confirm publication date"], "saved unresolved finding survives without runtime evidence");
equal(loaded.changed, false, "missing runtime evidence does not create a projection update");
equal(syncArtifactsRequested, true, "entering Work synchronizes current Project artifacts");
equal(loaded.artifacts.map((artifact) => artifact.id), ["artifact-current"], "Work projection excludes artifacts owned by another Work");

const slowProjectState = deferred<Awaited<ReturnType<NorthwingWorkProjectionGateway["readProjectState"]>>>();
let serialReads = 0;
const serialGateway: NorthwingWorkProjectionGateway = {
  ...noRuntimeGateway,
  readProjectState: async () => {
    serialReads += 1;
    if (serialReads === 1) return slowProjectState.promise;
    return noRuntimeGateway.readProjectState("C:/serial", false);
  },
};
const slowLoad = loadNorthwingWorkProjection("C:/serial", "work-review", serialGateway);
const queuedLoad = loadNorthwingWorkProjection("C:/serial", "work-review", serialGateway);
await Promise.resolve();
await Promise.resolve();
equal(serialReads, 1, "concurrent refreshes for one Work share a serialized load boundary");
slowProjectState.resolve(await noRuntimeGateway.readProjectState("C:/serial", false));
await Promise.all([slowLoad, queuedLoad]);
equal(serialReads, 2, "the queued refresh runs after the earlier Work refresh settles");

const runtimeWork = {
  ...savedWork,
  stage: "producing",
  currentHarnessStep: "produce",
};
const updates: unknown[] = [];
const runtimeGateway: NorthwingWorkProjectionGateway = {
  readProjectState: async () => ({
    exists: true,
    project: {
      version: 1,
      id: "project-1",
      name: "Briefing",
      createdAt: "2026-08-09T00:00:00Z",
      updatedAt: "2026-08-09T00:00:00Z",
      works: [runtimeWork],
    },
  }),
  listTabs: async () => [{
    id: "tab-work-review",
    scope: "project",
    workspaceRoot: "c:\\workspace\\",
    workspaceName: "workspace",
    topicId: "topic-review",
    topicTitle: "Review the briefing package",
    sessionKind: "work",
    workId: "work-review",
    label: "Review",
    ready: true,
    running: true,
    pendingPrompt: false,
    mode: "normal",
    active: true,
    cwd: "C:/workspace",
  }],
  metaForTab: async () => ({
    label: "Review",
    ready: true,
    eventChannel: "desktop-events",
    cwd: "C:/workspace",
    goalStatus: "running",
    canonicalTodos: [
      { content: "[harness:review] Review briefing", status: "in_progress" },
      { content: "[acceptance:acc-2] Address review findings", status: "completed" },
    ],
  }),
  activeWorkForTab: async () => ({
    running: true,
    pendingPrompt: false,
    cancellable: true,
    jobs: [],
  }),
  updateProjection: async (_root, _workId, projection) => {
    updates.push(projection);
    return { version: 1, id: "project-1", name: "Briefing", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" };
  },
};

const refreshed = await loadNorthwingWorkProjection("C:/workspace", "work-review", runtimeGateway);
equal(refreshed.projection.stage, "reviewing", "native review todo advances the saved Work stage");
equal(refreshed.projection.currentHarnessStep, "review", "native review todo advances the saved Harness step");
equal(refreshed.projection.acceptance[1]?.status, "done", "native acceptance todo completes the matching saved criterion");
equal(refreshed.changed, true, "runtime evidence reports the projection change");
equal(updates.length, 1, "changed runtime evidence persists one projection update");
equal((updates[0] as { completedCriteria?: number }).completedCriteria, 2, "projection persists the completed acceptance count");
equal((updates[0] as { totalCriteria?: number }).totalCriteria, 2, "projection persists the acceptance total");
equal(refreshed.work.completedCriteria, 2, "Work header receives the updated acceptance count immediately");

const waitingGateway: NorthwingWorkProjectionGateway = {
  ...runtimeGateway,
  listTabs: async () => [{
    id: "tab-work-review",
    scope: "project",
    workspaceRoot: "C:/workspace",
    workspaceName: "workspace",
    topicId: "topic-review",
    topicTitle: "Review the briefing package",
    sessionKind: "work",
    workId: "work-review",
    label: "Review",
    ready: true,
    running: true,
    pendingPrompt: false,
    mode: "normal",
    active: true,
    cwd: "C:/workspace",
  }],
  metaForTab: async () => ({
    label: "Review",
    ready: true,
    eventChannel: "desktop-events",
    cwd: "C:/workspace",
    goalStatus: "running",
    canonicalTodos: [],
  }),
  activeWorkForTab: async () => ({
    running: true,
    pendingPrompt: true,
    cancellable: true,
    jobs: [],
  }),
};
const waiting = await loadNorthwingWorkProjection("C:/workspace", "work-review", waitingGateway);
equal(waiting.projection.stage, "waiting_user", "native pending approval becomes a waiting Work stage");

const completedGateway: NorthwingWorkProjectionGateway = {
  ...runtimeGateway,
  readProjectState: async () => ({
    exists: true,
    project: {
      version: 1,
      id: "project-1",
      name: "Briefing",
      createdAt: "2026-08-09T00:00:00Z",
      updatedAt: "2026-08-09T00:00:00Z",
      works: [{
        ...runtimeWork,
        stage: "validating",
        currentHarnessStep: "validate",
        acceptance: [
          { id: "acc-1", text: "Source list is complete", status: "done" },
          { id: "acc-2", text: "Review findings are addressed", status: "done" },
        ],
      }],
    },
  }),
  metaForTab: async () => ({
    label: "Review",
    ready: true,
    eventChannel: "desktop-events",
    cwd: "C:/workspace",
    goalStatus: "complete",
    canonicalTodos: [],
  }),
};
const completed = await loadNorthwingWorkProjection("C:/workspace", "work-review", completedGateway);
equal(completed.projection.stage, "validating", "a completed Goal does not finish Work while its native runtime is active");

const settledGateway: NorthwingWorkProjectionGateway = {
  ...completedGateway,
  activeWorkForTab: async () => ({
    running: false,
    pendingPrompt: false,
    cancellable: false,
    jobs: [],
  }),
};
const settled = await loadNorthwingWorkProjection("C:/workspace", "work-review", settledGateway);
equal(settled.projection.stage, "completed", "a settled native runtime finalizes a completed and fully accepted Work");

const lastAcceptanceGateway: NorthwingWorkProjectionGateway = {
  ...settledGateway,
  readProjectState: async () => ({
    exists: true,
    project: {
      version: 1,
      id: "project-1",
      name: "Briefing",
      createdAt: "2026-08-09T00:00:00Z",
      updatedAt: "2026-08-09T00:00:00Z",
      works: [{ ...runtimeWork, stage: "validating", currentHarnessStep: "validate" }],
    },
  }),
  metaForTab: async () => ({
    label: "Review",
    ready: true,
    eventChannel: "desktop-events",
    cwd: "C:/workspace",
    goalStatus: "complete",
    canonicalTodos: [{ content: "[acceptance:acc-2] Address review findings", status: "completed" }],
  }),
};
const lastAcceptance = await loadNorthwingWorkProjection("C:/workspace", "work-review", lastAcceptanceGateway);
equal(lastAcceptance.projection.acceptance[1]?.status, "done", "the final acceptance item completes in the Goal completion poll");
equal(lastAcceptance.projection.stage, "completed", "the same poll can complete acceptance and the Work stage");

const uncGateway: NorthwingWorkProjectionGateway = {
  ...runtimeGateway,
  listTabs: async () => [{
    ...(await runtimeGateway.listTabs())[0],
    workspaceRoot: "\\\\SERVER\\Share\\Briefing\\",
  }],
};
const unc = await loadNorthwingWorkProjection("//server/share/briefing", "work-review", uncGateway);
equal(unc.projection.stage, "reviewing", "Windows UNC roots match across slash and case differences");

const rejectingGateway: NorthwingWorkProjectionGateway = {
  ...runtimeGateway,
  updateProjection: async () => {
    throw new Error("manifest unavailable");
  },
};
let rejection = "";
try {
  await loadNorthwingWorkProjection("C:/workspace", "work-review", rejectingGateway);
} catch (error) {
  rejection = error instanceof Error ? error.message : String(error);
}
equal(rejection, "manifest unavailable", "projection persistence errors reach the Work UI instead of becoming false success");

process.stdout.write(`\n${failed === 0 ? "All Northwing Work projection tests passed." : `${failed} test(s) FAILED.`}\n`);
process.exit(failed > 0 ? 1 : 0);
