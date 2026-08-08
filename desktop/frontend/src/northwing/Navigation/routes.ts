export type NorthwingDestination =
  | { kind: "home" }
  | { kind: "projects" }
  | { kind: "project"; workspaceRoot: string }
  | { kind: "work-list" }
  | { kind: "work"; workspaceRoot: string; workId: string }
  | { kind: "artifacts" }
  | { kind: "quick-chat"; tabId?: string }
  | { kind: "advanced" };

export function isSessionDestination(destination: NorthwingDestination): boolean {
  return destination.kind === "quick-chat" || destination.kind === "work";
}

export function destinationPageName(destination: NorthwingDestination): string {
  return destination.kind;
}

export function describeDestination(destination: NorthwingDestination): string {
  switch (destination.kind) {
    case "home":
      return "Home";
    case "projects":
      return "Projects";
    case "project":
      return "Project";
    case "work-list":
      return "Work";
    case "work":
      return "Work";
    case "artifacts":
      return "Artifacts";
    case "quick-chat":
      return "Quick Chat";
    case "advanced":
      return "Advanced tools";
  }
}
