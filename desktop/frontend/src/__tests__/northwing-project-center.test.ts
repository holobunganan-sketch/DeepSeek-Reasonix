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

console.log("\nNorthwing project center");
ok(/CoworkProjectState\(workspaceRoot string, syncArtifacts bool\)/.test(desktop), "desktop exposes one current-project state binding");
ok(!/ListProjectTree\(/.test(center), "center does not rebuild the Reasonix project tree");
ok(/readCoworkProjectState\(workspaceRoot, syncArtifacts\)/.test(adapter), "one state call loads and optionally syncs the active project");
ok(/createCoworkProject\(activeWorkspaceRoot/.test(center), "active regular workspace can opt into CoWork");
ok(/<NorthwingWorkDialog/.test(center) && /<NorthwingArtifactCenter/.test(center), "project center exposes Work and Artifact entry points");
ok(/launchCoworkWork\(workspaceRoot, draft\)/.test(workDialog), "Work dialog launches the Goal and Delivery lifecycle");
ok(/submitGoal\(tab, objective, brief, title\)/.test(adapter), "Work title, Goal objective, and full Brief keep separate responsibilities");
ok(/continueCoworkWork\(workspaceRoot, work\)/.test(artifactCenter), "Work list resumes saved sessions");
ok(/openCoworkArtifact\(workspaceRoot, artifact\.path\)/.test(artifactCenter), "Artifact actions stay scoped to their project");
ok(/<NorthwingProjectCenter[\s\S]*<ReasonixProjectTree/.test(wrapper), "Northwing remains a thin wrapper around the Reasonix tree");
ok(/export function ProjectTree\(/.test(base), "complete Reasonix project tree stays present as the base component");
ok(/session transcripts, artifact bodies, or Reasonix execution state/.test(desktop), "binding documents the no-duplication boundary");

if (failed) process.exit(1);
console.log("Northwing project center tests passed");
