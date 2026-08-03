// Run: tsx src/__tests__/northwing-project-center.test.ts
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const source = (path: string) => readFileSync(resolve(dir, path), "utf8");
const center = source("../components/NorthwingProjectCenter.tsx");
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
ok(/CoworkProjectSummaries\(workspaceRoots \[\]string\)/.test(desktop), "desktop exposes one batch summary binding");
ok(!/ListProjectTree\(/.test(center), "center does not rebuild the Reasonix project tree");
ok(/CoworkProjectSummaries\(\[activeWorkspaceRoot\]\)/.test(center), "only the active manifest crosses Wails");
ok(!/LoadCoworkProject\(/.test(center), "center does not load full manifests over separate Wails calls");
ok(/CreateCoworkProject\(activeWorkspaceRoot/.test(center), "active regular workspace can opt into CoWork");
ok(/<NorthwingProjectCenter[\s\S]*<ReasonixProjectTree/.test(wrapper), "Northwing remains a thin wrapper around the Reasonix tree");
ok(/export function ProjectTree\(/.test(base), "complete Reasonix project tree stays present as the base component");
ok(/session transcripts, artifact bodies, or Reasonix execution state/.test(desktop), "binding documents the no-duplication boundary");

if (failed) process.exit(1);
console.log("Northwing project center tests passed");
