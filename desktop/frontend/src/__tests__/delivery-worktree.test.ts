// Run: tsx src/__tests__/delivery-worktree.test.ts
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const source = (path: string) => readFileSync(resolve(dir, path), "utf8");
const bridge = source("../lib/bridge.ts");
const treeWrapper = source("../components/ProjectTree.tsx");
const treeBase = source("../components/ReasonixProjectTree.tsx");
const tree = treeWrapper + treeBase;
const workDialog = source("../components/NorthwingWorkDialog.tsx");
const artifactCenter = source("../components/NorthwingArtifactCenter.tsx");
const workSurface = source("../components/NorthwingWorkSessionSurface.tsx");
const coworkAdapter = source("../lib/northwingCowork.ts");
const workSpec = source("../lib/northwingWorkSpec.ts");
const coworkBridge = source("../lib/northwingBridgeAugment.ts");
const coworkDesktop = source("../../../cowork_projects.go");
const coworkOffice = source("../../../cowork_office.go");
const coworkArtifacts = source("../../../../internal/cowork/artifacts.go");
const coworkProject = source("../../../../internal/cowork/project.go");
const coworkPolicy = source("../../../../internal/cowork/work_policy.go");
const officeTool = source("../../../../internal/tool/builtin/northwing_office.go");
const identity = source("../../../northwing_identity.go");
const protocol = source("../../../northwing_protocol.go");
const wails = source("../../../wails.json");
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

console.log("\nNorthwing native Work surface");
ok(!/NorthwingProjectCenter/.test(treeWrapper), "detached ProjectCenter toolbar is absent");
ok(/export \{ ProjectTree \} from "\.\/ReasonixProjectTree"/.test(treeWrapper), "wrapper delegates directly to the complete native tree");
ok(/NorthwingWorkDialog/.test(treeBase), "native project creation owns Work launch");
ok(/CoworkProjectSummaries/.test(treeBase), "native tree decorates existing topics with compact Work metadata");
ok(/project-tree__topic--work/.test(treeBase), "Work is rendered as a native topic row modifier");
ok(/NorthwingWorkSessionSurface/.test(app), "active Work context is integrated with the native chat surface");
ok(/ResizableDrawer/.test(artifactCenter) && /workId/.test(artifactCenter), "artifacts use a Work-scoped native drawer");
ok(!/NorthwingCoworkRail/.test(treeWrapper), "detached Chat and Work rail is absent");
ok(!/NorthwingOpenCodeSetup/.test(treeBase + workDialog), "Work surface has no Provider-specific setup card");
ok(/CoworkProjectState\(workspaceRoot string, syncArtifacts bool\)/.test(coworkDesktop), "desktop exposes one current-project state binding");
ok(/export async function readCoworkProjectState\(workspaceRoot: string, syncArtifacts = true\)[\s\S]*requiredBinding\("CoworkProjectState"\)\(workspaceRoot, syncArtifacts\)/.test(coworkAdapter), "frontend reads one project state through the single desktop binding");
ok(/ensureCoworkProject\(workspaceRoot\)/.test(coworkAdapter), "first Work lazily creates project metadata");
ok(/onEvent/.test(workSurface) && /turn_done/.test(workSurface), "completed native turns refresh Work artifacts without a manual toolbar");
ok(/declare module "\.\/bridge"/.test(coworkBridge) && /CoworkProjectState\?/.test(coworkBridge), "generated Wails drift check includes optional Northwing bindings");

