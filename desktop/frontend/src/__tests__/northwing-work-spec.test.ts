// Run: tsx src/__tests__/northwing-work-spec.test.ts
import {
  NORTHWING_HARNESS_VERSION,
  compileWorkBrief,
  harnessStepsForQuality,
  normalizeWorkSpec,
  workOutputDir,
  workSpecSummary,
  workStageForHarnessStep,
} from "../lib/northwingWorkSpec";

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}

console.log("\nNorthwing WorkSpec compiler");

ok(NORTHWING_HARNESS_VERSION === 3, "Northwing Harness version is 3");
ok(
  harnessStepsForQuality("quick").join(",") === "inspect,produce,validate",
  "quick quality uses inspect → produce → validate"
);
ok(
  harnessStepsForQuality("standard").join(",") ===
    "inventory,plan,produce,review,repair,validate",
  "standard quality uses inventory → plan → produce → review → repair → validate"
);
ok(
  harnessStepsForQuality("deep").join(",") ===
    "inventory,evidence_ledger,plan,produce,review,independent_review,repair,validate,requirement_audit",
  "deep quality includes evidence ledger, independent review, and requirement audit"
);
ok(workStageForHarnessStep("inspect") === "intake", "inspect maps to intake");
ok(workStageForHarnessStep("inventory") === "intake", "inventory maps to intake");
ok(workStageForHarnessStep("evidence_ledger") === "intake", "evidence_ledger maps to intake");
ok(workStageForHarnessStep("plan") === "planning", "plan maps to planning");
ok(workStageForHarnessStep("produce") === "producing", "produce maps to producing");
ok(workStageForHarnessStep("review") === "reviewing", "review maps to reviewing");
ok(workStageForHarnessStep("independent_review") === "reviewing", "independent_review maps to reviewing");
ok(workStageForHarnessStep("repair") === "repairing", "repair maps to repairing");
ok(workStageForHarnessStep("validate") === "validating", "validate maps to validating");
ok(workStageForHarnessStep("requirement_audit") === "validating", "requirement_audit maps to validating");

const report = normalizeWorkSpec({
  objective: "Prepare a clinical study interpretation report",
  kind: "report",
  quality: "standard",
  sourcePolicy: "project_only",
  materials: ["sources/protocol.pdf"],
});
ok(/DOCX/i.test(report.deliverable), "report mode supplies an editable DOCX deliverable");
ok(report.acceptanceCriteria.some((item) => /opens correctly/i.test(item)), "common file validation is included");
ok(report.acceptanceCriteria.some((item) => /source/i.test(item)), "source-backed acceptance is included");

const deck = normalizeWorkSpec({
  objective: "Create an internal medical presentation",
  kind: "presentation",
  quality: "deep",
  sourcePolicy: "verified_web",
});
ok(/PPTX/i.test(deck.deliverable), "presentation mode supplies an editable PPTX deliverable");
ok(deck.harnessSteps.includes("independent_review"), "deep quality requires independent review");
ok(deck.harnessSteps.includes("requirement_audit"), "deep quality requires a requirement audit");

const quick = normalizeWorkSpec({
  objective: "Summarize the folder",
  kind: "general",
  quality: "quick",
  sourcePolicy: "project_only",
});
ok(quick.harnessSteps.join(",") === "inspect,produce,validate", "quick quality uses the bounded three-stage path");

const standard = normalizeWorkSpec({
  objective: "Analyze the workbook",
  kind: "analysis",
  quality: "standard",
  sourcePolicy: "project_plus_web",
});
ok(standard.harnessSteps.includes("review") && standard.harnessSteps.includes("repair"), "standard quality includes review and repair");
ok(/XLSX/i.test(standard.deliverable), "analysis mode supplies an editable XLSX deliverable");

const brief = compileWorkBrief("work-123", report);
ok(brief.includes("@sources/protocol.pdf"), "materials compile to Reasonix file references");
ok(brief.includes("Only use the supplied project materials"), "project-only policy compiles to an explicit evidence boundary");
ok(brief.includes("todo_write"), "Harness requires a concrete acceptance list");
ok(brief.includes("complete_step"), "Harness requires Delivery sign-off");
ok(brief.includes("deliverables/work-123/"), "formal output directory is fixed in the contract");
for (const heading of [
  "Goal",
  "Work type",
  "Inputs",
  "Materials",
  "Expected artifact",
  "Source policy",
  "Constraints",
  "Acceptance",
  "Execution policy",
  "Internal Harness steps",
]) {
  ok(brief.includes(`## ${heading}`), `contract contains ## ${heading}`);
}

const summary = workSpecSummary(deck).join(" ");
ok(/Deep/i.test(summary) && /verified web/i.test(summary), "summary exposes quality and evidence policy");
ok(/independent review/i.test(summary), "summary exposes deep harness steps");

let unsafeRejected = false;
try { workOutputDir("../escape"); } catch { unsafeRejected = true; }
ok(unsafeRejected, "unsafe Work IDs are rejected before path construction");

if (failed) process.exit(1);
console.log("Northwing WorkSpec compiler tests passed");
