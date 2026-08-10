import type { CoworkProjectSummary } from "../../lib/northwingCowork";
import type { WorkStage } from "../../lib/northwingWorkSpec";
import { northwingWorkspaceIdentity } from "../../lib/northwingWorkspaceIdentity";

export type NorthwingWorkSummary = {
  workId: string;
  projectId: string;
  projectName: string;
  workspace: string;
  title: string;
  stage: WorkStage;
  quality: string;
  sourcePolicy: string;
  completedCriteria: number;
  totalCriteria: number;
  sessionKind: "work";
  bindingStatus: string;
  updatedAt: string;
};

export type NorthwingArtifactSummary = {
  id: string;
  path: string;
  kind: string;
  workId: string;
  version: number;
  final: boolean;
  projectId: string;
  projectName: string;
  workspace: string;
  createdAt: string;
};

export type NorthwingProjectSummary = CoworkProjectSummary;

export type NorthwingCatalog = {
  projects: NorthwingProjectSummary[];
  works: NorthwingWorkSummary[];
  activeWorks: NorthwingWorkSummary[];
  waitingForUser: NorthwingWorkSummary[];
  recentArtifacts: NorthwingArtifactSummary[];
};

function normalizeWorkSummary(raw: unknown): NorthwingWorkSummary {
  const item = raw as Record<string, unknown>;
  return {
    workId: String(item.workId ?? item.id ?? ""),
    projectId: String(item.projectId ?? ""),
    projectName: String(item.projectName ?? ""),
    workspace: String(item.workspace ?? ""),
    title: String(item.title ?? "Untitled work"),
    stage: String(item.stage ?? "intake") as WorkStage,
    quality: String(item.quality ?? "standard"),
    sourcePolicy: String(item.sourcePolicy ?? "project_only"),
    completedCriteria: Number(item.completedCriteria ?? 0),
    totalCriteria: Number(item.totalCriteria ?? 0),
    sessionKind: "work",
    bindingStatus: String(item.bindingStatus ?? ""),
    updatedAt: String(item.updatedAt ?? ""),
  };
}

function normalizeArtifactSummary(raw: unknown): NorthwingArtifactSummary {
  const item = raw as Record<string, unknown>;
  return {
    id: String(item.id ?? ""),
    path: String(item.path ?? ""),
    kind: String(item.kind ?? "file"),
    workId: String(item.workId ?? ""),
    version: Number(item.version ?? 1),
    final: Boolean(item.final ?? false),
    projectId: String(item.projectId ?? ""),
    projectName: String(item.projectName ?? ""),
    workspace: String(item.workspace ?? ""),
    createdAt: String(item.createdAt ?? ""),
  };
}

function normalizeProjectSummary(raw: unknown): NorthwingProjectSummary {
  const item = (raw ?? {}) as NorthwingProjectSummary;
  const workCount = Number(item.workCount ?? 0);
  const artifactCount = Number(item.artifactCount ?? 0);
  return {
    ...item,
    workspace: String(item.workspace ?? ""),
    exists: Boolean(item.exists ?? false),
    workCount: Number.isFinite(workCount) ? workCount : 0,
    artifactCount: Number.isFinite(artifactCount) ? artifactCount : 0,
  };
}

function deduplicateProjects(projects: NorthwingProjectSummary[]): NorthwingProjectSummary[] {
  const unique = new Map<string, NorthwingProjectSummary>();
  for (const project of projects) {
    const key = northwingWorkspaceIdentity(project.workspace ?? "") || project.id || "";
    if (!unique.has(key)) unique.set(key, project);
  }
  return [...unique.values()];
}

function workIdentity(work: NorthwingWorkSummary): string {
  return work.workId || `${work.workspace}\u0000${work.title}\u0000${work.updatedAt}`;
}

function deduplicateAndSortWorks(works: NorthwingWorkSummary[]): NorthwingWorkSummary[] {
  const unique = new Map<string, NorthwingWorkSummary>();
  for (const work of works) {
    const key = workIdentity(work);
    if (!unique.has(key)) unique.set(key, work);
  }
  return [...unique.values()].sort((a, b) => {
    const updated = b.updatedAt.localeCompare(a.updatedAt);
    if (updated !== 0) return updated;
    const project = a.projectId.localeCompare(b.projectId);
    if (project !== 0) return project;
    return a.workId.localeCompare(b.workId);
  });
}

function isActiveWork(work: NorthwingWorkSummary): boolean {
  return work.stage !== "waiting_user" && work.stage !== "completed" && work.stage !== "failed";
}

export function normalizeNorthwingCatalog(raw: unknown): NorthwingCatalog {
  const catalog = (raw ?? {}) as Record<string, unknown>;
  const legacyActive = Array.isArray(catalog.activeWorks)
    ? catalog.activeWorks.map(normalizeWorkSummary)
    : [];
  const legacyWaiting = Array.isArray(catalog.waitingForUser)
    ? catalog.waitingForUser.map(normalizeWorkSummary)
    : [];
  const works = deduplicateAndSortWorks(
    Array.isArray(catalog.works)
      ? catalog.works.map(normalizeWorkSummary)
      : [...legacyActive, ...legacyWaiting],
  );
  return {
    projects: Array.isArray(catalog.projects)
      ? deduplicateProjects(catalog.projects.map(normalizeProjectSummary))
      : [],
    works,
    activeWorks: works.filter(isActiveWork),
    waitingForUser: works.filter((work) => work.stage === "waiting_user"),
    recentArtifacts: Array.isArray(catalog.recentArtifacts)
      ? catalog.recentArtifacts.map(normalizeArtifactSummary)
      : [],
  };
}
