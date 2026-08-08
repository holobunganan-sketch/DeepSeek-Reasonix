import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import type { NorthwingDestination } from "./northwing/Navigation/routes";
import { prepareNorthwingSessionDestination, type NorthwingSessionGateway } from "./northwing/entryGateway";
import { app } from "./lib/bridge";

const App = lazy(() => import("./App"));

// SessionWorkspace adapts the existing Reasonix App controller so it can be
// mounted by the NorthwingShell when the user enters a Quick Chat or Work
// session. Over time, the true session workspace components will replace this
// adapter without changing the shell boundary.
export type SessionWorkspaceProps = {
  destination: NorthwingDestination;
  sessionGateway?: NorthwingSessionGateway;
};

export default function SessionWorkspace({ destination, sessionGateway = app }: SessionWorkspaceProps) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const workspaceRoot = destination.kind === "work" ? destination.workspaceRoot : undefined;
  const workId = destination.kind === "work" ? destination.workId : undefined;
  const tabId = destination.kind === "quick-chat" ? destination.tabId : undefined;
  const sessionDestination = useMemo<Extract<NorthwingDestination, { kind: "work" | "quick-chat" }> | undefined>(
    () => destination.kind === "work"
      ? { kind: "work", workspaceRoot: destination.workspaceRoot, workId: destination.workId }
      : destination.kind === "quick-chat"
        ? { kind: "quick-chat", tabId: destination.tabId }
        : undefined,
    [destination.kind, workspaceRoot, workId, tabId],
  );

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(undefined);
    if (!sessionDestination) {
      setError("This session destination is unavailable.");
      return () => {
        cancelled = true;
      };
    }
    void prepareNorthwingSessionDestination(sessionDestination, sessionGateway)
      .then((prepared) => {
        if (!cancelled && prepared) setReady(true);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [sessionDestination, sessionGateway]);

  if (error) {
    return (
      <main className="northwing-session-workspace__error" data-northwing-page={destination.kind} role="main">
        <h1>Session unavailable</h1>
        <p role="alert">{error}</p>
      </main>
    );
  }

  if (!ready) {
    return <div className="northwing-session-workspace__loading" role="status">Preparing session...</div>;
  }

  return (
    <Suspense fallback={<div className="northwing-session-workspace__loading" role="status">Loading session...</div>}>
      <App />
    </Suspense>
  );
}
