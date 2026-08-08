import { useState, useEffect, useCallback, useRef } from "react";
import type { CoworkWorkRef } from "../../lib/northwingCowork";
import {
  updateCoworkWorkProjection,
  readCoworkProjectState,
} from "../../lib/northwingCowork";
import {
  projectWork,
  type WorkProjection,
  type WorkRuntimeEvidence,
} from "./NorthwingWorkCoordinator";

export type WorkProjectionState = WorkProjection & {
  workspaceRoot: string;
  workId: string;
  work: CoworkWorkRef | null;
  loading: boolean;
  error?: string;
  persist: () => Promise<void>;
};

export function useNorthwingWorkProjection(
  workspaceRoot: string,
  workId: string,
  pollIntervalMs = 5000,
): WorkProjectionState {
  const [projection, setProjection] = useState<WorkProjection>(() => ({
    stage: "intake",
    currentHarnessStep: "inventory",
    acceptance: [],
    unresolvedFindings: [],
  }));
  const [work, setWork] = useState<CoworkWorkRef | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const latestProjection = useRef(projection);
  latestProjection.current = projection;

  const refresh = useCallback(async () => {
    try {
      const state = await readCoworkProjectState(workspaceRoot, false);
      if (!state.project) {
        setError("Project not found");
        setLoading(false);
        return;
      }
      const found = state.project.works?.find((w) => w.id === workId);
      if (!found) {
        setError("Work not found in project");
        setLoading(false);
        return;
      }
      setWork(found);
      const evidence: WorkRuntimeEvidence = {
        canonicalTodos: [],
        pendingApproval: false,
        goalStatus: found.stage === "completed" ? "complete" : "active",
      };
      const next = projectWork(latestProjection.current, evidence);
      if (
        next.stage !== latestProjection.current.stage ||
        JSON.stringify(next.acceptance) !== JSON.stringify(latestProjection.current.acceptance)
      ) {
        setProjection(next);
        await updateCoworkWorkProjection(workspaceRoot, workId, {
          stage: next.stage,
          currentHarnessStep: next.currentHarnessStep,
          acceptance: next.acceptance.map((a) => ({ ...a, evidence: a.evidence ?? "" })),
          unresolvedFindings: next.unresolvedFindings,
          completedCriteria: found.completedCriteria ?? 0,
          totalCriteria: found.totalCriteria ?? 0,
        }).catch(() => undefined);
      } else {
        setProjection(next);
      }
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [workspaceRoot, workId]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, pollIntervalMs);
    return () => clearInterval(timer);
  }, [refresh, pollIntervalMs]);

  const persist = useCallback(async () => {
    await updateCoworkWorkProjection(workspaceRoot, workId, {
      stage: projection.stage,
      currentHarnessStep: projection.currentHarnessStep,
      acceptance: projection.acceptance.map((a) => ({ ...a, evidence: a.evidence ?? "" })),
      unresolvedFindings: projection.unresolvedFindings,
      completedCriteria: work?.completedCriteria ?? 0,
      totalCriteria: work?.totalCriteria ?? 0,
    });
  }, [workspaceRoot, workId, projection, work]);

  return {
    ...projection,
    workspaceRoot,
    workId,
    work,
    loading,
    error,
    persist,
  };
}
