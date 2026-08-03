import { app } from "./bridge";
import { workbenchTargetToken } from "./goalSubmit";
import type { FilePreview, TabMeta } from "./types";

export type CoworkWorkRef = {
  id: string;
  title: string;
  sessionPath?: string;
  goalId?: string;
  profile: "economy" | "balanced" | "delivery" | string;
  createdAt?: string;
  updatedAt?: string;
};

export type CoworkArtifact = {
  id: string;
  path: string;
  kind: string;
  workId?: string;
  version: number;
  sha256: string;
  size: number;
  createdAt: string;
};

export type CoworkProject = {
  version: number;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  works?: CoworkWorkRef[];
  artifacts?: CoworkArtifact[];
};

export type CoworkProjectState = {
  exists: boolean;
  project?: CoworkProject;
  finalArtifacts?: Record<string, string>;
  error?: string;
};

export type CoworkWorkDraft = {
  title: string;
  objective: string;
  materials: string[];
  deliverable: string;
  constraints: string;
  completionCriteria: string;
};

type CoworkBindings = {
  CreateCoworkProject?: (workspaceRoot: string, name: string) => Promise<CoworkProject>;
  CoworkProjectState?: (workspaceRoot: string, syncArtifacts: boolean) => Promise<CoworkProjectState>;
  UpsertCoworkWork?: (workspaceRoot: string, work: CoworkWorkRef) => Promise<CoworkProject>;
  SyncCoworkArtifacts?: (workspaceRoot: string) => Promise<CoworkProject>;
  SetCoworkArtifactFinal?: (workspaceRoot: string, artifactID: string) => Promise<CoworkProjectState>;
};

export const coworkApp = app as typeof app & CoworkBindings;

function requiredBinding<K extends keyof CoworkBindings>(name: K): NonNullable<CoworkBindings[K]> {
  const method = coworkApp[name];
  if (typeof method !== "function") {
    throw new Error(`Northwing desktop binding ${String(name)} is unavailable; rebuild the Wails desktop app.`);
  }
  return method as NonNullable<CoworkBindings[K]>;
}

export function createCoworkWorkID(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.padEnd(32, "0").slice(0, 32);
}

export function coworkWorkOutputDir(workID: string): string {
  return `deliverables/${workID.trim()}`;
}

