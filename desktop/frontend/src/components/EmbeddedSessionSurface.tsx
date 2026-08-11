import type { ComponentType } from "react";

export type SessionShellMode = "standalone" | "embedded";

export type SessionSurfaceComponent = ComponentType<{ shellMode?: SessionShellMode }>;

export function EmbeddedSessionSurface({ SessionSurface }: { SessionSurface: SessionSurfaceComponent }) {
  return <SessionSurface shellMode="embedded" />;
}
