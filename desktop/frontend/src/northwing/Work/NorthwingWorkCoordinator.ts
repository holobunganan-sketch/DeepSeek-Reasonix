import type { WorkStage, HarnessStep } from "../../lib/northwingWorkSpec";

export type { WorkStage, HarnessStep };

export type AcceptanceItem = {
  id: string;
  text: string;
  status: string;
  evidence?: string;
};

export type WorkProjection = {
  stage: WorkStage;
  currentHarnessStep: HarnessStep;
  acceptance: AcceptanceItem[];
  unresolvedFindings: string[];
};

export type WorkRuntimeEvidence = {
  canonicalTodos: { text: string; status: string }[];
  pendingApproval: boolean;
  startupError?: string;
  goalStatus: string;
};

const HARNESS_TAG = /\[harness:(inspect|inventory|evidence_ledger|plan|produce|review|independent_review|repair|validate|requirement_audit)\]/i;
const ACCEPTANCE_TAG = /\[acceptance:(\S+)\]/i;

const HARNESS_TO_STAGE: Record<string, WorkStage> = {
  inspect: "intake",
  inventory: "intake",
  evidence_ledger: "intake",
  plan: "planning",
  produce: "producing",
  review: "reviewing",
  independent_review: "reviewing",
  repair: "repairing",
  validate: "validating",
  requirement_audit: "validating",
};

export function harnessStepToWorkStage(step: string): WorkStage {
  return HARNESS_TO_STAGE[step.toLowerCase()] ?? "intake";
}

export function initialWorkProjection(acceptance: AcceptanceItem[]): WorkProjection {
  return {
    stage: "intake",
    currentHarnessStep: "inventory",
    acceptance: acceptance.map((item) => ({ ...item })),
    unresolvedFindings: [],
  };
}

function parseHarnessTodo(text: string): HarnessStep | undefined {
  const match = HARNESS_TAG.exec(text);
  if (!match) return undefined;
  return match[1].toLowerCase() as HarnessStep;
}

function parseAcceptanceTodo(text: string): string | undefined {
  const match = ACCEPTANCE_TAG.exec(text);
  return match?.[1] ?? undefined;
}

function todoDisplay(text: string): string {
  return text.replace(HARNESS_TAG, "").replace(ACCEPTANCE_TAG, "").replace(/^\s*-?\s*/, "").trim();
}

export function classifyTodo(todo: { text: string; status: string }) {
  const harness = parseHarnessTodo(todo.text);
  const acceptance = parseAcceptanceTodo(todo.text);
  return {
    kind: harness ? ("harness" as const) : acceptance ? ("acceptance" as const) : ("other" as const),
    harnessStep: harness,
    acceptanceId: acceptance,
    display: todoDisplay(todo.text),
    status: todo.status,
  };
}

export function projectWork(previous: WorkProjection, evidence: WorkRuntimeEvidence): WorkProjection {
  const stage = computeStage(previous, evidence);
  const currentStep = computeCurrentHarnessStep(evidence, previous.currentHarnessStep);
  const acceptance = computeAcceptance(previous.acceptance, evidence.canonicalTodos);
  const findings = previous.unresolvedFindings ?? [];

  return {
    stage,
    currentHarnessStep: currentStep,
    acceptance,
    unresolvedFindings: findings,
  };
}

function computeStage(prev: WorkProjection, evidence: WorkRuntimeEvidence): WorkStage {
  if (evidence.pendingApproval) return "waiting_user";
  if (evidence.startupError) return "failed";

  const harnessTodos = evidence.canonicalTodos
    .map((todo) => ({ ...classifyTodo(todo), todo }))
    .filter((item) => item.kind === "harness")
    .sort((a, b) => {
      if (a.todo.status === "in_progress") return -1;
      if (b.todo.status === "in_progress") return 1;
      return 0;
    });

  const inProgress = harnessTodos.find((item) => item.todo.status === "in_progress");
  if (inProgress && inProgress.harnessStep) {
    return harnessStepToWorkStage(inProgress.harnessStep);
  }

  if (evidence.goalStatus === "complete") {
    const allDone = prev.acceptance.every((item) => item.status === "done");
    if (allDone) return "completed";
  }

  return prev.stage;
}

function computeCurrentHarnessStep(evidence: WorkRuntimeEvidence, previous: HarnessStep): HarnessStep {
  const harnessTodos = evidence.canonicalTodos
    .map((todo) => ({ ...classifyTodo(todo), todo }))
    .filter((item) => item.kind === "harness");

  const inProgress = harnessTodos.find((item) => item.todo.status === "in_progress");
  if (inProgress && inProgress.harnessStep) return inProgress.harnessStep;

  const pending = harnessTodos.find((item) => item.todo.status === "pending");
  if (pending && pending.harnessStep) return pending.harnessStep;

  return previous;
}

function computeAcceptance(current: AcceptanceItem[], todos: { text: string; status: string }[]): AcceptanceItem[] {
  if (current.length === 0 || todos.length === 0) return current;
  return current.map((item) => {
    const matchingTodo = todos.find((todo) => {
      const accId = parseAcceptanceTodo(todo.text);
      return accId === item.id;
    });
    if (matchingTodo && matchingTodo.status === "completed") {
      return { ...item, status: "done" };
    }
    return item;
  });
}
