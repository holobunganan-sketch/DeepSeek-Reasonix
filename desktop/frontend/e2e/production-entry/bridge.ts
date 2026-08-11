import { app as browserFallback } from "../../src/lib/bridge";
import type { NorthwingCatalog, NorthwingArtifactSummary, NorthwingWorkSummary } from "../../src/northwing/domain/catalog";
import type { CoworkArtifact, CoworkProject, CoworkProjectState, CoworkWorkRef } from "../../src/lib/northwingCowork";
import type { AppBindings } from "../../src/lib/bridge";
import type { TabMeta } from "../../src/lib/types";

const PRIMARY_WORKSPACE = "C:\\Northwing E2E\\项目 A";
const PICKED_WORKSPACE = "C:\\Northwing E2E\\新项目 空格";
const STORAGE_KEY = "northwing-production-e2e-state-v1";
const now = "2026-08-11T08:00:00.000Z";

type PersistedState = {
  projects: Array<{ id: string; name: string; workspace: string; updatedAt: string }>;
  works: NorthwingWorkSummary[];
};

type E2EControl = {
  calls: Record<string, unknown[][]>;
  getCalls: (name: string) => unknown[][];
  resetCalls: () => void;
  setCatalog: (catalog: Partial<NorthwingCatalog>) => void;
  setNoModels: (value: boolean) => void;
  setCatalogError: (message: string) => void;
  setSubmitError: (message: string) => void;
  primaryWorkspace: string;
  pickedWorkspace: string;
};

const activeWork: NorthwingWorkSummary = {
  workId: "work-active",
  projectId: "project-e2e",
  projectName: "E2E Test Project",
  workspace: PRIMARY_WORKSPACE,
  title: "Test Work: Analysis Report",
  stage: "producing",
  quality: "standard",
  sourcePolicy: "project_plus_web",
  completedCriteria: 3,
  totalCriteria: 8,
  sessionKind: "work",
  bindingStatus: "bound",
  updatedAt: now,
};

const waitingWork: NorthwingWorkSummary = {
  ...activeWork,
  workId: "work-waiting",
  title: "Pending approval: Literature Review",
  stage: "waiting_user",
  completedCriteria: 5,
  totalCriteria: 10,
  updatedAt: "2026-08-11T07:00:00.000Z",
};

const completedWork: NorthwingWorkSummary = {
  ...activeWork,
  workId: "work-completed",
  title: "Completed market brief",
  stage: "completed",
  completedCriteria: 4,
  totalCriteria: 4,
  updatedAt: "2026-08-10T07:00:00.000Z",
};

const failedWork: NorthwingWorkSummary = {
  ...activeWork,
  workId: "work-failed",
  title: "Failed data import",
  stage: "failed",
  completedCriteria: 1,
  totalCriteria: 3,
  updatedAt: "2026-08-09T07:00:00.000Z",
};

const artifact: NorthwingArtifactSummary = {
  id: "artifact-draft",
  path: "deliverables/work-active/report.txt",
  kind: "txt",
  workId: activeWork.workId,
  version: 2,
  final: false,
  projectId: activeWork.projectId,
  projectName: activeWork.projectName,
  workspace: PRIMARY_WORKSPACE,
  createdAt: now,
};

function initialPersistedState(): PersistedState {
  const fallback: PersistedState = {
    projects: [{ id: "project-e2e", name: "E2E Test Project", workspace: PRIMARY_WORKSPACE, updatedAt: now }],
    works: [activeWork, waitingWork, completedWork, failedWork],
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as Partial<PersistedState>;
    return {
      projects: [...fallback.projects, ...(saved.projects ?? []).filter((project) => project.workspace !== PRIMARY_WORKSPACE)],
      works: [...fallback.works, ...(saved.works ?? []).filter((work) => !fallback.works.some((candidate) => candidate.workId === work.workId))],
    };
  } catch {
    return fallback;
  }
}

const persisted = initialPersistedState();
let catalog: NorthwingCatalog = {
  projects: persisted.projects,
  works: persisted.works,
  activeWorks: persisted.works.filter((work) => work.stage !== "waiting_user" && work.stage !== "completed" && work.stage !== "failed"),
  waitingForUser: persisted.works.filter((work) => work.stage === "waiting_user"),
  recentArtifacts: [artifact],
};
let noModels = false;
let catalogError = "";
let submitError = "";
let maximised = false;
let activeTabID = "";
let tabSequence = 0;
const calls: Record<string, unknown[][]> = {};
const tabs: TabMeta[] = [];
const projectStates = new Map<string, CoworkProject>();

