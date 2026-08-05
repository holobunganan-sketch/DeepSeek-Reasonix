export const WORK_KINDS = [
  "general",
  "research",
  "report",
  "presentation",
  "analysis",
  "review",
  "batch",
] as const;

export const WORK_QUALITIES = ["quick", "standard", "deep"] as const;
export const SOURCE_POLICIES = ["project_only", "project_plus_web", "verified_web"] as const;
export const NORTHWING_HARNESS_VERSION = 2;

export type WorkKind = typeof WORK_KINDS[number];
export type WorkQuality = typeof WORK_QUALITIES[number];
export type SourcePolicy = typeof SOURCE_POLICIES[number];
export type WorkStage =
  | "inspect"
  | "inventory"
  | "evidence_ledger"
  | "plan"
  | "produce"
  | "review"
  | "independent_review"
  | "repair"
  | "validate"
  | "requirement_audit";

export type WorkSpecDraft = {
  title?: string;
  objective: string;
  materials?: string[];
  kind?: WorkKind;
  quality?: WorkQuality;
  sourcePolicy?: SourcePolicy;
  audience?: string;
  deliverable?: string;
  constraints?: string;
  completionCriteria?: string;
  pausePolicy?: string;
  modelRef?: string;
  reasoningEffort?: string;
};

export type NormalizedWorkSpec = {
  title: string;
  objective: string;
  materials: string[];
  kind: WorkKind;
  quality: WorkQuality;
  sourcePolicy: SourcePolicy;
  audience: string;
  deliverable: string;
  constraints: string[];
  acceptanceCriteria: string[];
  pausePolicy: string;
  modelRef: string;
  reasoningEffort: string;
  stages: WorkStage[];
  harnessVersion: number;
};

const WORK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

const DEFAULT_DELIVERABLE: Record<WorkKind, string> = {
  general: "A polished, directly usable deliverable in the format requested by the goal.",
  research: "A source-backed research brief with claim-level evidence, uncertainties, and a concise conclusion.",
  report: "An editable DOCX report with a coherent section structure and a concise executive summary.",
  presentation: "An editable PPTX presentation with a clear slide narrative, readable layouts, and speaker-ready content.",
  analysis: "An editable XLSX workbook with checked formulas, reproducible calculations, and a concise interpretation summary.",
  review: "A revised version of the supplied material plus a concise record of important findings and resolved changes.",
  batch: "A deterministic output for every input item plus a manifest of completed, skipped, and failed items.",
};

const KIND_ACCEPTANCE: Record<WorkKind, string[]> = {
  general: ["The output directly satisfies the stated goal and is ready for practical use."],
  research: [
    "Material claims are traceable to sources or marked as uncertain.",
    "Contradictory evidence and important limitations are disclosed.",
  ],
  report: [
    "The DOCX opens in a standard Office application and contains the required sections.",
    "Facts, figures, citations, headings, and tables are checked after the latest revision.",
  ],
  presentation: [
    "The PPTX opens in a standard Office application and every required slide is present.",
    "The slide sequence communicates one coherent narrative with legible text and uncluttered layouts.",
  ],
  analysis: [
    "The XLSX opens in a standard spreadsheet application and required sheets are present.",
    "Formulas, totals, units, filters, and interpretation statements are checked after the latest revision.",
  ],
  review: [
    "Valid existing content is preserved unless the requested change requires replacement.",
    "Every high-priority finding is resolved or explicitly documented as unresolved.",
  ],
  batch: [
    "Every input item has a deterministic result recorded in the batch manifest.",
    "Failures include a specific reason and do not silently remove successful outputs.",
  ],
};

const QUALITY_STAGES: Record<WorkQuality, WorkStage[]> = {
  quick: ["inspect", "produce", "validate"],
  standard: ["inventory", "plan", "produce", "review", "repair", "validate"],
  deep: [
    "inventory",
    "evidence_ledger",
    "plan",
    "produce",
    "review",
    "independent_review",
    "repair",
    "validate",
    "requirement_audit",
  ],
};

const SOURCE_POLICY_TEXT: Record<SourcePolicy, string> = {
  project_only: "Only use the supplied project materials. Do not introduce unsupported external facts.",
  project_plus_web: "Use project materials as the primary evidence. Use web research only to fill material gaps and cite each external source.",
  verified_web: "Verify material claims against current authoritative web sources and provide traceable citations for externally verifiable facts.",
};

const QUALITY_LABEL: Record<WorkQuality, string> = {
  quick: "Quick",
  standard: "Standard",
  deep: "Deep",
};