function cleanLines(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

export function buildCoworkWorkBrief(workID: string, draft: CoworkWorkDraft): string {
  const title = draft.title.trim() || "Untitled work";
  const objective = draft.objective.trim();
  const materials = cleanLines(draft.materials);
  const deliverable = draft.deliverable.trim() || "A polished, directly usable deliverable in the requested format.";
  const constraints = draft.constraints.trim();
  const completion = draft.completionCriteria.trim() || "The deliverable opens correctly, satisfies the brief, and has been checked before completion is reported.";
  const outputDir = coworkWorkOutputDir(workID);

  const sections = [
    "# Northwing Work Brief",
    `\n## Work\n${title}`,
    `\n## Goal\n${objective}`,
  ];
  if (materials.length > 0) {
    sections.push(`\n## Materials\n${materials.map((path) => `- @${path.replace(/^@/, "")}`).join("\n")}`);
  }
  sections.push(`\n## Deliverable\n${deliverable}`);
  if (constraints) sections.push(`\n## Constraints\n${constraints}`);
  sections.push(`\n## Completion criteria\n${completion}`);
  sections.push([
    "\n## Execution contract",
    "- Continue until the work is complete or a genuine external blocker is reached.",
    "- Follow the current project instructions and use the provided source material as evidence.",
    `- Save formal deliverables under \`${outputDir}/\` and keep temporary working files outside that directory.`,
    "- Use the existing Reasonix Delivery profile, including its planning, review, permission, checkpoint, and verification behavior.",
    "- Do not claim completion until the deliverables exist and the relevant checks have been performed.",
  ].join("\n"));
  return sections.join("\n");
}

async function localTargetToken() {
  let target = await app.WorkbenchActiveTarget();
  if (target.kind !== "local") target = await app.WorkbenchSwitchLocal();
  const token = workbenchTargetToken(target);
  if (!token || token.kind !== "local") throw new Error("Northwing could not establish the local project target.");
  return token;
}

async function projectTab(workspaceRoot: string): Promise<TabMeta> {
  const tabs = await app.ListTabs();
  const existing = tabs.find((tab) => tab.scope === "project" && tab.workspaceRoot === workspaceRoot && !tab.readOnly);
  if (existing) return existing;
  return app.EnsureBlankTab("project", workspaceRoot);
}

async function sessionPathForTab(tab: TabMeta): Promise<string> {
  const meta = await app.MetaForTab(tab.id);
  return meta.sessionPath || tab.sessionPath || "";
}

async function submitGoal(tab: TabMeta, goal: string, input: string, displayText: string): Promise<void> {
  const target = await localTargetToken();
  await app.SubmitInitialGoalToTab(
    tab.id,
    goal,
    displayText,
    input,
    [],
    "goal",
    "auto",
    target.kind,
    target.identityGen,
    target.requestSeq,
  );
  await app.SetActiveTab(tab.id);
}

export async function readCoworkProjectState(workspaceRoot: string, syncArtifacts = true): Promise<CoworkProjectState> {
  return requiredBinding("CoworkProjectState")(workspaceRoot, syncArtifacts);
}

export async function createCoworkProject(workspaceRoot: string, name: string): Promise<CoworkProject> {
  return requiredBinding("CreateCoworkProject")(workspaceRoot, name);
}

export async function launchCoworkWork(workspaceRoot: string, draft: CoworkWorkDraft): Promise<{ project: CoworkProject; work: CoworkWorkRef; tab: TabMeta }> {
  const workID = createCoworkWorkID();
  const title = draft.title.trim() || draft.objective.trim().slice(0, 72) || "Untitled work";
  const objective = draft.objective.trim() || title;
  const brief = buildCoworkWorkBrief(workID, { ...draft, title });

  await localTargetToken();
  const tab = await app.EnsureBlankTab("project", workspaceRoot);
  if (tab.topicId) await app.RenameTopic(tab.topicId, title).catch(() => undefined);
  await app.SetTokenModeForTab(tab.id, "delivery");

  const work: CoworkWorkRef = {
    id: workID,
    title,
    sessionPath: await sessionPathForTab(tab),
    // Reasonix currently exposes a durable topic anchor rather than a separate
    // Goal identifier, so the compatibility field stores that topic ID.
    goalId: tab.topicId || "",
    profile: "delivery",
  };
  const project = await requiredBinding("UpsertCoworkWork")(workspaceRoot, work);

  // The Work link is durable before the first provider request. The compact
  // title is shown in the transcript, the objective remains the Goal state,
  // and the full Work Brief is the actual user input sent to the model.
  await submitGoal(tab, objective, brief, title);
  return { project, work, tab };
}

export async function openCoworkWork(workspaceRoot: string, work: CoworkWorkRef): Promise<TabMeta> {
  await localTargetToken();
  let tab: TabMeta | null = null;
  if (work.goalId) {
    try {
      tab = await app.OpenTopicSession("project", workspaceRoot, work.goalId, work.sessionPath || "");
    } catch {
      tab = null;
    }
  }
  if (!tab) {
    tab = await app.EnsureBlankTab("project", workspaceRoot);
    if (work.sessionPath) await app.ResumeSessionForTab(tab.id, work.sessionPath);
    if (tab.topicId && work.title) await app.RenameTopic(tab.topicId, work.title).catch(() => undefined);
  }
  await app.SetTokenModeForTab(tab.id, "delivery");
  await app.SetActiveTab(tab.id);
  return tab;
}

export async function continueCoworkWork(workspaceRoot: string, work: CoworkWorkRef): Promise<TabMeta> {
  const tab = await openCoworkWork(workspaceRoot, work);
  const resumed = await app.ResumeGoalForTab(tab.id);
  if (!resumed) {
    const input = [
      `Continue the Northwing work “${work.title}” from the restored Reasonix session.`,
      `Inspect the existing conversation, project files, and \`${coworkWorkOutputDir(work.id)}/\`.`,
      "Complete any unresolved requirements, validate the resulting files, and keep formal outputs in that deliverables directory.",
    ].join("\n\n");
    await submitGoal(tab, work.title, input, `Continue ${work.title}`);
  }
  const updated: CoworkWorkRef = {
    ...work,
    sessionPath: await sessionPathForTab(tab),
    goalId: tab.topicId || work.goalId,
    profile: "delivery",
  };
  await requiredBinding("UpsertCoworkWork")(workspaceRoot, updated);
  return tab;
}

export async function syncCoworkArtifacts(workspaceRoot: string): Promise<CoworkProject> {
  return requiredBinding("SyncCoworkArtifacts")(workspaceRoot);
}

export async function setCoworkArtifactFinal(workspaceRoot: string, artifactID: string): Promise<CoworkProjectState> {
  return requiredBinding("SetCoworkArtifactFinal")(workspaceRoot, artifactID);
}

export async function previewCoworkArtifact(workspaceRoot: string, path: string): Promise<FilePreview> {
  const tab = await projectTab(workspaceRoot);
  return app.ReadFileForTab(tab.id, path);
}

export async function openCoworkArtifact(workspaceRoot: string, path: string): Promise<void> {
  const tab = await projectTab(workspaceRoot);
  await app.OpenWorkspacePathForTab(tab.id, path);
}

export async function revealCoworkArtifact(workspaceRoot: string, path: string): Promise<void> {
  const tab = await projectTab(workspaceRoot);
  await app.RevealWorkspacePathForTab(tab.id, path);
}

export async function reviseCoworkArtifact(
  workspaceRoot: string,
  project: CoworkProject,
  artifact: CoworkArtifact,
  instruction: string,
): Promise<TabMeta> {
  await localTargetToken();
  const work = (project.works ?? []).find((candidate) => candidate.id === artifact.workId);
  const tab = work ? await openCoworkWork(workspaceRoot, work) : await app.EnsureBlankTab("project", workspaceRoot);
  await app.SetTokenModeForTab(tab.id, "delivery");
  const input = [
    `Revise @${artifact.path} according to the following instruction:`,
    instruction.trim(),
    "Preserve correct existing content, make the smallest sufficient change, and validate the revised file.",
    `Keep the formal output under \`${artifact.workId ? coworkWorkOutputDir(artifact.workId) : "deliverables"}/\` so Northwing can register the next version automatically.`,
  ].join("\n\n");
  await submitGoal(tab, `Revise ${artifact.path}`, input, `Revise ${artifact.path}`);
  return tab;
}