console.log("\nNorthwing guided Work entry");
ok(/WORK_KINDS/.test(workDialog) && /WORK_QUALITIES/.test(workDialog) && /SOURCE_POLICIES/.test(workDialog), "Work entry exposes fixed type, quality, and evidence policies");
ok(/app\.Models\(\)/.test(workDialog), "Work entry reads the configured Reasonix model catalog");
ok(!/API Key/i.test(workDialog) && !/opencode-go/i.test(workDialog), "Work entry never requests a second Provider credential");
ok(/<details/.test(workDialog) && /advanced/i.test(workDialog), "optional free-text controls remain under advanced settings");
ok(/compileWorkBrief\(workID, spec\)/.test(coworkAdapter), "native Work submits the compiled Work contract");
ok(/workOutputDir\(workID: string\)[\s\S]*`deliverables\/\$\{normalized\}`/.test(workSpec), "each Work receives a validated deterministic deliverables directory");
ok(/EnsureBlankTab\("project", workspaceRoot\)/.test(coworkAdapter), "new Work reuses a native Reasonix project session");
ok(/SetModelForTab\(tab\.id, spec\.modelRef\)/.test(coworkAdapter), "selected Reasonix executor model is applied before execution");
ok(/SetEffortForTab\(tab\.id, spec\.reasoningEffort\)/.test(coworkAdapter), "optional reasoning effort is applied through the existing tab runtime");
ok(/SetTokenModeForTab\(tab\.id, "delivery"\)/.test(coworkAdapter), "Work uses the existing Reasonix Delivery profile");
ok(/UpsertCoworkWork[\s\S]*submitGoal\(tab, spec\.objective, brief, spec\.title\)/.test(coworkAdapter), "Work-session binding and policy are durable before the first provider request");
ok(/SubmitInitialGoalToTab\([\s\S]*goal,[\s\S]*displayText,[\s\S]*input,[\s\S]*\[\]/.test(coworkAdapter), "atomic Goal submit separates compact Goal/display from the full Work contract");
ok(/"goal",[\s\S]*"auto"/.test(coworkAdapter), "Work retains safe automatic execution rather than YOLO");
ok(/OpenTopicSession\("project", workspaceRoot, work\.goalId/.test(coworkAdapter), "saved Work reopens its durable Reasonix topic when available");
ok(/ResumeSessionForTab\(tab\.id, work\.sessionPath\)/.test(coworkAdapter), "legacy Work falls back to its exact Reasonix session");
ok(/applyWorkBinding\(tab, work\)/.test(coworkAdapter), "restored Work reapplies its executor model and effort");
ok(/ResumeGoalForTab\(tab\.id\)/.test(coworkAdapter), "saved Work resumes the existing Goal when available");
ok(/launchCoworkWork\(workspaceRoot, draft\)/.test(workDialog), "guided dialog delegates execution to the native lifecycle adapter");

console.log("\nNorthwing Harness policy");
ok(/quick:[\s\S]*"inspect"[\s\S]*"produce"[\s\S]*"validate"/.test(workSpec), "Quick policy uses a bounded inspect-produce-validate path");
ok(/standard:[\s\S]*"inventory"[\s\S]*"plan"[\s\S]*"review"[\s\S]*"repair"[\s\S]*"validate"/.test(workSpec), "Standard policy includes planning, review, repair, and validation");
ok(/deep:[\s\S]*"evidence_ledger"[\s\S]*"independent_review"[\s\S]*"requirement_audit"/.test(workSpec), "Deep policy adds evidence, independent review, and requirement audit");
ok(/todo_write/.test(workSpec) && /complete_step/.test(workSpec), "Harness compiles Delivery acceptance and sign-off requirements");
ok(/project_only[\s\S]*project_plus_web[\s\S]*verified_web/.test(workSpec), "evidence policies compile explicit source boundaries");
ok(/Kind[\s\S]*Quality[\s\S]*SourcePolicy[\s\S]*ModelRef[\s\S]*ReasoningEffort[\s\S]*HarnessVersion/.test(coworkProject), "Work reference persists compact model and Harness policy");
ok(/CurrentHarnessVersion = 2/.test(coworkPolicy) && /NormalizeWorkPolicy/.test(coworkPolicy), "legacy Work policy normalizes to the current Harness contract");

console.log("\nNorthwing Office and Artifact center");
ok(/Name\(\) string \{ return "northwing_office" \}/.test(officeTool), "Office pack exposes one stable tool schema");
ok(/create_docx[\s\S]*create_pptx[\s\S]*create_xlsx[\s\S]*create_pdf/.test(officeTool), "Office pack supports four formal deliverable formats");
ok(/confineWrite/.test(officeTool) && /confineRead/.test(officeTool), "Office actions retain Reasonix workspace and permission confinement");
ok(/InspectCoworkArtifact/.test(coworkOffice), "Artifact Center has local deterministic Office inspection");
ok(/SyncArtifacts\(workspaceRoot string\)/.test(coworkArtifacts), "backend scans Work deliverable directories in one project transaction");
ok(/knownHashesByPath[\s\S]*knownHashesByPath\[rel\]\[digest\][\s\S]*continue/.test(coworkArtifacts), "known file hashes do not create duplicate artifact versions");
ok(/writeProject\(project\)/.test(coworkArtifacts), "changed artifacts publish one atomic manifest update");
ok(/SetCoworkArtifactFinal/.test(coworkDesktop), "desktop exposes final artifact selection");
ok(/openCoworkArtifact\(workspaceRoot, artifact\.path\)/.test(artifactCenter), "Artifact center opens files through the owning project tab");
ok(/revealCoworkArtifact\(workspaceRoot, artifact\.path\)/.test(artifactCenter), "Artifact center reveals files through the owning project tab");
ok(/ReadFileForTab\(tab\.id, path\)/.test(coworkAdapter), "Artifact preview is scoped to the owning project tab");
ok(/setCoworkArtifactFinal\(workspaceRoot, artifact\.id\)/.test(artifactCenter), "Artifact center marks a version as final");
ok(/reviseCoworkArtifact\(workspaceRoot, project, revising, revision\)/.test(artifactCenter), "Artifact center starts scoped revision work");
ok(/previewCoworkArtifact\(workspaceRoot, artifact\.path\)/.test(artifactCenter), "Artifact center provides a lightweight preview path");
ok(/preview\.file\?\.kind === "image"[\s\S]*preview\.file\?\.kind === "pdf"/.test(artifactCenter), "Artifact center renders native image and PDF previews");
ok(/inspectCoworkArtifact/.test(artifactCenter) && /officeMetrics/.test(artifactCenter), "Artifact center shows Office structure without a model call");
ok(/work\.modelRef/.test(artifactCenter) && /work\.quality/.test(artifactCenter), "Work management displays the saved model and quality policy");

console.log("\nNorthwing identity");
ok(/NORTHWING_HOME/.test(identity) && /REASONIX_HOME/.test(identity), "Northwing isolates data while preserving the Reasonix kernel contract");
ok(/io\.github\.holobunganansketch\.northwing/.test(identity), "Northwing app id is explicit");
ok(/northwing/.test(protocol) && /PendingNorthwingLaunches/.test(protocol), "Northwing URL protocol is parsed and queued");
ok(/"name": "northwing"/.test(wails) && /"outputfilename": "northwing"/.test(wails), "Wails builds the Northwing executable identity");

if (failed) process.exit(1);
console.log("delivery worktree and native Northwing Work contract tests passed");
