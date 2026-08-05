import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileOutput,
  FolderPlus,
  LoaderCircle,
  Play,
  RotateCw,
} from "lucide-react";
import { onEvent } from "../lib/bridge";
import { getLocale } from "../lib/i18n";
import {
  readCoworkProjectState,
  type CoworkProject,
  type CoworkProjectState,
} from "../lib/northwingCowork";
import { NorthwingArtifactCenter } from "./NorthwingArtifactCenter";
import { NorthwingWorkDialog } from "./NorthwingWorkDialog";
import "./NorthwingProjectCenter.css";

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function localText() {
  const locale = getLocale();
  if (locale === "zh" || locale === "zh-TW") {
    return {
      work: "Work",
      newWork: "新建 Work",
      manage: "工作与成品",
      addFolder: "添加项目文件夹",
      noWorkspace: "选择一个项目文件夹后即可创建 Work",
      noWorks: "当前项目还没有 Work",
      latest: "最近",
      works: "项工作",
      artifacts: "个成品",
      refresh: "刷新",
      retry: "重试",
    };
  }
  return {
    work: "Work",
    newWork: "New Work",
    manage: "Work and artifacts",
    addFolder: "Add project folder",
    noWorkspace: "Select a project folder to create a Work",
    noWorks: "No Work in this project yet",
    latest: "Latest",
    works: "works",
    artifacts: "artifacts",
    refresh: "Refresh",
    retry: "Retry",
  };
}

export type NorthwingProjectCenterProps = {
  activeWorkspaceRoot?: string;
  refreshSignal?: number;
  onAddProject: () => Promise<void>;
};

export function NorthwingProjectCenter({
  activeWorkspaceRoot,
  refreshSignal,
  onAddProject,
}: NorthwingProjectCenterProps) {
  const text = localText();
  const [state, setState] = useState<CoworkProjectState>({ exists: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [workDialogOpen, setWorkDialogOpen] = useState(false);
  const [artifactCenterOpen, setArtifactCenterOpen] = useState(false);
  const requestRef = useRef(0);
  const turnSyncTimerRef = useRef<number | null>(null);

  const refresh = useCallback(async (syncArtifacts = true) => {
    const workspaceRoot = activeWorkspaceRoot?.trim() ?? "";
    const request = ++requestRef.current;
    if (!workspaceRoot) {
      setState({ exists: false });
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const next = await readCoworkProjectState(workspaceRoot, syncArtifacts);
      if (request !== requestRef.current) return;
      setState(next);
      if (next.error) setError(next.error);
    } catch (err) {
      if (request !== requestRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [activeWorkspaceRoot]);

  useEffect(() => {
    setWorkDialogOpen(false);
    setArtifactCenterOpen(false);
    void refresh(true);
  }, [refresh, refreshSignal]);

  useEffect(() => {
    const unsubscribe = onEvent((event) => {
      if (event.kind !== "turn_done" || !activeWorkspaceRoot) return;
      if (turnSyncTimerRef.current !== null) window.clearTimeout(turnSyncTimerRef.current);
      turnSyncTimerRef.current = window.setTimeout(() => {
        turnSyncTimerRef.current = null;
        void refresh(true);
      }, 350);
    });
    return () => {
      unsubscribe();
      if (turnSyncTimerRef.current !== null) window.clearTimeout(turnSyncTimerRef.current);
    };
  }, [activeWorkspaceRoot, refresh]);

  const project = state.project;
  const works = project?.works ?? [];
  const artifacts = project?.artifacts ?? [];
  const latestWork = useMemo(() => [...works].sort((a, b) =>
    String(b.updatedAt ?? b.createdAt ?? "").localeCompare(String(a.updatedAt ?? a.createdAt ?? "")))[0], [works]);

  const acceptProject = (nextProject: CoworkProject) => {
    setState((current) => ({ ...current, exists: true, project: nextProject }));
    void refresh(true);
  };

  if (!activeWorkspaceRoot) {
    return (
      <section className="northwing-project-center northwing-project-center--empty">
        <div className="northwing-project-center__copy">
          <strong>{text.work}</strong>
          <span>{text.noWorkspace}</span>
        </div>
        <button type="button" onClick={() => void onAddProject()}>
          <FolderPlus size={13} />{text.addFolder}
        </button>
      </section>
    );
  }

  return (
    <section className="northwing-project-center" aria-label={text.work}>
      <div className="northwing-project-center__copy">
        <strong>{text.work}</strong>
        <span title={activeWorkspaceRoot}>
          {basename(activeWorkspaceRoot)} · {works.length} {text.works} · {artifacts.length} {text.artifacts}
        </span>
        <small title={latestWork?.title}>
          {latestWork
            ? `${text.latest}: ${latestWork.title} · ${latestWork.quality || "standard"}`
            : text.noWorks}
        </small>
      </div>
      <div className="northwing-project-center__actions">
        <button type="button" className="northwing-project-center__primary" onClick={() => setWorkDialogOpen(true)}>
          <Play size={13} />{text.newWork}
        </button>
        <button type="button" onClick={() => setArtifactCenterOpen(true)} disabled={!state.exists || !project}>
          <FileOutput size={13} />{text.manage}
        </button>
        <button type="button" className="northwing-project-center__icon" onClick={() => void refresh(true)} disabled={loading} aria-label={error ? text.retry : text.refresh} title={error ? text.retry : text.refresh}>
          {loading ? <LoaderCircle className="northwing-spin" size={13} /> : <RotateCw size={13} />}
        </button>
      </div>

      {error && <div className="northwing-project-center__error">{error}</div>}

      {workDialogOpen && (
        <NorthwingWorkDialog
          workspaceRoot={activeWorkspaceRoot}
          onClose={() => setWorkDialogOpen(false)}
          onStarted={acceptProject}
        />
      )}
      {artifactCenterOpen && state.exists && project && (
        <NorthwingArtifactCenter
          workspaceRoot={activeWorkspaceRoot}
          state={state}
          onState={setState}
          onClose={() => setArtifactCenterOpen(false)}
        />
      )}
    </section>
  );
}