const SOURCE_LABEL: Record<SourcePolicy, string> = {
  project_only: "project materials only",
  project_plus_web: "project materials with web supplementation",
  verified_web: "verified web evidence",
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanLines(value: string | undefined): string[] {
  return String(value ?? "")
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanMaterials(values: string[] | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of values ?? []) {
    const value = clean(item).replace(/^@/, "");
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function fallbackTitle(objective: string): string {
  const firstLine = objective.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "Untitled work";
  return firstLine.length > 72 ? `${firstLine.slice(0, 69).trimEnd()}…` : firstLine;
}

function validKind(value: unknown): WorkKind {
  const normalized = clean(value).toLowerCase();
  return (WORK_KINDS as readonly string[]).includes(normalized) ? normalized as WorkKind : "general";
}

function validQuality(value: unknown): WorkQuality {
  const normalized = clean(value).toLowerCase();
  return (WORK_QUALITIES as readonly string[]).includes(normalized) ? normalized as WorkQuality : "standard";
}

function validSourcePolicy(value: unknown): SourcePolicy {
  const normalized = clean(value).toLowerCase();
  return (SOURCE_POLICIES as readonly string[]).includes(normalized) ? normalized as SourcePolicy : "project_only";
}

export function workOutputDir(workID: string): string {
  const normalized = clean(workID);
  if (!WORK_ID_PATTERN.test(normalized)) throw new Error(`Invalid Northwing Work ID: ${workID}`);
  return `deliverables/${normalized}`;
}

export function normalizeWorkSpec(draft: WorkSpecDraft): NormalizedWorkSpec {
  const objective = clean(draft.objective);
  if (!objective) throw new Error("A Work goal is required.");
  const kind = validKind(draft.kind);
  const quality = validQuality(draft.quality);
  const sourcePolicy = validSourcePolicy(draft.sourcePolicy);
  const userCriteria = cleanLines(draft.completionCriteria);
  const acceptanceCriteria = [
    "Every formal deliverable opens correctly in a standard application.",
    "The latest version satisfies the goal, constraints, and source policy.",
    ...KIND_ACCEPTANCE[kind],
    ...userCriteria,
  ].filter((item, index, items) => items.indexOf(item) === index);

  return {
    title: clean(draft.title) || fallbackTitle(objective),
    objective,
    materials: cleanMaterials(draft.materials),
    kind,
    quality,
    sourcePolicy,
    audience: clean(draft.audience) || "the intended end user named or implied by the goal",
    deliverable: clean(draft.deliverable) || DEFAULT_DELIVERABLE[kind],
    constraints: cleanLines(draft.constraints),
    acceptanceCriteria,
    pausePolicy: clean(draft.pausePolicy)
      || "Continue until the Work is complete. Pause only for an irreversible or externally visible action, a scope change, credentials, paid services, or information only the user can provide.",
    modelRef: clean(draft.modelRef),
    reasoningEffort: clean(draft.reasoningEffort),
    stages: [...QUALITY_STAGES[quality]],
    harnessVersion: NORTHWING_HARNESS_VERSION,
  };
}

function stageContract(spec: NormalizedWorkSpec): string[] {
  const lines = spec.stages.map((stage, index) => `${index + 1}. ${stage.replaceAll("_", " ")}`);
  const policy: string[] = [
    `Follow this ordered Harness sequence:\n${lines.join("\n")}`,
    "Create a concrete acceptance list with todo_write before making formal deliverables.",
    "Keep intermediate evidence and working files outside the formal deliverables directory.",
    "After the latest content change, run deterministic file validation and inspect the rendered or structural result where supported.",
    "Use complete_step only after every acceptance item has evidence and no unresolved high-priority finding remains.",
  ];
  if (spec.quality === "standard") {
    policy.push("Perform a structured self-review, record specific findings, and complete a targeted repair pass before final validation.");
  }
  if (spec.quality === "deep") {
    policy.push("Build an evidence ledger before drafting and keep claims linked to source material.");
    policy.push("Use an isolated reviewer, review Skill, or read-only subagent when available; keep review findings separate from the drafting pass.");
    policy.push("Finish with a requirement-by-requirement audit against the acceptance criteria and repair every unresolved item before sign-off.");
  }
  if (spec.quality === "quick") {
    policy.push("Keep the path bounded: inspect the relevant material, produce the requested output, and validate it without adding optional scope.");
  }
  return policy;
}

export function compileWorkBrief(workID: string, input: WorkSpecDraft | NormalizedWorkSpec): string {
  const spec = "acceptanceCriteria" in input ? input : normalizeWorkSpec(input);
  const outputDir = workOutputDir(workID);
  const sections = [
    "# Northwing Work Contract",
    `\n## Work\n${spec.title}`,
    `\n## Context\nAudience: ${spec.audience}`,
    `\n## Request\n${spec.objective}`,
  ];
  if (spec.materials.length > 0) {
    sections.push(`\n## Materials\n${spec.materials.map((path) => `- @${path}`).join("\n")}`);
  }
  sections.push(`\n## Output format\n${spec.deliverable}`);
  sections.push(`\n## Source policy\n${SOURCE_POLICY_TEXT[spec.sourcePolicy]}`);
  if (spec.constraints.length > 0) {
    sections.push(`\n## Constraints\n${spec.constraints.map((item) => `- ${item}`).join("\n")}`);
  }
  sections.push(`\n## Acceptance criteria\n${spec.acceptanceCriteria.map((item) => `- ${item}`).join("\n")}`);
  sections.push(`\n## Pause policy\n${spec.pausePolicy}`);
  sections.push([
    "\n## Harness execution contract",
    `Work type: ${spec.kind}`,
    `Quality policy: ${spec.quality}`,
    `Harness version: ${spec.harnessVersion}`,
    `Formal output directory: \`${outputDir}/\``,
    ...stageContract(spec).map((item) => `- ${item}`),
    "- Use the existing Reasonix Goal, Delivery, permission, checkpoint, recovery, Skill, MCP, and subagent systems. Do not create a second workflow state machine.",
    "- Do not report completion until the formal files exist, the latest revision has been validated, and the acceptance list is signed off.",
  ].join("\n"));
  return sections.join("\n");
}

export function workSpecSummary(input: WorkSpecDraft | NormalizedWorkSpec): string[] {
  const spec = "acceptanceCriteria" in input ? input : normalizeWorkSpec(input);
  const model = spec.modelRef ? `Model: ${spec.modelRef}` : "Model: current/default Reasonix model";
  return [
    `${QUALITY_LABEL[spec.quality]} quality · ${spec.kind}`,
    `Evidence: ${SOURCE_LABEL[spec.sourcePolicy]}`,
    model,
    `Deliverable: ${spec.deliverable}`,
    `Stages: ${spec.stages.map((stage) => stage.replaceAll("_", " ")).join(" → ")}`,
  ];
}
