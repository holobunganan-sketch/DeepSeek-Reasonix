// Run: tsx src/__tests__/northwing-work-coordinator.test.ts
import {
  projectWork,
  initialWorkProjection,
  harnessStepToWorkStage,
  type WorkProjection,
  type WorkRuntimeEvidence,
} from "../northwing/Work/NorthwingWorkCoordinator";

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
    process.stdout.write(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}\n`);
  }
}

console.log("\nNorthwing WorkCoordinator projection precedence");

function baseEvidence(): WorkRuntimeEvidence {
  return {
    canonicalTodos: [],
    pendingApproval: false,
    startupError: undefined,
    goalStatus: "active",
  };
}

const previous: WorkProjection = {
  stage: "producing",
  currentHarnessStep: "produce",
  acceptance: [
    { id: "acc-1", text: "opens correctly", status: "pending" },
    { id: "acc-2", text: "satisfies goal", status: "pending" },
  ],
  unresolvedFindings: [],
};

equal(
  projectWork(previous, { ...baseEvidence(), pendingApproval: true }).stage,
  "waiting_user",
  "pending approval forces waiting_user stage"
);

equal(
  projectWork(previous, { ...baseEvidence(), startupError: "boot failed" }).stage,
  "failed",
  "startup error forces failed stage"
);

equal(
  projectWork(previous, {
    ...baseEvidence(),
    canonicalTodos: [{ text: "[harness:review] Review draft", status: "in_progress" }],
  }).stage,
  "reviewing",
  "[harness:review] in_progress forces reviewing stage"
);

equal(
  projectWork(previous, {
    ...baseEvidence(),
    canonicalTodos: [{ text: "[harness:produce] Write report", status: "in_progress" }],
  }).stage,
  "producing",
  "[harness:produce] in_progress forces producing stage"
);

equal(
  projectWork(previous, {
    ...baseEvidence(),
    canonicalTodos: [{ text: "[harness:plan] Draft plan", status: "in_progress" }],
  }).stage,
  "planning",
  "[harness:plan] in_progress forces planning stage"
);

const allDone = previous.acceptance.map((item) => ({ ...item, status: "done" }));
equal(
  projectWork({ ...previous, acceptance: allDone }, {
    ...baseEvidence(),
    canonicalTodos: [{ text: "[harness:validate] Validate output", status: "completed" }],
    goalStatus: "complete",
  }).stage,
  "completed",
  "goal complete + all acceptance done forces completed"
);

equal(
  projectWork({ ...previous, acceptance: allDone.slice(0, 1).concat({ ...allDone[1], status: "pending" }) }, {
    ...baseEvidence(),
    canonicalTodos: [{ text: "[harness:validate] Validate output", status: "in_progress" }],
    goalStatus: "complete",
  }).stage,
  "validating",
  "goal complete but partial acceptance stays at harness stage"
);

equal(
  projectWork(previous, baseEvidence()).stage,
  "producing",
  "empty evidence preserves the last durable stage"
);

console.log("\nNorthwing WorkCoordinator harness-step mapping");

equal(harnessStepToWorkStage("inventory"), "intake", "inventory maps to intake");
equal(harnessStepToWorkStage("evidence_ledger"), "intake", "evidence_ledger maps to intake");
equal(harnessStepToWorkStage("plan"), "planning", "plan maps to planning");
equal(harnessStepToWorkStage("produce"), "producing", "produce maps to producing");
equal(harnessStepToWorkStage("review"), "reviewing", "review maps to reviewing");
equal(harnessStepToWorkStage("independent_review"), "reviewing", "independent_review maps to reviewing");
equal(harnessStepToWorkStage("repair"), "repairing", "repair maps to repairing");
equal(harnessStepToWorkStage("validate"), "validating", "validate maps to validating");
equal(harnessStepToWorkStage("requirement_audit"), "validating", "requirement_audit maps to validating");

console.log("\nNorthwing WorkCoordinator initial projection");

const initial = initialWorkProjection([
  { id: "acc-1", text: "opens correctly", status: "pending" },
]);
equal(initial.stage, "intake", "initial projection starts at intake");
equal(initial.currentHarnessStep, "inventory", "initial default step is inventory");
ok(initial.acceptance.length === 1, "initial projection carries acceptance items");
ok(typeof initial.unresolvedFindings !== "undefined", "initial projection has findings array");

console.log("\nNorthwing WorkCoordinator acceptance tracking");

const tracked = projectWork(initial, {
  ...baseEvidence(),
  canonicalTodos: [
    { text: "[harness:produce] Write content", status: "in_progress" },
    { text: "[acceptance:acc-1] Validate PDF opens", status: "completed" },
  ],
});
ok(tracked.stage === "producing", "harness-produce todo drives stage");

console.log(`\n${failed === 0 ? "All coordinator tests passed." : `${failed} test(s) FAILED.`}`);
process.exit(failed > 0 ? 1 : 0);
