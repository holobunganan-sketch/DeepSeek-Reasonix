import { app } from "../lib/bridge";
import { readNorthwingCatalog } from "../lib/northwingCowork";
import type { ProjectNode } from "../lib/types";
import type { NorthwingDestination } from "./Navigation/routes";
import type { NorthwingCatalog } from "./domain/catalog";
import { northwingWorkspaceIdentity } from "../lib/northwingWorkspaceIdentity";

export type NorthwingCatalogGateway = {
  listProjectTree: () => Promise<ProjectNode[]>;
  readNorthwingCatalog: (workspaceRoots: string[]) => Promise<NorthwingCatalog>;
};

export type NorthwingSessionGateway = {
  EnsureWorkTab: (workspaceRoot: string, workId: string) => Promise<{ id: string }>;
  EnsureBlankTab: (scope: string, workspaceRoot: string) => Promise<{ id: string }>;
  SetActiveTab: (tabId: string) => Promise<void>;
};

type NorthwingSessionDestination = Extract<NorthwingDestination, { kind: "work" | "quick-chat" }>;

export type PreparedNorthwingSession = {
  ready: boolean;
  tabId?: string;
};

type NorthwingSessionCoordinator = {
  prepare: (
    destination: NorthwingSessionDestination,
    gateway: NorthwingSessionGateway,
  ) => Promise<PreparedNorthwingSession>;
};

export function northwingProjectWorkspaceRoots(nodes: readonly ProjectNode[]): string[] {
  const roots = new Map<string, string>();
  const visit = (items: readonly ProjectNode[]) => {
    for (const node of items) {
      const root = node.kind === "project" ? node.root?.trim() : "";
      if (root) {
        const identity = northwingWorkspaceIdentity(root);
        if (!roots.has(identity)) roots.set(identity, root);
      }
      if (node.children) visit(node.children);
    }
  };
  visit(nodes);
  return [...roots.values()];
}

export function createNorthwingCatalogLoader(gateway: NorthwingCatalogGateway): () => Promise<NorthwingCatalog> {
  return async () => gateway.readNorthwingCatalog(northwingProjectWorkspaceRoots(await gateway.listProjectTree()));
}

export const readNorthwingCatalogForDesktop = createNorthwingCatalogLoader({
  listProjectTree: () => app.ListProjectTree(),
  readNorthwingCatalog,
});

function createNorthwingSessionCoordinator(): NorthwingSessionCoordinator {
  let latestRequest = 0;
  let queue: Promise<void> = Promise.resolve();
  return {
    prepare(destination, gateway) {
      const request = ++latestRequest;
      const result = queue
        .catch(() => undefined)
        .then(async () => {
          // A newer destination can arrive while this request is still queued.
          // Skip it before it can change the active desktop tab.
          if (request !== latestRequest) return { ready: false };

          if (destination.kind === "work") {
            const tab = await gateway.EnsureWorkTab(destination.workspaceRoot, destination.workId);
            // EnsureWorkTab also activates newly created/restored tabs. The
            // queue guarantees a newer request runs after this one and wins.
            if (request !== latestRequest) return { ready: false };
            await gateway.SetActiveTab(tab.id);
            return { ready: request === latestRequest, tabId: tab.id };
          }

          if (destination.tabId) {
            await gateway.SetActiveTab(destination.tabId);
            return { ready: request === latestRequest, tabId: destination.tabId };
          }

          const tab = await gateway.EnsureBlankTab("global", "");
          if (request !== latestRequest) return { ready: false };
          await gateway.SetActiveTab(tab.id);
          return { ready: request === latestRequest, tabId: tab.id };
        });
      queue = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}

// Northwing renders one product session surface at a time. Sharing the
// coordinator across gateways also invalidates an in-flight request if the
// Wails bridge is replaced during startup, recovery, or a test seam.
const desktopSessionCoordinator = createNorthwingSessionCoordinator();

export async function prepareNorthwingSessionDestinationDetails(
  destination: NorthwingSessionDestination,
  gateway: NorthwingSessionGateway = app,
): Promise<PreparedNorthwingSession> {
  return desktopSessionCoordinator.prepare(destination, gateway);
}

export async function prepareNorthwingSessionDestination(
  destination: NorthwingSessionDestination,
  gateway: NorthwingSessionGateway = app,
): Promise<boolean> {
  return (await prepareNorthwingSessionDestinationDetails(destination, gateway)).ready;
}
