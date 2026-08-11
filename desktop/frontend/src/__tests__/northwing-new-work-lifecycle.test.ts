// Run: node --import tsx src/__tests__/northwing-new-work-lifecycle.test.ts
import type { NewWorkFormState } from "../northwing/NewWork/NorthwingNewWork";
import { launchNewWork } from "../northwing/NewWork/newWorkController";

type AppMock = Record<string, (...args: unknown[]) => Promise<unknown>>;

const project = {
  version: 3,
  id: "project-a",
  name: "Project A",
  createdAt: "2026-08-10T00:00:00Z",
  updatedAt: "2026-08-10T00:00:00Z",
};

const form: NewWorkFormState = {
  title: "Prepare release",
  objective: "Prepare and validate the release package.",
  materials: [],
  outputType: "general",
  quality: "standard",
  sourcePolicy: "project_only",
  modelRef: "deepseek/reasoner",
  audience: "Release team",
  constraints: "Preserve existing data",
  acceptanceCriteria: ["Package checks pass"],
  pausePolicy: "pause",
  reasoningEffort: "high",
};

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}

function equal(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}\n`);
  }
}

function assertOrdered(calls: string[], expected: string[], label: string) {
  let cursor = -1;
  for (const call of expected) {
    cursor = calls.findIndex((candidate, index) => index > cursor && candidate === call);
    if (cursor < 0) {
      failed += 1;
      process.stdout.write(`  FAIL  ${label}: missing ${call} in ${JSON.stringify(calls)}\n`);
      return;
    }
  }
  process.stdout.write(`  PASS  ${label}\n`);
}

function installApp(overrides: Partial<AppMock> = {}) {
  const calls: string[] = [];
  const durableWorks: unknown[] = [];
  let exists = false;
  const app: AppMock = {
    SwitchWorkspace: async () => { calls.push("switch-workspace"); return "/workspace/project-a"; },
    CoworkProjectState: async () => {
      calls.push("read-project");
      return exists ? { exists: true, project } : { exists: false };
    },
    CreateCoworkProject: async () => { calls.push("create-project"); exists = true; return project; },
    ValidateCoworkProjectWritable: async () => { calls.push("validate-project-writable"); },
    Models: async () => {
      calls.push("read-models");
      return [{ ref: "deepseek/reasoner", provider: "deepseek", model: "reasoner", current: true }];
    },
    Effort: async () => {
      calls.push("read-effort");
      return { supported: true, current: "high", default: "high", levels: ["low", "medium", "high"] };
    },
    WorkbenchActiveTarget: async () => {
      calls.push("target");
      return { kind: "local", identityGen: 1, requestSeq: 1 };
    },
    WorkbenchSwitchLocal: async () => ({ kind: "local", identityGen: 1, requestSeq: 1 }),
    EnsureWorkTab: async () => {
      calls.push("ensure-work-tab");
      return {
        id: "tab-work-a",
        topicId: "topic-work-a",
        sessionPath: "/sessions/work-a.jsonl",
        scope: "project",
        workspaceRoot: "/workspace/project-a",
        workspaceName: "Project A",
        label: "Prepare release",
        ready: true,
        running: false,
        mode: "normal",
        active: true,
        cwd: "/workspace/project-a",
      };
    },
    MetaForTab: async () => ({ sessionPath: "/sessions/work-a.jsonl" }),
    UpsertCoworkWork: async (_root, work) => {
      calls.push("upsert-work");
      durableWorks.push(work);
      return project;
    },
    RenameTopic: async () => { calls.push("rename-topic"); },
    SetModelForTab: async () => { calls.push("set-model"); },
    SetEffortForTab: async () => { calls.push("set-effort"); },
    SetTokenModeForTab: async () => { calls.push("set-token-mode"); },
    SubmitInitialGoalToTab: async () => { calls.push("submit-goal"); return []; },
    SetActiveTab: async () => { calls.push("activate-tab"); },
    ...overrides,
  };
  (globalThis as typeof globalThis & { window: { go: { main: { App: AppMock } } } }).window = {
    go: { main: { App: app } },
  };
  return { calls, durableWorks, setProjectExists: (value: boolean) => { exists = value; } };
}

async function rejects(run: () => Promise<unknown>, pattern: RegExp, label: string) {
  try {
    await run();
    failed += 1;
    process.stdout.write(`  FAIL  ${label}: resolved unexpectedly\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ok(pattern.test(message), `${label}: ${message}`);
  }
}

console.log("\nNorthwing New Work lifecycle");

const fresh = installApp();
await launchNewWork("/workspace/project-a", form);
assertOrdered(
  fresh.calls,
  [
    "switch-workspace",
    "read-project",
    "create-project",
    "validate-project-writable",
    "read-models",
    "read-effort",
    "ensure-work-tab",
    "upsert-work",
    "submit-goal",
    "activate-tab",
  ],
  "fresh workspace registers and persists Project/Work before submission",
);
equal(fresh.durableWorks.length, 2, "successful launch refreshes the durable Work binding after submission");

const existing = installApp();
existing.setProjectExists(true);
await launchNewWork("/workspace/project-a", form);
ok(!existing.calls.includes("create-project"), "existing Northwing Project is not overwritten");
assertOrdered(existing.calls, ["read-project", "validate-project-writable", "ensure-work-tab"], "existing Project is validated before session creation");

const readOnly = installApp({
  ValidateCoworkProjectWritable: async () => { throw new Error("project manifest is read-only"); },
});
readOnly.setProjectExists(true);
await rejects(() => launchNewWork("/workspace/project-a", form), /read-only/i, "read-only manifest produces a clear error");
ok(!readOnly.calls.includes("ensure-work-tab"), "read-only manifest creates no Work session");

const missingWorkspace = installApp({
  SwitchWorkspace: async () => { throw new Error("workspace does not exist"); },
});
await rejects(() => launchNewWork("/missing", form), /does not exist/i, "missing workspace produces a clear error");
ok(!missingWorkspace.calls.includes("ensure-work-tab"), "missing workspace creates no Work session");

const noWrite = installApp({
  CreateCoworkProject: async () => { throw new Error("permission denied while creating project manifest"); },
});
await rejects(() => launchNewWork("/workspace/project-a", form), /permission denied/i, "unwritable workspace produces a clear error");
ok(!noWrite.calls.includes("ensure-work-tab"), "unwritable workspace creates no Work session");

const invalidModel = installApp({
  Models: async () => [{ ref: "openai/gpt-5", provider: "openai", model: "gpt-5", current: true }],
});
await rejects(() => launchNewWork("/workspace/project-a", form), /unavailable.*deepseek\/reasoner/i, "invalid model is rejected before launch");
ok(!invalidModel.calls.includes("ensure-work-tab"), "invalid model creates no Work session");

const noModel = installApp({ Models: async () => [] });
await rejects(() => launchNewWork("/workspace/project-a", { ...form, modelRef: "" }), /No usable model configured/i, "missing provider key/model is actionable");
ok(!noModel.calls.includes("ensure-work-tab"), "missing provider key/model creates no Work session");

const submitFailure = installApp({
  SubmitInitialGoalToTab: async () => { throw new Error("provider unavailable"); },
});
await rejects(() => launchNewWork("/workspace/project-a", form), /provider unavailable/i, "submit failure is surfaced");
ok(submitFailure.durableWorks.length >= 1, "submit failure retains a discoverable durable Work");
ok(!submitFailure.calls.includes("activate-tab"), "failed submission does not activate a broken Work");

if (failed) process.exit(1);
console.log("Northwing New Work lifecycle tests passed");
