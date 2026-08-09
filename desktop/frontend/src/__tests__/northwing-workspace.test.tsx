// Run: tsx src/__tests__/northwing-workspace.test.tsx
// Verified: component structure, CSS, data attributes, branding surface, column layout.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

let passed = 0;
let failed = 0;

function ok(value: boolean, label: string) {
  if (value) {
    process.stdout.write(`  PASS  ${label}\n`);
    passed += 1;
  } else {
    process.stdout.write(`  FAIL  ${label}\n`);
    failed += 1;
  }
}

const HERE = dirname(fileURLToPath(import.meta.url));
const NW_WORK_DIR = resolve(HERE, "../northwing/Work");

// --- File existence ---
const expectedFiles = [
  "NorthwingWorkView.tsx",
  "NorthwingWorkHeader.tsx",
  "NorthwingWorkPlan.tsx",
  "NorthwingWorkActivity.tsx",
  "NorthwingMaterialsPanel.tsx",
  "NorthwingWorkCoordinator.ts",
  "useNorthwingWorkProjection.ts",
  "NorthwingWork.css",
];
for (const file of expectedFiles) {
  try {
    readFileSync(resolve(NW_WORK_DIR, file));
    ok(true, `file ${file} exists`);
  } catch {
    ok(false, `file ${file} exists`);
  }
}

// --- CSS rules ---
const css = readFileSync(resolve(NW_WORK_DIR, "NorthwingWork.css"), "utf8");
ok(css.includes("nw-work-view"), "CSS contains .nw-work-view");
ok(css.includes("nw-work-view__body"), "CSS contains three-column body class");
ok(css.includes("nw-work-view__left"), "CSS contains left column class");
ok(css.includes("nw-work-view__center"), "CSS contains center column class");
ok(css.includes("nw-work-view__right"), "CSS contains right column class");
ok(css.includes("nw-work-header"), "CSS contains header class");
ok(css.includes("display:"), "CSS contains display rules");
ok(css.includes("grid") || css.includes("flex"), "CSS contains layout rules");

// --- Component exports ---
const viewSource = readFileSync(resolve(NW_WORK_DIR, "NorthwingWorkView.tsx"), "utf8");
ok(viewSource.includes("export function NorthwingWorkView"), "NorthwingWorkView exported as function");
ok(viewSource.includes('data-northwing-page="work"'), "View sets data-northwing-page attribute");
ok(viewSource.includes("data-work-id="), "View sets data-work-id attribute");
ok(viewSource.includes('role="main"'), "View renders main landmark");
ok(viewSource.includes('aria-label="Work plan"'), "View renders Work plan aside");
ok(viewSource.includes('aria-label="Work activity"'), "View renders Work activity section");
ok(viewSource.includes('aria-label="Materials and artifacts"'), "View renders Materials aside");

const headerSource = readFileSync(resolve(NW_WORK_DIR, "NorthwingWorkHeader.tsx"), "utf8");
ok(headerSource.includes("export function NorthwingWorkHeader"), "NorthwingWorkHeader exported");

const planSource = readFileSync(resolve(NW_WORK_DIR, "NorthwingWorkPlan.tsx"), "utf8");
ok(planSource.includes("export function NorthwingWorkPlan"), "NorthwingWorkPlan exported");
ok(planSource.includes("acceptance"), "WorkPlan references acceptance");

const activitySource = readFileSync(resolve(NW_WORK_DIR, "NorthwingWorkActivity.tsx"), "utf8");
ok(activitySource.includes("export function NorthwingWorkActivity"), "NorthwingWorkActivity exported");
ok(activitySource.includes("SessionWorkspace"), "WorkActivity handles SessionWorkspace");

const materialsSource = readFileSync(resolve(NW_WORK_DIR, "NorthwingMaterialsPanel.tsx"), "utf8");
ok(materialsSource.includes("export function NorthwingMaterialsPanel"), "NorthwingMaterialsPanel exported");
ok(materialsSource.includes("artifact") || materialsSource.includes("Artifact"), "MaterialsPanel handles artifacts");

// --- Coordinator exports ---
const coordinatorSource = readFileSync(resolve(NW_WORK_DIR, "NorthwingWorkCoordinator.ts"), "utf8");
ok(coordinatorSource.includes("export function projectWork"), "projectWork exported from coordinator");
ok(coordinatorSource.includes("export function harnessStepToWorkStage"), "harnessStepToWorkStage exported");
ok(coordinatorSource.includes("export function initialWorkProjection"), "initialWorkProjection exported");
ok(coordinatorSource.includes("export function classifyTodo"), "classifyTodo exported");

// --- Branding: no Reasonix in Work components ---
const allSources = expectedFiles
  .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
  .map((f) => readFileSync(resolve(NW_WORK_DIR, f), "utf8"));
const combined = allSources.join("\n");
const hasReasonix = /Reasonix/i.test(combined);
ok(!hasReasonix, "Work component sources contain zero Reasonix branding");

// --- Shell integration ---
const shellSource = readFileSync(resolve(HERE, "../northwing/Shell/NorthwingShell.tsx"), "utf8");
ok(shellSource.includes("NorthwingWorkView"), "NorthwingShell imports NorthwingWorkView");
ok(shellSource.includes('case "work"'), "Shell routes work destinations");

// --- Type guard: Work and Chat separation ---
ok(
  viewSource.includes('data-northwing-page="work"'),
  "Work view has explicit data-northwing-page for Test 8 separation",
);

process.stdout.write(`\n${failed === 0 ? "All workspace structure tests passed." : `${failed} test(s) FAILED.`}\n`);
process.exit(failed > 0 ? 1 : 0);
