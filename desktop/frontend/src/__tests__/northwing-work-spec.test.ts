// Run: tsx src/__tests__/northwing-work-spec.test.ts
import {
  compileWorkBrief,
  normalizeWorkSpec,
  workOutputDir,
  workSpecSummary,
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
ok(deck.stages.includes("independent_review"), "deep quality requires independent review");
ok(deck.stages.includes("requirement_audit"), "deep quality requires a requirement audit");

const quick = normalizeWorkSpec({
  objective: "Summarize the folder",
  kind: "general",
  quality: "quick",
  sourcePolicy: "project_only",
});
ok(quick.stages.join(",") === "inspect,produce,validate", "quick quality uses the bounded three-stage path");

const standard = normalizeWorkSpec({
  objective: "Analyze the workbook",
  kind: "analysis",
  quality: "standard",
  sourcePolicy: "project_plus_web",
});
ok(standard.stages.includes("review") && standard.stages.includes("repair"), "standard quality includes review and repair");
ok(/XLSX/i.test(standard.deliverable), "analysis mode supplies an editable XLSX deliverable");

const brief = compileWorkBrief("work-123", report);
ok(brief.includes("@sources/protocol.pdf"), "materials compile to Reasonix file references");
ok(brief.includes("Only use the supplied project materials"), "project-only policy compiles to an explicit evidence boundary");
ok(brief.includes("todo_write"), "Harness requires a concrete acceptance list");
ok(brief.includes("complete_step"), "Harness requires Delivery sign-off");
ok(brief.includes("deliverables/work-123/"), "formal output directory is fixed in the contract");

const summary = workSpecSummary(deck).join(" ");
ok(/Deep/i.test(summary) && /verified web/i.test(summary), "summary exposes quality and evidence policy");

let unsafeRejected = false;
try { workOutputDir("../escape"); } catch { unsafeRejected = true; }
ok(unsafeRejected, "unsafe Work IDs are rejected before path construction");

if (failed) process.exit(1);
console.log("Northwing WorkSpec compiler tests passed");
