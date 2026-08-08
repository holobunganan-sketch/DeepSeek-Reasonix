import { Suspense, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import { NorthwingNavigation } from "../Navigation/NorthwingNavigation";
import type { NorthwingDestination } from "../Navigation/routes";
import { destinationPageName, isSessionDestination } from "../Navigation/routes";
import { NorthwingHome } from "../Home/NorthwingHome";
import type { NorthwingCatalog } from "../domain/catalog";
import { normalizeNorthwingCatalog } from "../domain/catalog";
import { NorthwingProjects } from "../Projects/NorthwingProjects";
import { NorthwingProjectView } from "../Projects/NorthwingProjectView";
import { NorthwingWorkList } from "../Work/NorthwingWorkList";
import { NorthwingWorkView } from "../Work/NorthwingWorkView";

export type { NorthwingDestination } from "../Navigation/routes";

export type NorthwingShellGateway = {
  workspaceRoots?: string[];
  SessionWorkspace?: React.ComponentType<{ destination: NorthwingDestination }>;
  readCatalog?: () => Promise<NorthwingCatalog>;
  onNewWork?: () => void;
  onOpenQuickChat?: () => void;
  onNavigate?: (destination: NorthwingDestination) => void;
};
const NorthwingGatewayContext = createContext<NorthwingShellGateway | undefined>(undefined);
const NorthwingNavigateContext = createContext<(destination: NorthwingDestination) => void>(() => {});

export type NorthwingShellProps = {
  initialDestination?: NorthwingDestination;
  gateway?: NorthwingShellGateway;
};

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
      onNewWork={() => gateway?.onNewWork?.()}
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
      onNewProject={() => navigate({ kind: "projects" })}
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
  const works = [...catalog.activeWorks, ...catalog.waitingForUser].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  return (
    <NorthwingWorkList
      works={works}
      onOpenWork={(work) => navigate({ kind: "work", workspaceRoot: work.workspace, workId: work.workId })}
      onNewWork={() => navigate({ kind: "home" })}
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
  const works = catalog.activeWorks.filter((w) => w.workspace === workspaceRoot);
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
      onNewWork={() => navigate({ kind: "home" })}
    />
  );
}

function NorthwingArtifactsPage() {
  return (
    <main role="main" data-northwing-page="artifacts" className="nw-page">
      <h1 className="nw-page__title">Artifacts</h1>
      <div className="nw-card">
        <p>Global artifacts will appear here.</p>
      </div>
    </main>
  );
}

function NorthwingAdvancedPage() {
  return (
    <main role="main" data-northwing-page="advanced" className="nw-page">
      <h1 className="nw-page__title">Advanced tools</h1>
      <div className="nw-card">
        <p>Skills, MCP, Automations, Terminal, Git, and developer tools will appear here.</p>
      </div>
    </main>
  );
}

function renderProductPage(gateway: NorthwingShellGateway | undefined,
  destination: NorthwingDestination,
  _navigate: (destination: NorthwingDestination) => void,
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
        />
      );
    }
    case "artifacts":
      return <NorthwingArtifactsPage />;
    case "advanced":
      return <NorthwingAdvancedPage />;
    case "quick-chat":
      return <PlaceholderPage title="Quick Chat">Quick chat workspace will appear here.</PlaceholderPage>;
  }
}

export function NorthwingShell({ initialDestination = { kind: "home" }, gateway }: NorthwingShellProps) {
  const [destination, setDestination] = useState<NorthwingDestination>(initialDestination);
  const SessionWorkspace = gateway?.SessionWorkspace;
  const inSession = isSessionDestination(destination);

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

  const handleNewWork = useCallback(() => {
    gateway?.onNewWork?.();
  }, [gateway]);

  const handleQuickChat = useCallback(() => {
    handleNavigate({ kind: "quick-chat" });
    gateway?.onOpenQuickChat?.();
  }, [handleNavigate, gateway]);

  const pageContent = useMemo(() => {
    if (inSession && SessionWorkspace) {
      return (
        <div className="northwing-shell__session" role="main" data-northwing-page={destinationPageName(destination)}>
          <Suspense fallback={<PlaceholderPage title="Loading workspace">Starting session...</PlaceholderPage>}>
            <SessionWorkspace destination={destination} />
          </Suspense>
        </div>
      );
    }
  return <div className="northwing-shell__page">{renderProductPage(gateway, destination, handleNavigate)}</div>;
  }, [destination, inSession, SessionWorkspace]);

  return (
    <div className="northwing-shell">
      <NorthwingGatewayContext.Provider value={gateway}>
      <NorthwingNavigateContext.Provider value={handleNavigate}>
        <div className="northwing-shell__navigation">
          <NorthwingNavigation current={destination} onNavigate={handleNavigate} onNewWork={handleNewWork} />
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
    </div>
  );
}

export default NorthwingShell;
