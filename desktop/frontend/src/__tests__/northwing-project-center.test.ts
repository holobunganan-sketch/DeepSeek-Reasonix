// Run: tsx src/__tests__/northwing-project-center.test.ts
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const source = (path: string) => readFileSync(resolve(dir, path), "utf8");
const center = source("../components/NorthwingProjectCenter.tsx");
const workDialog = source("../components/NorthwingWorkDialog.tsx");
const artifactCenter = source("../components/NorthwingArtifactCenter.tsx");
const adapter = source("../lib/northwingCowork.ts");
const wrapper = source("../components/ProjectTree.tsx");
const base = source("../components/ReasonixProjectTree.tsx");
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
ok(/CoworkProjectState\(workspaceRoot string, syncArtifacts bool\)/.test(desktop), "desktop exposes one current-project state binding");
ok(!/ListProjectTree\(/.test(center), "Work launcher does not rebuild the Reasonix project tree");
ok(/readCoworkProjectState\(workspaceRoot, syncArtifacts\)/.test(center), "one state call loads and optionally syncs the active project");
ok(!/createCoworkProject\(activeWorkspaceRoot/.test(center), "sidebar has no explicit Enable CoWork action");
ok(/<NorthwingWorkDialog/.test(center) && /<NorthwingArtifactCenter/.test(center), "native launcher exposes Work and Artifact entry points");
ok(/launchCoworkWork\(workspaceRoot, draft\)/.test(workDialog), "guided dialog launches the native Goal and Delivery lifecycle");
ok(/ensureCoworkProject\(workspaceRoot\)/.test(adapter), "first Work lazily creates project metadata");
ok(/continueCoworkWork\(workspaceRoot, work\)/.test(artifactCenter), "Work list resumes saved sessions");
ok(/openCoworkArtifact\(workspaceRoot, artifact\.path\)/.test(artifactCenter), "Artifact actions stay scoped to their project");
ok(/work\.modelRef/.test(artifactCenter) && /work\.quality/.test(artifactCenter), "Work management exposes model and Harness policy");
ok(/<NorthwingProjectCenter[\s\S]*<ReasonixProjectTree/.test(wrapper), "ProjectCenter integrates directly beside the complete Reasonix tree");
ok(!/NorthwingCoworkRail/.test(wrapper), "separate Chat and Work rail is removed");
ok(!/NorthwingOpenCodeSetup/.test(center) && !/NorthwingOpenCodeSetup/.test(wrapper), "Work surface has no OpenCode setup card");
ok(/export function ProjectTree\(/.test(base), "complete Reasonix project tree stays present as the base component");
ok(/session transcripts, artifact bodies, or Reasonix execution state/.test(desktop), "binding documents the no-duplication boundary");

if (failed) process.exit(1);
console.log("Northwing native project integration tests passed");

await import("./northwing-work-spec.test");
await import("./northwing-native-session.test");
await import("./northwing-work-dialog.test");
