import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  FileOutput,
  FolderKanban,
  FolderPlus,
  ListTodo,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { asArray } from "../lib/array";
import { app } from "../lib/bridge";
import { getLocale } from "../lib/i18n";
import type { ProjectNode } from "../lib/types";
import "./NorthwingProjectCenter.css";

type CoworkWorkRef = {
  id: string;
  title: string;
  profile: string;
  updatedAt: string;
};

type CoworkArtifact = {
  id: string;
  path: string;
  kind: string;
  version: number;
  createdAt: string;
};

type CoworkProjectSummary = {
  workspace: string;
  exists: boolean;
  id?: string;
  name?: string;
  updatedAt?: string;
  workCount: number;
  artifactCount: number;
  latestWork?: CoworkWorkRef;
  latestArtifact?: CoworkArtifact;
  error?: string;
};

type CoworkProject = {
  id: string;
  name: string;
  workspace: string;
};

type CoworkBindings = {
  CoworkProjectSummaries?: (workspaceRoots: string[]) => Promise<CoworkProjectSummary[]>;
  CreateCoworkProject?: (workspaceRoot: string, name: string) => Promise<CoworkProject>;
};

const coworkApp = app as typeof app & CoworkBindings;
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

function workspaceKey(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

function collectProjectRoots(nodes: ProjectNode[]): string[] {
  const roots: string[] = [];
  for (const node of nodes) {
    if (node?.kind === "project" && node.root) roots.push(node.root);
  }
  return [...new Set(roots)];
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
      empty: "选择项目后可查看工作和成品摘要。",
      unavailable: "当前桌面绑定尚未生成，请重新构建桌面应用。",
      retry: "重试",
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
    empty: "Select a project to see its work and artifact summary.",
    unavailable: "Desktop bindings are not generated in this build. Rebuild the desktop app.",
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
  const [expanded, setExpanded] = useState(readExpanded);
  const [summaries, setSummaries] = useState<CoworkProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);

  const refresh = useCallback(async () => {
    if (typeof coworkApp.CoworkProjectSummaries !== "function") {
      setSupported(false);
      return;
    }
    setSupported(true);
    setLoading(true);
    setError("");
    try {
      const tree = asArray(await app.ListProjectTree());
      const roots = collectProjectRoots(tree);
      const next = asArray(await coworkApp.CoworkProjectSummaries(roots));
      setSummaries(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshSignal]);

  const totals = useMemo(() => summaries.reduce(
    (result, summary) => {
      if (summary.exists) result.projects += 1;
      result.works += summary.workCount || 0;
      result.artifacts += summary.artifactCount || 0;
      return result;
    },
    { projects: 0, works: 0, artifacts: 0 },
  ), [summaries]);

  const activeSummary = useMemo(() => {
    const key = workspaceKey(activeWorkspaceRoot ?? "");
    if (!key) return undefined;
    return summaries.find((summary) => workspaceKey(summary.workspace) === key);
  }, [activeWorkspaceRoot, summaries]);

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
    if (!activeWorkspaceRoot || creating || typeof coworkApp.CreateCoworkProject !== "function") return;
    setCreating(true);
    setError("");
    try {
      await coworkApp.CreateCoworkProject(activeWorkspaceRoot, basename(activeWorkspaceRoot));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
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
          {!supported ? (
            <div className="northwing-project-center__message northwing-project-center__message--error">{text.unavailable}</div>
          ) : error ? (
            <div className="northwing-project-center__message northwing-project-center__message--error">
              <span>{error}</span>
              <button type="button" onClick={() => void refresh()}>{text.retry}</button>
            </div>
          ) : !activeWorkspaceRoot ? (
            <div className="northwing-project-center__empty">
              <span>{text.empty}</span>
              <button type="button" onClick={() => void onAddProject()}>
                <FolderPlus size={13} />
                {text.addFolder}
              </button>
            </div>
          ) : activeSummary?.exists ? (
            <div className="northwing-project-center__active">
              <div className="northwing-project-center__project-title">{activeSummary.name || basename(activeWorkspaceRoot)}</div>
              <div className="northwing-project-center__metrics">
                <span>{activeSummary.workCount} {text.works}</span>
                <span>{activeSummary.artifactCount} {text.artifacts}</span>
              </div>
              {(activeSummary.latestWork || activeSummary.latestArtifact) && (
                <div className="northwing-project-center__latest">
                  {activeSummary.latestWork && (
                    <div title={activeSummary.latestWork.title}>
                      <ListTodo size={12} />
                      <span>{text.latestWork}: {activeSummary.latestWork.title}</span>
                    </div>
                  )}
                  {activeSummary.latestArtifact && (
                    <div title={activeSummary.latestArtifact.path}>
                      <FileOutput size={12} />
                      <span>{text.latestArtifact}: {basename(activeSummary.latestArtifact.path)}</span>
                    </div>
                  )}
                </div>
              )}
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
    </section>
  );
}
