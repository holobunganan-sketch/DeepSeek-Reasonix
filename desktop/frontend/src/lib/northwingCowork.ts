import { app } from "./bridge";
import { workbenchTargetToken } from "./goalSubmit";
import type { FilePreview, TabMeta } from "./types";
import type { NorthwingCatalog } from "../northwing/domain/catalog";
import { normalizeNorthwingCatalog } from "../northwing/domain/catalog";
import { sameNorthwingWorkspace } from "./northwingWorkspaceIdentity";
import {
  compileWorkBrief,
  harnessStepsForQuality,
  initialWorkStageForQuality,
  NORTHWING_HARNESS_VERSION,
  normalizeWorkSpec,
  workOutputDir,
  type WorkSpecDraft,
} from "./northwingWorkSpec";

export { compileWorkBrief } from "./northwingWorkSpec";

export type CoworkWorkRef = {
  id: string;
  title: string;
  sessionPath?: string;
  goalId?: string;
  profile: "economy" | "balanced" | "delivery" | string;
  kind?: string;
  quality?: string;
  sourcePolicy?: string;
  modelRef?: string;
  reasoningEffort?: string;
  harnessVersion?: number;
  stage?: string;
  harnessSteps?: string[];
  currentHarnessStep?: string;
  materials?: string[];
  expectedArtifact?: string;
  audience?: string;
  constraints?: string[];
  pausePolicy?: string;
  acceptance?: { id: string; text: string; status: string; evidence?: string }[];
  unresolvedFindings?: string[];
  completedCriteria?: number;
  totalCriteria?: number;
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

export type CoworkProjectSummary = {
  workspace: string;
  exists: boolean;
  id?: string;
  name?: string;
  updatedAt?: string;
  workCount: number;
  artifactCount: number;
  works?: CoworkWorkRef[];
  latestWork?: CoworkWorkRef;
  latestArtifact?: CoworkArtifact;
  error?: string;
};

export type CoworkProjectState = {
  exists: boolean;
  project?: CoworkProject;
  finalArtifacts?: Record<string, string>;
  error?: string;
};

export type CoworkWorkDraft = WorkSpecDraft;

export type CoworkWorkProjectionUpdate = {
  stage: string;
  currentHarnessStep?: string;
  acceptance?: { id: string; text: string; status: string; evidence?: string }[];
  unresolvedFindings?: string[];
  completedCriteria: number;
  totalCriteria: number;
};

type CoworkBindings = {
  CreateCoworkProject?: (workspaceRoot: string, name: string) => Promise<CoworkProject>;
  ValidateCoworkProjectWritable?: (workspaceRoot: string) => Promise<void>;
  CoworkProjectState?: (workspaceRoot: string, syncArtifacts: boolean) => Promise<CoworkProjectState>;
  CoworkProjectSummaries?: (workspaceRoots: string[]) => Promise<CoworkProjectSummary[]>;
  NorthwingCatalog?: (workspaceRoots: string[]) => Promise<NorthwingCatalog>;
  UpsertCoworkWork?: (workspaceRoot: string, work: CoworkWorkRef) => Promise<CoworkProject>;
 UpdateCoworkWorkProgress?: (workspaceRoot: string, workID: string, stage: string, completedCriteria: number, totalCriteria: number) => Promise<CoworkProject>;
  UpdateCoworkWorkProjection?: (workspaceRoot: string, workID: string, projection: CoworkWorkProjectionUpdate) => Promise<CoworkProject>;
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

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export async function upsertCoworkWork(workspaceRoot: string, work: CoworkWorkRef): Promise<CoworkProject> {
  return requiredBinding("UpsertCoworkWork")(workspaceRoot, work);
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
  return workOutputDir(workID);
}

export function buildCoworkWorkBrief(workID: string, draft: CoworkWorkDraft): string {
  return compileWorkBrief(workID, normalizeWorkSpec(draft));
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
  const existing = tabs.find((tab) => tab.scope === "project" && sameNorthwingWorkspace(tab.workspaceRoot ?? "", workspaceRoot) && !tab.readOnly);
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

async function ensureCoworkProject(workspaceRoot: string): Promise<CoworkProject> {
  const state = await readCoworkProjectState(workspaceRoot, false);
  if (state.error) throw new Error(`Northwing could not read the Project manifest: ${state.error}`);
  if (state.exists && state.project) return state.project;
  return createCoworkProject(workspaceRoot, basename(workspaceRoot));
}

async function prepareCoworkProject(workspaceInput: string): Promise<{ workspaceRoot: string; project: CoworkProject }> {
  const requestedRoot = workspaceInput.trim();
  if (!requestedRoot) throw new Error("Select a project folder.");

  let workspaceRoot: string;
  try {
    workspaceRoot = (await app.SwitchWorkspace(requestedRoot)).trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Northwing could not open the workspace: ${message}`);
  }
  if (!workspaceRoot) throw new Error("Northwing could not open the workspace.");

  const project = await ensureCoworkProject(workspaceRoot);
  await requiredBinding("ValidateCoworkProjectWritable")(workspaceRoot);
  return { workspaceRoot, project };
}

async function resolveLaunchModel(requestedRef: string): Promise<string> {
  const models = await app.Models();
  if (models.length === 0) {
    throw new Error("No usable model configured. Open Settings → Models and configure a provider before starting Work.");
  }
  const requested = requestedRef.trim();
  if (requested) {
    if (!models.some((model) => model.ref === requested)) {
      throw new Error(`The selected model is unavailable: ${requested}. Open Settings → Models to choose a configured model.`);
    }
    return requested;
  }
  return models.find((model) => model.current)?.ref ?? models[0].ref;
}

async function validateLaunchEffort(reasoningEffort: string): Promise<void> {
  const requested = reasoningEffort.trim();
  if (!requested) return;
  const effort = await app.Effort();
  if (!effort.supported || (effort.levels.length > 0 && !effort.levels.includes(requested))) {
    throw new Error(`The selected reasoning effort is unavailable: ${requested}.`);
  }
}

async function applyWorkBinding(
  tab: TabMeta,
  binding: Pick<CoworkWorkRef, "modelRef" | "reasoningEffort">,
): Promise<void> {
  const modelRef = binding.modelRef?.trim() ?? "";
  if (modelRef) {
    try {
      await app.SetModelForTab(tab.id, modelRef);
    } catch {
      throw new Error(`The model saved for this Work is unavailable: ${modelRef}. Select a replacement in Northwing model settings.`);
    }
  }
  const effort = binding.reasoningEffort?.trim() ?? "";
  if (effort) {
    try {
      await app.SetEffortForTab(tab.id, effort);
    } catch {
      throw new Error(`The reasoning effort saved for this Work is unavailable: ${effort}.`);
    }
  }
}

export async function readCoworkProjectState(workspaceRoot: string, syncArtifacts = true): Promise<CoworkProjectState> {
  return requiredBinding("CoworkProjectState")(workspaceRoot, syncArtifacts);
}

export async function readCoworkProjectSummaries(workspaceRoots: string[]): Promise<CoworkProjectSummary[]> {
  const method = coworkApp.CoworkProjectSummaries;
  if (typeof method !== "function") return [];
  return method(workspaceRoots);
}

export async function readNorthwingCatalog(workspaceRoots: string[]): Promise<NorthwingCatalog> {
  return normalizeNorthwingCatalog(await requiredBinding("NorthwingCatalog")(workspaceRoots));
}

export async function createCoworkProject(workspaceRoot: string, name: string): Promise<CoworkProject> {
  return requiredBinding("CreateCoworkProject")(workspaceRoot, name);
}

export async function launchCoworkWork(
  workspaceRoot: string,
  draft: CoworkWorkDraft,
): Promise<{ workspaceRoot: string; project: CoworkProject; work: CoworkWorkRef; tab: TabMeta }> {
  if (!draft.objective.trim()) throw new Error("Describe what you want to finish.");
  const prepared = await prepareCoworkProject(workspaceRoot);
  workspaceRoot = prepared.workspaceRoot;
  let project = prepared.project;

  const normalized = normalizeWorkSpec(draft);
  const spec = { ...normalized, modelRef: await resolveLaunchModel(normalized.modelRef) };
  await validateLaunchEffort(spec.reasoningEffort);
  const workID = createCoworkWorkID();
  const brief = compileWorkBrief(workID, spec);

  await localTargetToken();
  const tab = await app.EnsureWorkTab(workspaceRoot, workID);

  const work: CoworkWorkRef = {
    id: workID,
    title: spec.title,
    sessionPath: await sessionPathForTab(tab),
    // Reasonix exposes a durable topic anchor rather than a separate Goal ID.
    goalId: tab.topicId || "",
    profile: "delivery",
    kind: spec.kind,
    quality: spec.quality,
    sourcePolicy: spec.sourcePolicy,
    modelRef: spec.modelRef,
    reasoningEffort: spec.reasoningEffort,
    harnessVersion: NORTHWING_HARNESS_VERSION,
    stage: initialWorkStageForQuality(spec.quality),
    harnessSteps: harnessStepsForQuality(spec.quality),
    currentHarnessStep: harnessStepsForQuality(spec.quality)[0],
    materials: spec.materials,
    expectedArtifact: spec.deliverable,
    audience: spec.audience,
    constraints: spec.constraints,
    pausePolicy: spec.pausePolicy,
    acceptance: spec.acceptanceCriteria.map((text, index) => ({
      id: `acc-${index + 1}`,
      text,
      status: "pending",
    })),
    completedCriteria: 0,
    totalCriteria: spec.acceptanceCriteria.length,
  };
  project = await requiredBinding("UpsertCoworkWork")(workspaceRoot, work);

  // Once the native session exists, immediately make its source Work
  // discoverable before any later binding or provider request can fail.
  if (tab.topicId) await app.RenameTopic(tab.topicId, spec.title);
  await app.SetModelForTab(tab.id, spec.modelRef);
  if (spec.reasoningEffort) await app.SetEffortForTab(tab.id, spec.reasoningEffort);
  await app.SetTokenModeForTab(tab.id, "delivery");

  // The native Work link, model binding, and Harness policy are durable before
  // the first provider request. Reasonix remains the sole execution runtime.
  await submitGoal(tab, spec.objective, brief, spec.title);

  const linked: CoworkWorkRef = {
    ...work,
    sessionPath: await sessionPathForTab(tab),
    goalId: tab.topicId || work.goalId,
  };
  project = await requiredBinding("UpsertCoworkWork")(workspaceRoot, linked);
  return { workspaceRoot, project, work: linked, tab };
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
  await applyWorkBinding(tab, work);
  await app.SetTokenModeForTab(tab.id, "delivery");
  await app.SetActiveTab(tab.id);
  return tab;
}

export async function continueCoworkWork(workspaceRoot: string, work: CoworkWorkRef): Promise<TabMeta> {
  const tab = await openCoworkWork(workspaceRoot, work);
  const resumed = await app.ResumeGoalForTab(tab.id);
  if (!resumed) {
    const input = [
      `Continue the Work “${work.title}” from the restored Reasonix project session.`,
      `Inspect the existing conversation, project files, saved policy, and \`${coworkWorkOutputDir(work.id)}/\`.`,
      "Complete unresolved acceptance items, run the required review and validation stages, and keep formal outputs in that deliverables directory.",
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

export async function updateCoworkWorkProgress(
  workspaceRoot: string,
  workID: string,
  stage: string,
  completedCriteria: number,
  totalCriteria: number,
): Promise<CoworkProject> {
  return requiredBinding("UpdateCoworkWorkProgress")(workspaceRoot, workID, stage, completedCriteria, totalCriteria);
}

export async function updateCoworkWorkProjection(
  workspaceRoot: string,
  workID: string,
  projection: CoworkWorkProjectionUpdate,
): Promise<CoworkProject> {
  return requiredBinding("UpdateCoworkWorkProjection")(workspaceRoot, workID, projection);
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
    "Preserve correct existing content, make the smallest sufficient change, review the result, and validate the revised file after the latest mutation.",
    `Keep the formal output under \`${artifact.workId ? coworkWorkOutputDir(artifact.workId) : "deliverables"}/\` so Northwing can register the next version automatically.`,
  ].join("\n\n");
  await submitGoal(tab, `Revise ${artifact.path}`, input, `Revise ${artifact.path}`);
  return tab;
}
