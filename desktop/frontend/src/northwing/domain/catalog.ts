import type { CoworkProjectSummary } from "../../lib/northwingCowork";
import type { WorkStage } from "../../lib/northwingWorkSpec";

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
  return (raw ?? {}) as NorthwingProjectSummary;
}

export function normalizeNorthwingCatalog(raw: unknown): NorthwingCatalog {
  const catalog = (raw ?? {}) as Record<string, unknown>;
  return {
    projects: Array.isArray(catalog.projects)
      ? catalog.projects.map(normalizeProjectSummary)
      : [],
    activeWorks: Array.isArray(catalog.activeWorks)
      ? catalog.activeWorks.map(normalizeWorkSummary)
      : [],
    waitingForUser: Array.isArray(catalog.waitingForUser)
      ? catalog.waitingForUser.map(normalizeWorkSummary)
      : [],
    recentArtifacts: Array.isArray(catalog.recentArtifacts)
      ? catalog.recentArtifacts.map(normalizeArtifactSummary)
      : [],
  };
}
