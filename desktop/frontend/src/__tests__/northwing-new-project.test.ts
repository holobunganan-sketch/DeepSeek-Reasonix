// Run: node --import tsx src/__tests__/northwing-new-project.test.ts
import { createNewNorthwingProject } from "../northwing/Projects/newProjectController";

type AppMock = Record<string, (...args: unknown[]) => Promise<unknown>>;

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

function installApp(app: AppMock) {
  (globalThis as typeof globalThis & { window: { go: { main: { App: AppMock } } } }).window = {
    go: { main: { App: app } },
  };
}

console.log("\nNorthwing New Project lifecycle");

const calls: string[] = [];
installApp({
  PickWorkspace: async () => { calls.push("pick"); return "C:\\Users\\Northwing User\\新项目"; },
  CoworkProjectState: async () => { calls.push("inspect"); return { exists: false }; },
  CreateCoworkProject: async (_root, name) => {
    calls.push(`create:${String(name)}`);
    return {
      version: 3,
      id: "project-new",
      name,
      createdAt: "2026-08-10T00:00:00Z",
      updatedAt: "2026-08-10T00:00:00Z",
    };
  },
});
const created = await createNewNorthwingProject();
equal(calls, ["pick", "inspect", "create:新项目"], "native picker registers and creates a CJK/space workspace");
equal(created?.workspaceRoot, "C:\\Users\\Northwing User\\新项目", "created Project preserves the registered native path");

let duplicateCreateCalled = false;
installApp({
  PickWorkspace: async () => "C:/existing",
  CoworkProjectState: async () => ({ exists: true, project: { id: "existing" } }),
  CreateCoworkProject: async () => { duplicateCreateCalled = true; return {}; },
});
try {
  await createNewNorthwingProject();
  ok(false, "existing Project is reported clearly");
} catch (error) {
  ok(/already a Northwing Project/i.test(error instanceof Error ? error.message : String(error)), "existing Project is reported clearly");
}
ok(!duplicateCreateCalled, "existing Project manifest is never overwritten");

let cancelledCreateCalled = false;
installApp({
  PickWorkspace: async () => "",
  CoworkProjectState: async () => ({ exists: false }),
  CreateCoworkProject: async () => { cancelledCreateCalled = true; return {}; },
});
equal(await createNewNorthwingProject(), null, "cancelling the native picker leaves Projects unchanged");
ok(!cancelledCreateCalled, "picker cancellation creates no manifest");

if (failed) process.exit(1);
console.log("Northwing New Project lifecycle tests passed");
