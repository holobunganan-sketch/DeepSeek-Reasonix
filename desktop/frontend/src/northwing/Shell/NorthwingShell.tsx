import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import { NorthwingNavigation } from "../Navigation/NorthwingNavigation";
import type { NorthwingDestination } from "../Navigation/routes";
import { destinationPageName, isSessionDestination } from "../Navigation/routes";

export type { NorthwingDestination } from "../Navigation/routes";

export type NorthwingShellGateway = {
  workspaceRoots?: string[];
  SessionWorkspace?: React.ComponentType<{ destination: NorthwingDestination }>;
  onNewWork?: () => void;
  onOpenQuickChat?: () => void;
  onNavigate?: (destination: NorthwingDestination) => void;
};

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
  return (
    <main role="main" data-northwing-page="home" className="nw-page">
      <div>
        <h1 className="nw-page__title">Home</h1>
        <p className="nw-page__subtitle">From intent to finished work.</p>
      </div>
      <div className="nw-card">
        <p>Home will show New Work, Continue working, Waiting for you, Recent artifacts, and Recent projects.</p>
      </div>
    </main>
  );
}

function NorthwingProjectsPage() {
  return (
    <main role="main" data-northwing-page="projects" className="nw-page">
      <h1 className="nw-page__title">Projects</h1>
      <div className="nw-card">
        <p>Projects list will appear here.</p>
      </div>
    </main>
  );
}

function NorthwingWorkListPage() {
  return (
    <main role="main" data-northwing-page="work-list" className="nw-page">
      <h1 className="nw-page__title">Work</h1>
      <div className="nw-card">
        <p>Work list will appear here.</p>
      </div>
    </main>
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

function renderProductPage(destination: NorthwingDestination): React.ReactElement {
  switch (destination.kind) {
    case "home":
      return <NorthwingHomePage />;
    case "projects":
      return <NorthwingProjectsPage />;
    case "project":
      return <PlaceholderPage title="Project">Project detail will appear here.</PlaceholderPage>;
    case "work-list":
      return <NorthwingWorkListPage />;
    case "work":
      return <PlaceholderPage title="Work">Work workspace will appear here.</PlaceholderPage>;
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
    return <div className="northwing-shell__page">{renderProductPage(destination)}</div>;
  }, [destination, inSession, SessionWorkspace]);

  return (
    <div className="northwing-shell">
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
    </div>
  );
}

export default NorthwingShell;
