// Run: tsx src/__tests__/northwing-project-center.test.ts
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const source = (path: string) => readFileSync(resolve(dir, path), "utf8");
const wrapper = source("../components/ProjectTree.tsx");
const tree = source("../components/ReasonixProjectTree.tsx");
const dialog = source("../components/NorthwingWorkDialog.tsx");
const surface = source("../components/NorthwingWorkSessionSurface.tsx");
const drawer = source("../components/NorthwingArtifactCenter.tsx");
const app = source("../App.tsx");
const adapter = source("../lib/northwingCowork.ts");
const desktop = source("../../../cowork_projects.go");

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}

console.log("\nNorthwing native project integration");
ok(!existsSync(resolve(dir, "../components/NorthwingProjectCenter.tsx")), "detached ProjectCenter implementation is removed");
ok(!/NorthwingProjectCenter/.test(wrapper), "ProjectTree has no detached Work toolbar wrapper");
ok(/export \{ ProjectTree \} from "\.\/ReasonixProjectTree"/.test(wrapper), "ProjectTree delegates directly to the native tree");
ok(/CoworkProjectSummaries/.test(tree), "native tree loads compact Work links without rebuilding sessions");
ok(/NorthwingWorkDialog/.test(tree), "native project create action owns Work creation");
ok(/new-chat/.test(tree) && /new-work/.test(tree) && /add-project/.test(tree), "one native create menu exposes chat, Work, and project-folder actions");
ok(/project-tree__topic--work/.test(tree), "Work sessions reuse native topic rows with a compact Work modifier");
ok(/work\.quality/.test(tree) && /completedCriteria/.test(tree), "Work rows show compact policy and acceptance state");
ok(/launchCoworkWork\(workspaceRoot, draft\)/.test(dialog), "guided dialog launches the native session lifecycle");
ok(/ensureCoworkProject\(workspaceRoot\)/.test(adapter), "first Work lazily creates project metadata");
ok(/NorthwingWorkSessionSurface/.test(app), "the active native session renders the Work context surface");
ok(/ResizableDrawer/.test(drawer), "Work-scoped artifact management uses the native drawer");
ok(/workId/.test(drawer), "drawer is scoped to the active Work instead of the whole project");
ok(/CoworkProjectState\(workspaceRoot string, syncArtifacts bool\)/.test(desktop), "desktop exposes one current-project state binding");
ok(!/NorthwingOpenCodeSetup/.test(tree + dialog), "Work UI has no Provider-specific setup surface");

if (failed) process.exit(1);
console.log("Northwing native project integration tests passed");

await import("./northwing-work-spec.test");
await import("./northwing-native-session.test");
await import("./northwing-work-dialog.test");
await import("./northwing-independent-update.test");