function record(name: string, args: unknown[]) {
  (calls[name] ??= []).push(args);
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects: catalog.projects, works: catalog.works } satisfies PersistedState));
}

function workRef(summary: NorthwingWorkSummary): CoworkWorkRef {
  return {
    id: summary.workId,
    title: summary.title,
    profile: "delivery",
    kind: "document",
    quality: summary.quality,
    sourcePolicy: summary.sourcePolicy,
    modelRef: "openai/gpt-5.6",
    reasoningEffort: "medium",
    stage: summary.stage,
    harnessSteps: ["inspect", "produce", "review", "validate"],
    currentHarnessStep: summary.stage === "completed" ? "validate" : "produce",
    materials: ["brief.md"],
    expectedArtifact: "report.txt",
    acceptance: Array.from({ length: summary.totalCriteria }, (_, index) => ({
      id: `acc-${index + 1}`,
      text: `Acceptance ${index + 1}`,
      status: index < summary.completedCriteria ? "done" : "pending",
    })),
    completedCriteria: summary.completedCriteria,
    totalCriteria: summary.totalCriteria,
    updatedAt: summary.updatedAt,
  };
}

function coworkArtifact(value: NorthwingArtifactSummary): CoworkArtifact {
  return {
    id: value.id,
    path: value.path,
    kind: value.kind,
    workId: value.workId,
    version: value.version,
    sha256: "a".repeat(64),
    size: 64,
    createdAt: value.createdAt,
  };
}

function ensureProjectState(workspace: string): CoworkProject | undefined {
  const existing = projectStates.get(workspace);
  if (existing) return existing;
  const summary = catalog.projects.find((project) => project.workspace === workspace);
  if (!summary) return undefined;
  const project: CoworkProject = {
    version: 1,
    id: summary.id,
    name: summary.name,
    createdAt: now,
    updatedAt: summary.updatedAt,
    works: catalog.works.filter((work) => work.workspace === workspace).map(workRef),
    artifacts: catalog.recentArtifacts.filter((item) => item.workspace === workspace).map(coworkArtifact),
  };
  projectStates.set(workspace, project);
  return project;
}

function makeTab(workspace: string, workID = "", kind: "work" | "chat" = workID ? "work" : "chat"): TabMeta {
  const id = `e2e-tab-${++tabSequence}`;
  const tab: TabMeta = {
    id,
    scope: workspace ? "project" : "global",
    workspaceRoot: workspace,
    workspaceName: workspace.split(/[/\\]/).filter(Boolean).pop() ?? "Global",
    topicId: `topic-${id}`,
    topicTitle: kind === "work" ? "Northwing Work" : "Quick Chat",
    sessionPath: `sessions/${id}.jsonl`,
    sessionKind: kind,
    workId: workID || undefined,
    label: kind === "work" ? "Northwing Work" : "Quick Chat",
    ready: true,
    running: false,
    mode: "normal",
    active: true,
    cwd: workspace,
  };
  tabs.forEach((candidate) => { candidate.active = false; });
  tabs.push(tab);
  activeTabID = id;
  return tab;
}

function projectState(workspace: string): CoworkProjectState {
  const project = ensureProjectState(workspace);
  return project ? { exists: true, project, finalArtifacts: {} } : { exists: false, finalArtifacts: {} };
}

function fallbackMethod(name: string) {
  return (...args: unknown[]) => {
    const savedGo = window.go;
    window.go = undefined;
    try {
      const method = (browserFallback as unknown as Record<string, unknown>)[name];
      if (typeof method !== "function") return Promise.resolve(undefined);
      return (method as (...values: unknown[]) => unknown)(...args);
    } finally {
      window.go = savedGo;
    }
  };
}

