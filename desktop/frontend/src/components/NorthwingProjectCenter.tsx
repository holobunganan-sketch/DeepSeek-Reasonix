import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  FileOutput,
  FolderKanban,
  FolderPlus,
  ListTodo,
  LoaderCircle,
  Play,
  Sparkles,
} from "lucide-react";
import { onEvent } from "../lib/bridge";
import { getLocale } from "../lib/i18n";
import {
  createCoworkProject,
  readCoworkProjectState,
  type CoworkProject,
  type CoworkProjectState,
} from "../lib/northwingCowork";
import { NorthwingArtifactCenter } from "./NorthwingArtifactCenter";
import { NorthwingWorkDialog } from "./NorthwingWorkDialog";
import "./NorthwingProjectCenter.css";

const EXPANDED_KEY = "northwing:project-center-expanded";

function readExpanded(): boolean {
  try {
    return localStorage.getItem(EXPANDED_KEY) !== "0";
  } catch {
    return true;
  }
}

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function localText() {
  const locale = getLocale();
  if (locale === "zh" || locale === "zh-TW") {
    return {
      title: "Northwing 工作台",
      projects: "项目",
      works: "工作",
      artifacts: "成品",
      enable: "启用 CoWork",
      enabling: "正在启用",
      addFolder: "添加项目文件夹",
      ordinary: "当前仍是普通 Reasonix 工作区",
      ordinaryHint: "启用后只增加轻量项目清单，不复制会话或文件。",
      latestWork: "最近工作",
      latestArtifact: "最近成品",
      empty: "选择项目后可开始一项Work。",
      retry: "重试",
      newWork: "新建 Work",
      manage: "工作与成品",
    };
  }
  return {
    title: "Northwing Work",
    projects: "projects",
    works: "works",
    artifacts: "artifacts",
    enable: "Enable CoWork",
    enabling: "Enabling",
    addFolder: "Add project folder",
    ordinary: "This is still a regular Reasonix workspace",
    ordinaryHint: "Enabling adds a small manifest without copying sessions or files.",
    latestWork: "Latest work",
    latestArtifact: "Latest artifact",
    empty: "Select a project to start a Work.",
    retry: "Retry",
    newWork: "New Work",
    manage: "Work and artifacts",
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
  const [expanded, setExpanded] = useState(readExpanded);
  const [state, setState] = useState<CoworkProjectState>({ exists: false });
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
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

  // Artifact discovery is local and deterministic. A completed Reasonix turn
  // triggers one debounced hash scan; no file body or manifest data is added to
  // the model context.
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
  const totals = {
    projects: state.exists ? 1 : 0,
    works: works.length,
    artifacts: artifacts.length,
  };

  const latestWork = useMemo(() => [...works].sort((a, b) =>
    String(b.updatedAt ?? b.createdAt ?? "").localeCompare(String(a.updatedAt ?? a.createdAt ?? "")))[0], [works]);
  const latestArtifact = useMemo(() => [...artifacts].sort((a, b) =>
    String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))[0], [artifacts]);

  const toggleExpanded = () => {
    setExpanded((current) => {
      const next = !current;
      try {
        localStorage.setItem(EXPANDED_KEY, next ? "1" : "0");
      } catch {
        /* localStorage unavailable */
      }
      return next;
    });
  };

  const enableActiveProject = async () => {
    if (!activeWorkspaceRoot || creating) return;
    setCreating(true);
    setError("");
    try {
      await createCoworkProject(activeWorkspaceRoot, basename(activeWorkspaceRoot));
      await refresh(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const acceptProject = (nextProject: CoworkProject) => {
    setState((current) => ({ ...current, exists: true, project: nextProject }));
    void refresh(true);
  };

  return (
    <section className={`northwing-project-center${expanded ? " northwing-project-center--expanded" : ""}`}>
      <button
        type="button"
        className="northwing-project-center__header"
        onClick={toggleExpanded}
        aria-expanded={expanded}
      >
        <span className="northwing-project-center__brand">
          <Sparkles size={14} aria-hidden="true" />
          <span>{text.title}</span>
        </span>
        <span className="northwing-project-center__totals" aria-label={`${totals.projects} ${text.projects}, ${totals.works} ${text.works}, ${totals.artifacts} ${text.artifacts}`}>
          <span><FolderKanban size={12} />{totals.projects}</span>
          <span><ListTodo size={12} />{totals.works}</span>
          <span><FileOutput size={12} />{totals.artifacts}</span>
        </span>
        {loading ? <LoaderCircle className="northwing-project-center__spinner" size={14} /> : <ChevronDown className="northwing-project-center__chevron" size={14} />}
      </button>

      {expanded && (
        <div className="northwing-project-center__body">
          {error ? (
            <div className="northwing-project-center__message northwing-project-center__message--error">
              <span>{error}</span>
              <button type="button" onClick={() => void refresh(true)}>{text.retry}</button>
            </div>
          ) : !activeWorkspaceRoot ? (
            <div className="northwing-project-center__empty">
              <span>{text.empty}</span>
              <button type="button" onClick={() => void onAddProject()}>
                <FolderPlus size={13} />
                {text.addFolder}
              </button>
            </div>
          ) : state.exists && project ? (
            <div className="northwing-project-center__active">
              <div className="northwing-project-center__project-title">{project.name || basename(activeWorkspaceRoot)}</div>
              <div className="northwing-project-center__metrics">
                <span>{works.length} {text.works}</span>
                <span>{artifacts.length} {text.artifacts}</span>
              </div>
              {(latestWork || latestArtifact) && (
                <div className="northwing-project-center__latest">
                  {latestWork && (
                    <div title={latestWork.title}>
                      <ListTodo size={12} />
                      <span>{text.latestWork}: {latestWork.title}</span>
                    </div>
                  )}
                  {latestArtifact && (
                    <div title={latestArtifact.path}>
                      <FileOutput size={12} />
                      <span>{text.latestArtifact}: {basename(latestArtifact.path)}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="northwing-project-center__actions">
                <button type="button" className="northwing-project-center__primary" onClick={() => setWorkDialogOpen(true)}>
                  <Play size={13} />{text.newWork}
                </button>
                <button type="button" onClick={() => setArtifactCenterOpen(true)}>
                  <FolderKanban size={13} />{text.manage}
                </button>
              </div>
            </div>
          ) : (
            <div className="northwing-project-center__enable">
              <div>
                <strong>{text.ordinary}</strong>
                <span>{text.ordinaryHint}</span>
              </div>
              <button type="button" disabled={creating} onClick={() => void enableActiveProject()}>
                {creating ? <LoaderCircle className="northwing-project-center__spinner" size={13} /> : <Sparkles size={13} />}
                {creating ? text.enabling : text.enable}
              </button>
            </div>
          )}
        </div>
      )}

      {workDialogOpen && activeWorkspaceRoot && (
        <NorthwingWorkDialog
          workspaceRoot={activeWorkspaceRoot}
          onClose={() => setWorkDialogOpen(false)}
          onStarted={acceptProject}
        />
      )}
      {artifactCenterOpen && activeWorkspaceRoot && state.exists && project && (
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
