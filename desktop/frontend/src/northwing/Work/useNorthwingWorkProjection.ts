import { useState, useEffect, useRef } from "react";
import { app } from "../../lib/bridge";
import type { ActiveWorkView, Meta, TabMeta } from "../../lib/types";
import type { CoworkArtifact, CoworkProject, CoworkProjectState, CoworkWorkRef, CoworkWorkProjectionUpdate } from "../../lib/northwingCowork";
import {
  updateCoworkWorkProjection,
  readCoworkProjectState,
} from "../../lib/northwingCowork";
import {
  projectWork,
  type WorkProjection,
  type WorkRuntimeEvidence,
} from "./NorthwingWorkCoordinator";
import type { HarnessStep, WorkStage } from "../../lib/northwingWorkSpec";

export type WorkProjectionState = WorkProjection & {
  workspaceRoot: string;
  workId: string;
  work: CoworkWorkRef | null;
  artifacts: CoworkArtifact[];
  loading: boolean;
  error?: string;
};

export type NorthwingWorkProjectionGateway = {
  readProjectState: (workspaceRoot: string, syncArtifacts: boolean) => Promise<CoworkProjectState>;
  listTabs: () => Promise<TabMeta[]>;
  metaForTab: (tabID: string) => Promise<Meta>;
  activeWorkForTab: (tabID: string) => Promise<ActiveWorkView>;
  updateProjection: (workspaceRoot: string, workID: string, projection: CoworkWorkProjectionUpdate) => Promise<CoworkProject>;
};

export type LoadedNorthwingWorkProjection = {
  work: CoworkWorkRef;
  artifacts: CoworkArtifact[];
  projection: WorkProjection;
  changed: boolean;
};

function emptyWorkProjection(): WorkProjection {
  return {
    stage: "intake",
    currentHarnessStep: "inventory",
    acceptance: [],
    unresolvedFindings: [],
  };
}

const desktopGateway: NorthwingWorkProjectionGateway = {
  readProjectState: readCoworkProjectState,
  listTabs: () => app.ListTabs(),
  metaForTab: (tabID) => app.MetaForTab(tabID),
  activeWorkForTab: (tabID) => app.ActiveWorkForTab(tabID),
  updateProjection: updateCoworkWorkProjection,
};

function savedWorkProjection(work: CoworkWorkRef): WorkProjection {
  return {
    stage: (work.stage || "intake") as WorkStage,
    currentHarnessStep: (work.currentHarnessStep || "inventory") as HarnessStep,
    acceptance: (work.acceptance ?? []).map((item) => ({ ...item })),
    unresolvedFindings: [...(work.unresolvedFindings ?? [])],
  };
}

async function nativeWorkRuntimeEvidence(
  workspaceRoot: string,
  workId: string,
  gateway: Pick<NorthwingWorkProjectionGateway, "listTabs" | "metaForTab" | "activeWorkForTab">,
): Promise<WorkRuntimeEvidence | undefined> {
  const tabs = await gateway.listTabs();
  const requestedRoot = normalizedWorkspaceRoot(workspaceRoot);
  const tab = tabs.find(
    (candidate) =>
      candidate.sessionKind === "work" &&
      candidate.workId === workId &&
      normalizedWorkspaceRoot(candidate.workspaceRoot) === requestedRoot,
  );
  if (!tab || !tab.ready) return undefined;

  const [meta, activeWork] = await Promise.all([
    gateway.metaForTab(tab.id),
    gateway.activeWorkForTab(tab.id),
  ]);
  return {
    canonicalTodos: meta.canonicalTodos?.map((todo) => ({ text: todo.content, status: todo.status })),
    pendingApproval: activeWork.pendingPrompt,
    startupError: meta.startupErr,
    goalStatus: meta.goalStatus,
    runtimeActive: activeWork.running || activeWork.jobs.length > 0,
  };
}

function normalizedWorkspaceRoot(value: string | undefined): string {
  const raw = (value ?? "").trim();
  const normalized = raw.replace(/\\/g, "/").replace(/\/+$/, "");
  const windowsPath = raw.includes("\\") || /^[a-z]:\//i.test(normalized) || normalized.startsWith("//");
  return windowsPath ? normalized.toLowerCase() : normalized;
}

function sameProjection(left: WorkProjection, right: WorkProjection): boolean {
  return (
    left.stage === right.stage &&
    left.currentHarnessStep === right.currentHarnessStep &&
    JSON.stringify(left.acceptance) === JSON.stringify(right.acceptance) &&
    JSON.stringify(left.unresolvedFindings) === JSON.stringify(right.unresolvedFindings)
  );
}

function projectionUpdate(work: CoworkWorkRef, projection: WorkProjection): CoworkWorkProjectionUpdate {
  const hasAcceptance = projection.acceptance.length > 0;
  return {
    stage: projection.stage,
    currentHarnessStep: projection.currentHarnessStep,
    acceptance: projection.acceptance.map((item) => ({ ...item, evidence: item.evidence ?? "" })),
    unresolvedFindings: projection.unresolvedFindings,
    completedCriteria: hasAcceptance
      ? projection.acceptance.filter((item) => item.status === "done").length
      : (work.completedCriteria ?? 0),
    totalCriteria: hasAcceptance ? projection.acceptance.length : (work.totalCriteria ?? 0),
  };
}

