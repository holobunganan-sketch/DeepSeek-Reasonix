// Run: tsx src/__tests__/delivery-worktree.test.ts
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const source = (path: string) => readFileSync(resolve(dir, path), "utf8");
const bridge = source("../lib/bridge.ts");
// Northwing wraps the unchanged Reasonix project tree. Source-level contracts
// inspect both files so the wrapper cannot hide regressions in the base surface.
const treeWrapper = source("../components/ProjectTree.tsx");
const treeBase = source("../components/ReasonixProjectTree.tsx");
const tree = treeWrapper + treeBase;
const northwingCenter = source("../components/NorthwingProjectCenter.tsx");
const workDialog = source("../components/NorthwingWorkDialog.tsx");
const artifactCenter = source("../components/NorthwingArtifactCenter.tsx");
const coworkAdapter = source("../lib/northwingCowork.ts");
const coworkBridge = source("../lib/northwingBridgeAugment.ts");
const coworkDesktop = source("../../../cowork_projects.go");
const coworkArtifacts = source("../../../../internal/cowork/artifacts.go");
const tabs = source("../components/TabBar.tsx");
const app = source("../App.tsx");
const badge = source("../components/WorktreeBadge.tsx");

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}

console.log("\ndelivery worktree");
ok(/DeliveryWorktreeAvailability\(workspaceRoot: string\)/.test(bridge), "bridge exposes non-mutating availability probe");
ok(/CreateDeliveryWorktree\(workspaceRoot: string\)/.test(bridge), "bridge exposes isolated workspace creation");
ok(/app\.DeliveryWorktreeAvailability\(projectRoot\)/.test(tree), "project menu probes Git before enabling isolation");
ok(/disabled: isolatingProject !== null \|\| isolationAvailability\?\.available === false/.test(tree), "menu disables unavailable or duplicate creation");
ok(/onCreateDeliveryWorktree\?\.\(workspaceRoot\)/.test(tree), "project menu delegates isolated workspace creation");
ok(/kind: "delivery-worktree"/.test(app) && /enqueueNavigation\(\{ kind: "delivery-worktree"/.test(app), "creation shares the last-click-wins navigation queue");
ok(/sourceDirty[\s\S]*worktreeCreatedDirty/.test(app), "dirty source checkout receives an explicit warning");
ok(/isolatedWorktree && <WorktreeBadge/.test(tabs), "tab strip identifies isolated worktrees");
ok(/activeTab\?\.isolatedWorktree && <WorktreeBadge/.test(app), "topic bar identifies isolated worktrees");
ok(/node\.isolatedWorktree && <WorktreeBadge/.test(tree), "project tree identifies isolated worktrees");
ok(/GitBranch/.test(badge) && /#6119/.test(badge), "shared badge preserves the credited #6119 design contribution");

console.log("\nNorthwing project center");
ok(/<NorthwingProjectCenter[\s\S]*<ReasonixProjectTree/.test(treeWrapper), "Northwing stays a thin wrapper around the complete Reasonix tree");
ok(/export function ProjectTree\(/.test(treeBase), "Reasonix project tree implementation remains present");
ok(/CoworkProjectState\(workspaceRoot string, syncArtifacts bool\)/.test(coworkDesktop), "desktop exposes one current-project state binding");
ok(/readCoworkProjectState\(workspaceRoot, syncArtifacts\)/.test(coworkAdapter), "frontend reads one project state instead of rebuilding the project catalog");
ok(!/ListProjectTree\(/.test(northwingCenter), "Northwing does not duplicate the Reasonix project catalog read");
ok(/createCoworkProject\(activeWorkspaceRoot/.test(northwingCenter), "regular workspaces can opt into CoWork");
ok(/event\.kind !== "turn_done"/.test(northwingCenter) && /refresh\(true\)/.test(northwingCenter), "completed Reasonix turns trigger local artifact synchronization");
ok(/declare module "\.\/bridge"/.test(coworkBridge) && /CoworkProjectState\?/.test(coworkBridge), "generated Wails drift check includes optional Northwing bindings");

console.log("\nNorthwing Work entry");
ok(/Goal[\s\S]*Materials[\s\S]*Deliverable[\s\S]*Constraints[\s\S]*Completion criteria/.test(coworkAdapter), "Work Brief preserves the five user-facing contract fields");
ok(/deliverables\/\$\{workID\.trim\(\)\}/.test(coworkAdapter), "each Work receives a deterministic deliverables directory");
ok(/EnsureBlankTab\("project", workspaceRoot\)/.test(coworkAdapter), "new Work reuses a native Reasonix project session");
ok(/SetTokenModeForTab\(tab\.id, "delivery"\)/.test(coworkAdapter), "Work uses the existing Reasonix Delivery profile");
ok(/UpsertCoworkWork[\s\S]*submitGoal\(tab, brief\)/.test(coworkAdapter), "Work-session binding is durable before the first provider request");
ok(/SubmitInitialGoalToTab\([\s\S]*displayText,[\s\S]*goal,[\s\S]*\[\]/.test(coworkAdapter), "atomic Goal submit sends the Work Brief directly without a second slash-command parse");
ok(/"goal",[\s\S]*"auto"/.test(coworkAdapter), "Work retains safe automatic execution rather than YOLO");
ok(/OpenTopicSession\("project", workspaceRoot, work\.goalId/.test(coworkAdapter), "saved Work reopens its durable Reasonix topic when available");
ok(/ResumeSessionForTab\(tab\.id, work\.sessionPath\)/.test(coworkAdapter), "legacy Work falls back to its exact Reasonix session");
ok(/ResumeGoalForTab\(tab\.id\)/.test(coworkAdapter), "saved Work resumes the existing Goal when available");
ok(/launchCoworkWork\(workspaceRoot, draft\)/.test(workDialog), "Work dialog delegates execution to the thin lifecycle adapter");

console.log("\nNorthwing Artifact center");
ok(/SyncArtifacts\(workspaceRoot string\)/.test(coworkArtifacts), "backend scans Work deliverable directories in one project transaction");
ok(/latest\.SHA256 == digest/.test(coworkArtifacts), "unchanged files do not create duplicate artifact versions");
ok(/writeProject\(project\)/.test(coworkArtifacts), "changed artifacts publish one atomic manifest update");
ok(/SetCoworkArtifactFinal/.test(coworkDesktop), "desktop exposes final artifact selection");
ok(/openCoworkArtifact\(workspaceRoot, artifact\.path\)/.test(artifactCenter), "Artifact center opens files through the owning project tab");
ok(/revealCoworkArtifact\(workspaceRoot, artifact\.path\)/.test(artifactCenter), "Artifact center reveals files through the owning project tab");
ok(/ReadFileForTab\(tab\.id, path\)/.test(coworkAdapter), "Artifact preview is scoped to the owning project tab");
ok(/setCoworkArtifactFinal\(workspaceRoot, artifact\.id\)/.test(artifactCenter), "Artifact center marks a version as final");
ok(/reviseCoworkArtifact\(workspaceRoot, project, revising, revision\)/.test(artifactCenter), "Artifact center starts scoped revision work");
ok(/previewCoworkArtifact\(workspaceRoot, artifact\.path\)/.test(artifactCenter), "Artifact center provides a lightweight preview path");

if (failed) process.exit(1);
console.log("delivery worktree and Northwing CoWork lifecycle tests passed");
