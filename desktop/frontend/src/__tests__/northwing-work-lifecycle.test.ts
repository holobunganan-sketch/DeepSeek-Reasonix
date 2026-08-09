// Run: tsx src/__tests__/northwing-work-lifecycle.test.ts
import {
  normalizeWorkSpec,
  workStageForHarnessStep,
  type WorkStage,
} from "../lib/northwingWorkSpec";

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}

function equal<T>(actual: T, expected: T, label: string) {
  if (actual === expected) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}: got ${actual}, expected ${expected}\n`);
  }
}

console.log("\nNorthwing Work lifecycle projection");

const spec = normalizeWorkSpec({
  objective: "Finish the launch report",
  kind: "report",
  quality: "standard",
  sourcePolicy: "project_plus_web",
  materials: ["brief.md"],
});

ok(
  (["intake", "planning", "producing", "reviewing", "repairing", "validating", "waiting_user", "completed", "failed"] as WorkStage[]).every(
    (stage) => typeof stage === "string"
  ),
  "WorkStage union contains all user-facing stages"
);

equal(workStageForHarnessStep("evidence_ledger"), "intake", "evidence_ledger maps to intake");
equal(workStageForHarnessStep("independent_review"), "reviewing", "independent_review maps to reviewing");
equal(workStageForHarnessStep("requirement_audit"), "validating", "requirement_audit maps to validating");
ok(spec.harnessVersion === 3, "normalized spec carries Harness v3");
ok(spec.harnessSteps[0] === "inventory", "standard Work starts at inventory harness step");

const quick = normalizeWorkSpec({
  objective: "Quick summary",
  kind: "general",
  quality: "quick",
  sourcePolicy: "project_only",
});
ok(quick.harnessSteps[0] === "inspect", "quick Work starts at inspect harness step");

const deep = normalizeWorkSpec({
  objective: "Deep investigation",
  kind: "research",
  quality: "deep",
  sourcePolicy: "verified_web",
});
ok(deep.harnessSteps[0] === "inventory", "deep Work starts at inventory harness step");
ok(deep.harnessSteps.includes("evidence_ledger"), "deep Work includes evidence_ledger");

if (failed) process.exit(1);
console.log("Northwing Work lifecycle projection tests passed");