function workWithProjection(
  work: CoworkWorkRef,
  projection: WorkProjection,
  update: CoworkWorkProjectionUpdate,
): CoworkWorkRef {
  return {
    ...work,
    stage: projection.stage,
    currentHarnessStep: projection.currentHarnessStep,
    acceptance: update.acceptance,
    unresolvedFindings: [...projection.unresolvedFindings],
    completedCriteria: update.completedCriteria,
    totalCriteria: update.totalCriteria,
  };
}

// Loads the durable Work projection first. Runtime evidence is only available
// from the native Work tab; absent or unready tabs deliberately leave it as-is.
async function loadNorthwingWorkProjectionNow(
  workspaceRoot: string,
  workId: string,
  gateway: NorthwingWorkProjectionGateway,
): Promise<LoadedNorthwingWorkProjection> {
  const state = await gateway.readProjectState(workspaceRoot, true);
  if (!state.project) throw new Error("Project not found");
  const work = state.project.works?.find((candidate) => candidate.id === workId);
  if (!work) throw new Error("Work not found in project");

  const saved = savedWorkProjection(work);
  const evidence = await nativeWorkRuntimeEvidence(workspaceRoot, workId, gateway);
  const artifacts = (state.project.artifacts ?? []).filter((artifact) => artifact.workId === workId);
  if (!evidence) return { work, artifacts, projection: saved, changed: false };

  const projection = projectWork(saved, evidence);
  const changed = !sameProjection(saved, projection);
  if (!changed) return { work, artifacts, projection, changed: false };

  const update = projectionUpdate(work, projection);
  const updatedProject = await gateway.updateProjection(workspaceRoot, workId, update);
  const updatedWork = updatedProject.works?.find((candidate) => candidate.id === workId)
    ?? workWithProjection(work, projection, update);
  return {
    work: updatedWork,
    artifacts: (updatedProject.artifacts ?? []).filter((artifact) => artifact.workId === workId),
    projection,
    changed: true,
  };
}

const projectionLoads = new Map<string, Promise<LoadedNorthwingWorkProjection>>();

export function loadNorthwingWorkProjection(
  workspaceRoot: string,
  workId: string,
  gateway: NorthwingWorkProjectionGateway = desktopGateway,
): Promise<LoadedNorthwingWorkProjection> {
  const key = `${normalizedWorkspaceRoot(workspaceRoot)}\u0000${workId}`;
  const previous = projectionLoads.get(key);
  const current = (previous ? previous.catch(() => undefined) : Promise.resolve())
    .then(() => loadNorthwingWorkProjectionNow(workspaceRoot, workId, gateway));
  projectionLoads.set(key, current);
  return current.finally(() => {
    if (projectionLoads.get(key) === current) projectionLoads.delete(key);
  });
}

export function useNorthwingWorkProjection(
  workspaceRoot: string,
  workId: string,
  pollIntervalMs = 5000,
  gateway: NorthwingWorkProjectionGateway = desktopGateway,
): WorkProjectionState {
  const routeKey = `${normalizedWorkspaceRoot(workspaceRoot)}\u0000${workId}`;
  const [projection, setProjection] = useState<WorkProjection>(emptyWorkProjection);
  const [work, setWork] = useState<CoworkWorkRef | null>(null);
  const [artifacts, setArtifacts] = useState<CoworkArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const generation = useRef(0);
  const loadedRouteKey = useRef(routeKey);

  useEffect(() => {
    const requestGeneration = ++generation.current;
    let cancelled = false;
    let refreshRunning = false;
    const refresh = async () => {
      if (refreshRunning) return;
      refreshRunning = true;
      try {
        const next = await loadNorthwingWorkProjection(workspaceRoot, workId, gateway);
        if (cancelled || generation.current !== requestGeneration) return;
        loadedRouteKey.current = routeKey;
        setWork(next.work);
        setArtifacts(next.artifacts);
        setProjection(next.projection);
        setError(undefined);
        setLoading(false);
      } catch (err) {
        if (cancelled || generation.current !== requestGeneration) return;
        loadedRouteKey.current = routeKey;
        setWork(null);
        setArtifacts([]);
        setProjection(emptyWorkProjection());
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      } finally {
        refreshRunning = false;
      }
    };
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [workspaceRoot, workId, routeKey, pollIntervalMs, gateway]);

  if (loadedRouteKey.current !== routeKey) {
    return {
      ...emptyWorkProjection(),
      workspaceRoot,
      workId,
      work: null,
      artifacts: [],
      loading: true,
      error: undefined,
    };
  }

  return {
    ...projection,
    workspaceRoot,
    workId,
    work,
    artifacts,
    loading,
    error,
  };
}
