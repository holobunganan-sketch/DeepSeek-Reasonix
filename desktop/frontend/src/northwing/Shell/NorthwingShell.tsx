import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import { NorthwingNavigation } from "../Navigation/NorthwingNavigation";
import type { NorthwingDestination } from "../Navigation/routes";
import { destinationPageName } from "../Navigation/routes";
import { NorthwingHome } from "../Home/NorthwingHome";
import type { NorthwingCatalog } from "../domain/catalog";
import { normalizeNorthwingCatalog } from "../domain/catalog";
import { NorthwingProjects } from "../Projects/NorthwingProjects";
import { NorthwingProjectView } from "../Projects/NorthwingProjectView";
import { createNewNorthwingProject } from "../Projects/newProjectController";
import { NorthwingWorkList } from "../Work/NorthwingWorkList";
import { NorthwingWorkView } from "../Work/NorthwingWorkView";
import { NorthwingNewWork } from "../NewWork/NorthwingNewWork";
import { useNorthwingModelCatalog } from "../NewWork/useNorthwingModelCatalog";
import { NorthwingQuickChat } from "../QuickChat/NorthwingQuickChat";
import type { ChatWorkDraft } from "../QuickChat/convertChatToWork";
import { launchNewWork } from "../NewWork/newWorkController";
import { NorthwingArtifacts } from "../Artifacts/NorthwingArtifacts";
import {
  openCoworkArtifact,
  previewCoworkArtifact,
  revealCoworkArtifact,
  setCoworkArtifactFinal,
} from "../../lib/northwingCowork";
import {
  DesktopWindowControls,
  useDesktopWindowChrome,
  type DesktopWindowBridge,
} from "../../components/DesktopWindowChrome";

const SettingsPanel = lazy(() => import("../../components/SettingsPanel").then((module) => ({ default: module.SettingsPanel })));

export type { NorthwingDestination } from "../Navigation/routes";

export type NorthwingShellGateway = {
  workspaceRoots?: string[];
  SessionWorkspace?: React.ComponentType<{ destination: NorthwingDestination; onSessionTabReady?: (tabId: string) => void }>;
  readCatalog?: () => Promise<NorthwingCatalog>;
  onNavigate?: (destination: NorthwingDestination) => void;
  windowBridge?: DesktopWindowBridge;
};
const NorthwingGatewayContext = createContext<NorthwingShellGateway | undefined>(undefined);
export const NorthwingNavigateContext = createContext<(destination: NorthwingDestination) => void>(() => {});

export type NorthwingShellProps = {
  initialDestination?: NorthwingDestination;
  gateway?: NorthwingShellGateway;
};

const DEFAULT_NORTHWING_DESTINATION: NorthwingDestination = { kind: "home" };

function PlaceholderPage({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="northwing-placeholder-page">
      <h1 className="northwing-placeholder-page__title">{title}</h1>
      {children && <p className="northwing-placeholder-page__text">{children}</p>}
    </div>
  );
}

