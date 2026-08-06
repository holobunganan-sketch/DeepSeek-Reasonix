import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BriefcaseBusiness, FileOutput } from "lucide-react";
import { app, onEvent } from "../lib/bridge";
import {
  readCoworkProjectState,
  updateCoworkWorkProgress,
  type CoworkProjectState,
  type CoworkWorkRef,
} from "../lib/northwingCowork";
import type { TabMeta } from "../lib/types";
import { NorthwingArtifactCenter } from "./NorthwingArtifactCenter";
import "./NorthwingWorkSessionSurface.css";

function localText() {
  const chinese = typeof navigator !== "undefined" && /^zh\b/i.test(navigator.language);
  return chinese ? {
    work: "Work",
    artifacts: "成品",
    acceptance: "验收",
    stages: {
      planning: "规划",
      inventory: "资料盘点",
      producing: "制作",
      reviewing: "复核",
      repairing: "修订",
      validating: "验证",
      waiting_user: "等待确认",
      completed: "已完成",
      failed: "失败",
    } as Record<string, string>,
  } : {
    work: "Work",
    artifacts: "Artifacts",
    acceptance: "Acceptance",
    stages: {
      planning: "Planning",
      inventory: "Inventory",
      producing: "Producing",
      reviewing: "Reviewing",
      repairing: "Repairing",
      validating: "Validating",
      waiting_user: "Waiting for confirmation",
      completed: "Completed",
      failed: "Failed",
    } as Record<string, string>,
  };
}

function matchesTab(work: CoworkWorkRef, tab: TabMeta): boolean {
  if (work.goalId && tab.topicId && work.goalId === tab.topicId) return true;
  return Boolean(work.sessionPath && tab.sessionPath && work.sessionPath === tab.sessionPath);
}

export function NorthwingWorkSessionSurface({ activeTab }: { activeTab?: TabMeta | null }) {
  const t = localText();
  const [state, setState] = useState<CoworkProjectState>({ exists: false });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [todoProgress, setTodoProgress] = useState<{ completed: number; total: number } | null>(null);
  const requestRef = useRef(0);

  const refresh = useCallback(async (syncArtifacts = false) => {
    const workspaceRoot = activeTab?.scope === "project" ? activeTab.workspaceRoot.trim() : "";
    const request = ++requestRef.current;
    if (!workspaceRoot) {
      setState({ exists: false });
      setTodoProgress(null);
      setDrawerOpen(false);
      return;
    }
    try {
      const [next, meta] = await Promise.all([
        readCoworkProjectState(workspaceRoot, syncArtifacts),
        activeTab?.id ? app.MetaForTab(activeTab.id).catch(() => null) : Promise.resolve(null),
      ]);
      if (request === requestRef.current) {
        setState(next);
        const todos = meta?.canonicalTodos ?? [];
        setTodoProgress(todos.length > 0
          ? { completed: todos.filter((todo) => todo.status === "completed").length, total: todos.length }
          : null);
      }
    } catch {
      if (request === requestRef.current) setState({ exists: false });
    }
  }, [activeTab?.id, activeTab?.scope, activeTab?.workspaceRoot]);

  useEffect(() => {
    setDrawerOpen(false);
    void refresh(false);
  }, [activeTab?.id, refresh]);

  useEffect(() => onEvent((event) => {
    if (event.kind !== "turn_done") return;
    if (event.tabId && activeTab?.id && event.tabId !== activeTab.id) return;
    void refresh(true);
  }), [activeTab?.id, refresh]);

  const work = useMemo(() => state.project?.works?.find((candidate) => activeTab && matchesTab(candidate, activeTab)), [activeTab, state.project?.works]);
  const activeWork = activeTab?.scope === "project" ? work : undefined;
  const stage = !activeTab || !activeWork
    ? "planning"
    : activeTab.startupErr
      ? "failed"
      : activeTab.pendingPrompt || activeTab.goalStatus === "blocked"
        ? "waiting_user"
        : activeTab.goalStatus === "complete"
          ? "completed"
          : activeTab.running
            ? "producing"
            : activeWork.stage || "planning";
  const total = todoProgress?.total ?? activeWork?.totalCriteria ?? 0;
  const observedCompleted = todoProgress?.completed ?? activeWork?.completedCriteria ?? 0;
  const completed = stage === "completed" && total > 0 ? total : observedCompleted;
  const artifactCount = activeWork
    ? state.project?.artifacts?.filter((artifact) => artifact.workId === activeWork.id).length ?? 0
    : 0;

  useEffect(() => {
    if (!activeTab || !activeWork) return;
    if (activeWork.stage === stage && (activeWork.completedCriteria ?? 0) === completed && (activeWork.totalCriteria ?? 0) === total) return;
    let active = true;
    void updateCoworkWorkProgress(activeTab.workspaceRoot, activeWork.id, stage, completed, total)
      .then((project) => {
        if (active) setState((current) => ({ ...current, exists: true, project }));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [activeTab, activeWork, completed, stage, total]);

  if (!activeTab || !activeWork) return null;

  return (
    <>
      <section className="northwing-work-session-surface" aria-label={t.work}>
        <div className="northwing-work-session-surface__identity">
          <BriefcaseBusiness size={13} aria-hidden="true" />
          <strong>{t.work}</strong>
          <span>{activeWork.kind || "general"}</span>
          <span>{activeWork.quality || "standard"}</span>
        </div>
        <div className="northwing-work-session-surface__status">
          <span>{t.stages[stage] || stage}</span>
          <span>{t.acceptance} {completed}/{total}</span>
        </div>
        <button type="button" onClick={() => setDrawerOpen(true)}>
          <FileOutput size={13} aria-hidden="true" />
          {t.artifacts}
          {artifactCount > 0 && <span>{artifactCount}</span>}
        </button>
      </section>
      {drawerOpen && (
        <NorthwingArtifactCenter
          workspaceRoot={activeTab.workspaceRoot}
          workId={activeWork.id}
          state={state}
          onState={setState}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </>
  );
}