const overrides: Partial<AppBindings> & Record<string, unknown> = {
  Platform: async () => "windows",
  MinimiseMainWindow: async () => { record("MinimiseMainWindow", []); },
  ToggleMaximiseMainWindow: async () => { maximised = !maximised; record("ToggleMaximiseMainWindow", []); },
  IsMainWindowMaximised: async () => maximised,
  CloseMainWindow: async () => { record("CloseMainWindow", []); },
  ListProjectTree: async () => catalog.projects.map((project) => ({
    key: project.id,
    kind: "project" as const,
    label: project.name,
    root: project.workspace,
    children: [],
  })),
  NorthwingCatalog: async (roots: string[]) => {
    record("NorthwingCatalog", [roots]);
    if (catalogError) {
      throw new Error(catalogError);
    }
    return structuredClone(catalog);
  },
  Models: async () => noModels ? [] : [{ ref: "openai/gpt-5.6", provider: "openai", model: "gpt-5.6", current: true }],
  Effort: async () => ({ supported: true, current: "medium", default: "medium", levels: ["low", "medium", "high"] }),
  PickWorkspace: async () => { record("PickWorkspace", []); return PICKED_WORKSPACE; },
  SwitchWorkspace: async (workspace: string) => { record("SwitchWorkspace", [workspace]); return workspace; },
  CoworkProjectState: async (workspace: string, syncArtifacts: boolean) => {
    record("CoworkProjectState", [workspace, syncArtifacts]);
    return structuredClone(projectState(workspace));
  },
  CreateCoworkProject: async (workspace: string, name: string) => {
    record("CreateCoworkProject", [workspace, name]);
    if (ensureProjectState(workspace)) throw new Error("Northwing Project already exists");
    const summary = { id: `project-${catalog.projects.length + 1}`, name, workspace, updatedAt: now };
    catalog = { ...catalog, projects: [...catalog.projects, summary] };
    const project: CoworkProject = { version: 1, id: summary.id, name, createdAt: now, updatedAt: now, works: [], artifacts: [] };
    projectStates.set(workspace, project);
    persist();
    return structuredClone(project);
  },
  ValidateCoworkProjectWritable: async (workspace: string) => { record("ValidateCoworkProjectWritable", [workspace]); },
  EnsureWorkTab: async (workspace: string, workID: string) => {
    record("EnsureWorkTab", [workspace, workID]);
    return tabs.find((tab) => tab.workId === workID) ?? makeTab(workspace, workID, "work");
  },
  EnsureBlankTab: async (_scope: string, workspace: string) => {
    record("EnsureBlankTab", [_scope, workspace]);
    return makeTab(workspace, "", "chat");
  },
  ListTabs: async () => structuredClone(tabs),
  SetActiveTab: async (tabID: string) => {
    record("SetActiveTab", [tabID]);
    activeTabID = tabID;
    tabs.forEach((tab) => { tab.active = tab.id === tabID; });
  },
  MetaForTab: async (tabID: string) => {
    const tab = tabs.find((candidate) => candidate.id === tabID);
    return {
      label: tab?.label ?? "Northwing",
      ready: true,
      eventChannel: "agent:event",
      cwd: tab?.cwd ?? "",
      workspaceRoot: tab?.workspaceRoot,
      sessionPath: tab?.sessionPath,
      collaborationMode: "normal" as const,
      toolApprovalMode: "auto" as const,
      tokenMode: "delivery" as const,
      goalStatus: "running" as const,
      canonicalTodos: [],
    };
  },
  Meta: async () => ({ label: "Northwing", ready: true, eventChannel: "agent:event", cwd: PRIMARY_WORKSPACE }),
  ActiveWorkForTab: async () => ({ running: false, pendingPrompt: false, cancellable: false, jobs: [] }),
  WorkbenchActiveTarget: async () => ({ state: "ready", kind: "local" as const, identityGen: 1, requestSeq: 1 }),
  WorkbenchSwitchLocal: async () => ({ state: "ready", kind: "local" as const, identityGen: 1, requestSeq: 1 }),
  UpsertCoworkWork: async (workspace: string, work: CoworkWorkRef) => {
    record("UpsertCoworkWork", [workspace, work]);
    const project = ensureProjectState(workspace);
    if (!project) throw new Error("Project not found");
    project.works = [...(project.works ?? []).filter((candidate) => candidate.id !== work.id), structuredClone(work)];
    project.updatedAt = now;
    const summary: NorthwingWorkSummary = {
      workId: work.id,
      projectId: project.id,
      projectName: project.name,
      workspace,
      title: work.title,
      stage: work.stage ?? "producing",
      quality: work.quality ?? "standard",
      sourcePolicy: work.sourcePolicy ?? "project_only",
      completedCriteria: work.completedCriteria ?? 0,
      totalCriteria: work.totalCriteria ?? 0,
      sessionKind: "work",
      bindingStatus: "bound",
      updatedAt: now,
    };
    catalog = {
      ...catalog,
      works: [...catalog.works.filter((candidate) => candidate.workId !== work.id), summary],
      activeWorks: [...catalog.activeWorks.filter((candidate) => candidate.workId !== work.id), summary],
    };
    persist();
    return structuredClone(project);
  },
  UpdateCoworkWorkProjection: async (workspace: string, workID: string, projection: Partial<CoworkWorkRef>) => {
    const project = ensureProjectState(workspace);
    if (!project) throw new Error("Project not found");
    project.works = (project.works ?? []).map((work) => work.id === workID ? { ...work, ...projection } : work);
    return structuredClone(project);
  },
  RenameTopic: async (...args: unknown[]) => { record("RenameTopic", args); },
  SetModelForTab: async (...args: unknown[]) => { record("SetModelForTab", args); },
  SetEffortForTab: async (...args: unknown[]) => { record("SetEffortForTab", args); },
  SetTokenModeForTab: async (...args: unknown[]) => { record("SetTokenModeForTab", args); },
  SubmitInitialGoalToTab: async (...args: unknown[]) => {
    record("SubmitInitialGoalToTab", args);
    if (submitError) throw new Error(submitError);
    return [];
  },
  ReadFileForTab: async (tabID: string, path: string) => {
    record("ReadFileForTab", [tabID, path]);
    return { path, body: "Production bridge artifact preview", size: 34, truncated: false, binary: false };
  },
  OpenWorkspacePathForTab: async (...args: unknown[]) => { record("OpenWorkspacePathForTab", args); },
  RevealWorkspacePathForTab: async (...args: unknown[]) => { record("RevealWorkspacePathForTab", args); },
  SetCoworkArtifactFinal: async (workspace: string, artifactID: string) => {
    record("SetCoworkArtifactFinal", [workspace, artifactID]);
    catalog = { ...catalog, recentArtifacts: catalog.recentArtifacts.map((item) => item.id === artifactID ? { ...item, final: true } : item) };
    const project = ensureProjectState(workspace);
    if (project) project.artifacts = (project.artifacts ?? []).map((item) => item.id === artifactID ? { ...item } : item);
    return structuredClone(projectState(workspace));
  },
  HistoryForTab: async () => [
    { role: "user" as const, text: "Turn this exploration into a formal Work", time: Date.now() },
    { role: "assistant" as const, text: "Ready to convert", time: Date.now() },
  ],
  activeTab: async () => activeTabID,
};