function NorthwingHomePage() {
  const gateway = useContext(NorthwingGatewayContext);
  const navigate = useContext(NorthwingNavigateContext);
  const [catalog, setCatalog] = useState<NorthwingCatalog>(() =>
    normalizeNorthwingCatalog({ projects: [], activeWorks: [], waitingForUser: [], recentArtifacts: [] }),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await gateway?.readCatalog?.();
      setCatalog(normalizeNorthwingCatalog(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <NorthwingHome
      catalog={catalog}
      loading={loading}
      error={error}
      onRetry={load}
      onNewWork={() => navigate({ kind: "new-work" })}
      onQuickChat={() => navigate({ kind: "quick-chat" })}
      onOpenWork={(work) => navigate({ kind: "work", workspaceRoot: work.workspace, workId: work.workId })}
      onOpenProject={(project) =>
        navigate({ kind: project.id ? "project" : "projects", workspaceRoot: project.workspace })
      }
      onOpenArtifact={(artifact) =>
        navigate({ kind: "work", workspaceRoot: artifact.workspace, workId: artifact.workId })
      }
    />
  );
}

function useShellCatalog() {
  const gateway = useContext(NorthwingGatewayContext);
  const [catalog, setCatalog] = useState<NorthwingCatalog>(() =>
    normalizeNorthwingCatalog({ projects: [], activeWorks: [], waitingForUser: [], recentArtifacts: [] }),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await gateway?.readCatalog?.();
      setCatalog(normalizeNorthwingCatalog(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void load();
  }, [load]);

  return { catalog, loading, error, reload: load };
}

function NorthwingProjectsPage() {
  const navigate = useContext(NorthwingNavigateContext);
  const { catalog, loading, error, reload } = useShellCatalog();
  const [creatingProject, setCreatingProject] = useState(false);
  const [createProjectError, setCreateProjectError] = useState<string | undefined>();

  const handleNewProject = useCallback(async () => {
    if (creatingProject) return;
    setCreatingProject(true);
    setCreateProjectError(undefined);
    try {
      const created = await createNewNorthwingProject();
      if (!created) return;
      await reload();
      navigate({ kind: "project", workspaceRoot: created.workspaceRoot });
    } catch (err) {
      setCreateProjectError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingProject(false);
    }
  }, [creatingProject, navigate, reload]);

  if (loading || error) {
    return (
      <main role="main" data-northwing-page="projects" className="nw-page">
        <h1 className="nw-page__title">Projects</h1>
        <p className="nw-page__subtitle">{loading ? "Loading projects..." : error}</p>
        {error && (
          <button type="button" className="nw-btn nw-btn--primary" onClick={reload}>
            Retry
          </button>
        )}
      </main>
    );
  }
  return (
    <NorthwingProjects
      projects={catalog.projects}
      onOpenProject={(project) =>
        navigate({ kind: project.id ? "project" : "projects", workspaceRoot: project.workspace })
      }
      onNewProject={() => void handleNewProject()}
      creatingProject={creatingProject}
      createProjectError={createProjectError}
    />
  );
}

function NorthwingWorkListPage() {
  const navigate = useContext(NorthwingNavigateContext);
  const { catalog, loading, error, reload } = useShellCatalog();
  if (loading || error) {
    return (
      <main role="main" data-northwing-page="work-list" className="nw-page">
        <h1 className="nw-page__title">Work</h1>
        <p className="nw-page__subtitle">{loading ? "Loading work..." : error}</p>
        {error && (
          <button type="button" className="nw-btn nw-btn--primary" onClick={reload}>
            Retry
          </button>
        )}
      </main>
    );
  }
  return (
    <NorthwingWorkList
      works={catalog.works}
      onOpenWork={(work) => navigate({ kind: "work", workspaceRoot: work.workspace, workId: work.workId })}
      onNewWork={() => navigate({ kind: "new-work" })}
    />
  );
}

function NorthwingProjectDetailPage({ workspaceRoot }: { workspaceRoot: string }) {
  const navigate = useContext(NorthwingNavigateContext);
  const { catalog, loading, error, reload } = useShellCatalog();
  if (loading || error) {
    return (
      <main role="main" data-northwing-page="project" className="nw-page">
        <h1 className="nw-page__title">Project</h1>
        <p className="nw-page__subtitle">{loading ? "Loading project..." : error}</p>
        {error && (
          <button type="button" className="nw-btn nw-btn--primary" onClick={reload}>
            Retry
          </button>
        )}
      </main>
    );
  }
  const project = catalog.projects.find((p) => p.workspace === workspaceRoot);
  if (!project) {
    return (
      <main role="main" data-northwing-page="project" className="nw-page">
        <h1 className="nw-page__title">Project not found</h1>
        <p className="nw-page__subtitle">The requested project could not be loaded.</p>
      </main>
    );
  }
  const works = catalog.works.filter((w) => w.workspace === workspaceRoot);
  const artifacts = catalog.recentArtifacts.filter((a) => a.workspace === workspaceRoot);
  return (
    <NorthwingProjectView
      project={project}
      works={works}
      artifacts={artifacts}
      onOpenWork={(work) => navigate({ kind: "work", workspaceRoot: work.workspace, workId: work.workId })}
      onOpenArtifact={(artifact) =>
        navigate({ kind: "work", workspaceRoot: artifact.workspace, workId: artifact.workId })
      }
      onNewWork={() => navigate({ kind: "new-work", workspaceRoot })}
    />
  );
}

function NorthwingArtifactsPage() {
  const { catalog, loading, error, reload } = useShellCatalog();
  if (loading || error) {
    return (
      <main role="main" data-northwing-page="artifacts" className="nw-page">
        <h1 className="nw-page__title">Artifacts</h1>
        <p className="nw-page__subtitle">{loading ? "Loading artifacts..." : error}</p>
      </main>
    );
  }
  const artifacts = catalog.recentArtifacts.map((a) => ({
    id: a.id,
    path: a.path,
    kind: a.kind,
    workId: a.workId,
    version: a.version,
    final: a.final,
    projectId: a.projectId,
    projectName: a.projectName,
    workspace: a.workspace,
    createdAt: a.createdAt,
  }));
  return (
    <NorthwingArtifacts
      artifacts={artifacts}
      loading={false}
      onPreview={(artifact) => previewCoworkArtifact(artifact.workspace, artifact.path)}
      onOpen={(artifact) => openCoworkArtifact(artifact.workspace, artifact.path)}
      onReveal={(artifact) => revealCoworkArtifact(artifact.workspace, artifact.path)}
      onMarkFinal={async (artifact) => {
        await setCoworkArtifactFinal(artifact.workspace, artifact.id);
        await reload();
      }}
    />
  );
}

function NorthwingSettingsPage({
  returnTo,
  navigate,
}: {
  returnTo?: "home" | "new-work";
  navigate: (destination: NorthwingDestination) => void;
}) {
  const platformAttribute = document.documentElement.getAttribute("data-platform");
  const desktopPlatform = platformAttribute === "windows" || platformAttribute === "darwin"
    ? platformAttribute
    : "linux";
  return (
    <main role="main" data-northwing-page="settings" className="nw-page">
      <h1 className="nw-page__title">Settings</h1>
      <Suspense fallback={<p className="nw-page__subtitle">Loading Settings...</p>}>
        <SettingsPanel
          initialTab="models"
          desktopPlatform={desktopPlatform}
          agentRunning={false}
          onChanged={() => window.dispatchEvent(new Event("reasonix:model-catalog-changed"))}
          onUseSubagent={() => navigate({ kind: "quick-chat" })}
          onClose={() => navigate(returnTo === "new-work" ? { kind: "new-work" } : { kind: "home" })}
        />
      </Suspense>
    </main>
  );
}

function NorthwingNewWorkPage({
  destination,
  conversionDraft,
  navigate,
  onCancelNewWork,
  onCompleteConversion,
}: {
  destination: Extract<NorthwingDestination, { kind: "new-work" }>;
  conversionDraft: ChatWorkDraft | null;
  navigate: (destination: NorthwingDestination) => void;
  onCancelNewWork: () => void;
  onCompleteConversion: () => void;
}) {
  const modelCatalog = useNorthwingModelCatalog();
  const wsRoot = destination.workspaceRoot ?? "";
  return (
    <NorthwingNewWork
      key={conversionDraft ? `convert-${conversionDraft.chatTabId}` : "new-work"}
      preselectedWorkspace={conversionDraft ? undefined : wsRoot || undefined}
      workspaceOptions={conversionDraft?.workspaceRoots}
      requireProjectSelection={Boolean(conversionDraft)}
      initialForm={conversionDraft ? { title: conversionDraft.title, objective: conversionDraft.objective } : undefined}
      availableModels={modelCatalog.models.map((model) => ({
        id: model.ref,
        name: `${model.provider} / ${model.model}`,
        current: model.current,
      }))}
      modelsLoading={modelCatalog.loading}
      modelCatalogError={modelCatalog.error}
      availableEfforts={modelCatalog.effort.levels}
      effortSupported={modelCatalog.effort.supported}
      onConfigureModels={() => navigate({ kind: "settings", returnTo: "new-work" })}
      onLaunch={async (root, form) => {
        const launched = await launchNewWork(root, form);
        if (conversionDraft) onCompleteConversion();
        navigate({ kind: "work", workspaceRoot: launched.workspaceRoot, workId: launched.work.id });
      }}
      onCancel={conversionDraft ? onCancelNewWork : () => navigate({ kind: "home" })}
    />
  );
}

function renderProductPage(gateway: NorthwingShellGateway | undefined,
  destination: NorthwingDestination,
  _navigate: (destination: NorthwingDestination) => void,
  conversionDraft: ChatWorkDraft | null,
  onBeginConversion: (draft: ChatWorkDraft) => void,
  onSessionTabReady: (tabId: string) => void,
  onCancelNewWork: () => void,
  onCompleteConversion: () => void,
): React.ReactElement {
  switch (destination.kind) {
    case "home":
      return <NorthwingHomePage />;
    case "projects":
      return <NorthwingProjectsPage />;
    case "project":
      return <NorthwingProjectDetailPage workspaceRoot={destination.workspaceRoot} />;
    case "work-list":
      return <NorthwingWorkListPage />;
    case "work": {
      const gw = gateway;
      if (!gw?.SessionWorkspace) {
        return <PlaceholderPage title="Work">Work workspace will appear here. Select a workbench target.</PlaceholderPage>;
      }
      return (
        <NorthwingWorkView
          workspaceRoot={destination.workspaceRoot}
          workId={destination.workId}
          SessionWorkspace={gw.SessionWorkspace}
          onNavigate={_navigate}
        />
      );
    }
    case "artifacts":
      return <NorthwingArtifactsPage />;
    case "settings":
      return <NorthwingSettingsPage returnTo={destination.returnTo} navigate={_navigate} />;
    case "quick-chat":
      return (
        <NorthwingQuickChat
          tabId={destination.tabId}
          SessionWorkspace={gateway?.SessionWorkspace ?? undefined}
          onBeginWork={onBeginConversion}
          onSessionTabReady={onSessionTabReady}
        />
      );
    case "new-work":
      return (
        <NorthwingNewWorkPage
          destination={destination}
          conversionDraft={conversionDraft}
          navigate={_navigate}
          onCancelNewWork={onCancelNewWork}
          onCompleteConversion={onCompleteConversion}
        />
      );
  }
}

export function NorthwingShell({ initialDestination = DEFAULT_NORTHWING_DESTINATION, gateway }: NorthwingShellProps) {
  const [destination, setDestination] = useState<NorthwingDestination>(initialDestination);
  const [conversionDraft, setConversionDraft] = useState<ChatWorkDraft | null>(null);
  const windowsFramelessChrome = typeof document !== "undefined"
    && document.documentElement.getAttribute("data-platform") === "windows";
  const mainWindowChrome = useDesktopWindowChrome(windowsFramelessChrome, gateway?.windowBridge);

  useEffect(() => {
    setDestination(initialDestination);
  }, [initialDestination]);

  const handleNavigate = useCallback(
    (next: NorthwingDestination) => {
      setDestination(next);
      gateway?.onNavigate?.(next);
    },
    [gateway],
  );

  const handleAbandonConversionAndNavigate = useCallback((next: NorthwingDestination) => {
    setConversionDraft(null);
    handleNavigate(next);
  }, [handleNavigate]);

  const handleNewWork = useCallback(() => {
    handleAbandonConversionAndNavigate({ kind: "new-work" });
  }, [handleAbandonConversionAndNavigate]);

  const handleQuickChat = useCallback(() => {
    handleAbandonConversionAndNavigate({ kind: "quick-chat" });
  }, [handleAbandonConversionAndNavigate]);

  const handleBeginConversion = useCallback((draft: ChatWorkDraft) => {
    setConversionDraft(draft);
    handleNavigate({ kind: "new-work" });
  }, [handleNavigate]);

  const handleCancelNewWork = useCallback(() => {
    const chatTabId = conversionDraft?.chatTabId;
    setConversionDraft(null);
    handleNavigate(chatTabId ? { kind: "quick-chat", tabId: chatTabId } : { kind: "home" });
  }, [conversionDraft, handleNavigate]);

  const handleCompleteConversion = useCallback(() => {
    setConversionDraft(null);
  }, []);

  const handleQuickChatTabReady = useCallback((tabId: string) => {
    setDestination((current) => current.kind === "quick-chat" && !current.tabId
      ? { kind: "quick-chat", tabId }
      : current);
  }, []);

  const pageContent = useMemo(() => {
    return <div className="northwing-shell__page">{renderProductPage(gateway, destination, handleNavigate, conversionDraft, handleBeginConversion, handleQuickChatTabReady, handleCancelNewWork, handleCompleteConversion)}</div>;
  }, [destination, gateway, handleNavigate, conversionDraft, handleBeginConversion, handleQuickChatTabReady, handleCancelNewWork, handleCompleteConversion]);

  const handleWindowsTitlebarDoubleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!windowsFramelessChrome) return;
    const target = event.target as HTMLElement | null;
    if (!target?.closest(".northwing-shell__topbar")) return;
    if (target.closest("button, input, textarea, select, a, [role='button'], [role='tab'], .windows-window-controls")) return;
    event.preventDefault();
    mainWindowChrome.toggleMaximise();
  }, [mainWindowChrome.toggleMaximise, windowsFramelessChrome]);

  return (
    <div
      className={`northwing-shell${windowsFramelessChrome ? " northwing-shell--windows-frameless" : ""}`}
      onDoubleClickCapture={handleWindowsTitlebarDoubleClick}
    >
      <NorthwingGatewayContext.Provider value={gateway}>
      <NorthwingNavigateContext.Provider value={handleAbandonConversionAndNavigate}>
        <div className="northwing-shell__navigation">
          <NorthwingNavigation current={destination} onNavigate={handleAbandonConversionAndNavigate} onNewWork={handleNewWork} />
        </div>
        <div className="northwing-shell__main">
          <header className="northwing-shell__topbar">
            <span className="northwing-shell__breadcrumb">{destinationPageName(destination)}</span>
            <button
              type="button"
              className="nw-btn nw-btn--ghost"
              aria-label="Quick Chat"
              onClick={handleQuickChat}
            >
              <MessageSquare size={16} aria-hidden="true" />
              <span>Quick Chat</span>
            </button>
          </header>
          {pageContent}
        </div>
      </NorthwingNavigateContext.Provider>
      </NorthwingGatewayContext.Provider>
      {windowsFramelessChrome && <DesktopWindowControls controller={mainWindowChrome} />}
    </div>
  );
}

export default NorthwingShell;