const controlledApp = new Proxy(overrides, {
  get(target, property) {
    if (property in target) return Reflect.get(target, property);
    return fallbackMethod(String(property));
  },
}) as AppBindings;

window.go = { main: { App: controlledApp } };
window.runtime = {
  EventsOn: () => () => {},
  BrowserOpenURL: (url: string) => record("BrowserOpenURL", [url]),
  WindowSetSystemDefaultTheme: () => undefined,
  WindowSetLightTheme: () => undefined,
  WindowSetDarkTheme: () => undefined,
  WindowSetBackgroundColour: () => undefined,
  WindowGetSize: async () => ({ w: window.innerWidth, h: window.innerHeight }),
  WindowGetPosition: async () => ({ x: 0, y: 0 }),
  WindowIsMaximised: async () => maximised,
};

(window as unknown as { __NORTHWING_E2E__: E2EControl }).__NORTHWING_E2E__ = {
  calls,
  getCalls: (name) => calls[name] ?? [],
  resetCalls: () => { Object.keys(calls).forEach((name) => delete calls[name]); },
  setCatalog: (next) => { catalog = { ...catalog, ...structuredClone(next) }; },
  setNoModels: (value) => {
    noModels = value;
    window.dispatchEvent(new Event("reasonix:model-catalog-changed"));
  },
  setCatalogError: (message) => { catalogError = message; },
  setSubmitError: (message) => { submitError = message; },
  primaryWorkspace: PRIMARY_WORKSPACE,
  pickedWorkspace: PICKED_WORKSPACE,
};

await import("../../src/main.tsx");
