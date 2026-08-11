// Run: tsx src/__tests__/northwing-shell.test.tsx
import { JSDOM } from "jsdom";
import { createRoot } from "react-dom/client";
import { act } from "react";
import React from "react";
import {
  NorthwingShell,
  type NorthwingShellGateway,
  type NorthwingDestination,
} from "../northwing/Shell/NorthwingShell";
import { LocaleProvider } from "../lib/i18n";

function SessionWorkspaceMock({ destination }: { destination: NorthwingDestination }) {
  return (
    <main
      data-testid="session-workspace"
      data-destination-kind={destination.kind}
      data-tab-id={destination.kind === "quick-chat" ? destination.tabId : undefined}
    >
      <h1>Session Workspace</h1>
    </main>
  );
}

function createGateway(): NorthwingShellGateway {
  return {
    workspaceRoots: [],
    SessionWorkspace: SessionWorkspaceMock,
    onNavigate: () => {},
  };
}

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}

function equal(actual: string | null | undefined, expected: string, label: string) {
  if (actual === expected) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}: got ${actual}, expected ${expected}\n`);
  }
}

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  pretendToBeVisual: true,
  url: "http://localhost/",
});
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
globalThis.window = dom.window as unknown as Window & typeof globalThis;
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;
globalThis.Element = dom.window.Element;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Event = dom.window.Event;
globalThis.KeyboardEvent = dom.window.KeyboardEvent;
globalThis.MouseEvent = dom.window.MouseEvent;
Object.defineProperty(dom.window.HTMLElement.prototype, "attachEvent", { configurable: true, value: () => {} });
Object.defineProperty(dom.window.HTMLElement.prototype, "detachEvent", { configurable: true, value: () => {} });

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

async function render(element: React.ReactElement) {
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("missing root");
  const root = createRoot(rootElement);
  await act(async () => {
    root.render(<LocaleProvider>{element}</LocaleProvider>);
    await flush();
  });
  return root;
}

console.log("\nNorthwing Shell");

async function run() {
  const homeRoot = await render(<NorthwingShell initialDestination={{ kind: "home" }} gateway={createGateway()} />);
  const main = document.querySelector('[role="main"]');
  equal(main?.getAttribute("data-northwing-page"), "home", "default route renders Home page");
  ok(document.querySelector('[aria-label="New Work"]'), "New Work button is visible");
  for (const name of ["Home", "Projects", "Work", "Artifacts"]) {
    const link = Array.from(document.querySelectorAll("a")).find((a) => a.textContent?.includes(name));
    ok(link, `navigation contains ${name} link`);
  }

  const settings = Array.from(document.querySelectorAll("a, button")).find((el) => el.textContent?.includes("Settings"));
  ok(settings, "Settings entry exists");
  ok(!document.body.textContent?.includes("Advanced tools"), "stable navigation hides the Advanced tools placeholder");
  ok(!document.body.textContent?.includes("Automations"), "stable navigation hides unavailable Automations");

  const quickChat = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Quick Chat"));
  ok(quickChat, "Quick Chat secondary entry exists");

  const homeCreateWork = document.querySelector<HTMLButtonElement>(".home-card--new-work button");
  await act(async () => {
    homeCreateWork?.click();
    await flush();
  });
  equal(
    document.querySelector("[data-northwing-page]")?.getAttribute("data-northwing-page"),
    "new-work",
    "Home Create Work navigates through the Shell to the New Work form",
  );
  equal(document.querySelector(".northwing-shell__breadcrumb")?.textContent, "New Work", "breadcrumb hides internal new-work route kind");

  await act(async () => {
    homeRoot.unmount();
    await flush();
  });

  const workListRoot = await render(
    <NorthwingShell initialDestination={{ kind: "work-list" }} gateway={createGateway()} />,
  );
  const workListNewWork = document.querySelector<HTMLButtonElement>(
    '[data-northwing-page="work-list"] [aria-label="New Work"]',
  );
  await act(async () => {
    workListNewWork?.click();
    await flush();
  });
  equal(
    document.querySelector("[data-northwing-page]")?.getAttribute("data-northwing-page"),
    "new-work",
    "Work list New Work navigates to the New Work form",
  );
  await act(async () => {
    workListRoot.unmount();
    await flush();
  });

  let createdProject = false;
  let projectCatalogReads = 0;
  const newProjectBridgeCalls: string[] = [];
  (window as typeof window & { go?: { main?: { App?: Record<string, unknown> } } }).go = {
    main: {
      App: {
        PickWorkspace: async () => {
          newProjectBridgeCalls.push("pick-workspace");
          return "/workspace/new-project";
        },
        CoworkProjectState: async () => ({ exists: false }),
        CreateCoworkProject: async () => {
          newProjectBridgeCalls.push("create-project");
          createdProject = true;
          return {
            version: 3,
            id: "new-project",
            name: "new-project",
            createdAt: "2026-08-10T00:00:00Z",
            updatedAt: "2026-08-10T00:00:00Z",
          };
        },
        ValidateCoworkProjectWritable: async () => {},
      },
    },
  };
  const newProjectRoot = await render(
    <NorthwingShell
      initialDestination={{ kind: "projects" }}
      gateway={{
        ...createGateway(),
        readCatalog: async () => {
          projectCatalogReads += 1;
          return {
            projects: createdProject ? [{
              workspace: "/workspace/new-project",
              exists: true,
              id: "new-project",
              name: "new-project",
              updatedAt: "2026-08-10T00:00:00Z",
              workCount: 0,
              artifactCount: 0,
            }] : [],
            activeWorks: [],
            waitingForUser: [],
            recentArtifacts: [],
          };
        },
      }}
    />,
  );
  const newProjectButton = document.querySelector<HTMLButtonElement>('[aria-label="New Project"]');
  await act(async () => {
    newProjectButton?.click();
    await flush();
  });
  equal(
    newProjectBridgeCalls.join(","),
    "pick-workspace,create-project",
    "New Project uses the native picker and creates a Northwing Project",
  );
  equal(
    document.querySelector("[data-northwing-page]")?.getAttribute("data-northwing-page"),
    "project",
    "New Project enters the created Project",
  );
  ok(projectCatalogReads >= 2, "New Project refreshes the persisted catalog before Project render");
  await act(async () => {
    newProjectRoot.unmount();
    await flush();
  });

  const projectRoot = await render(
    <NorthwingShell
      initialDestination={{ kind: "project", workspaceRoot: "/workspace/project-a" }}
      gateway={{
        ...createGateway(),
        readCatalog: async () => ({
          projects: [{
            workspace: "/workspace/project-a",
            exists: true,
            id: "project-a",
            name: "Project A",
            updatedAt: "2026-08-10T00:00:00Z",
            workCount: 0,
            artifactCount: 0,
          }],
          activeWorks: [],
          waitingForUser: [],
          recentArtifacts: [],
        }),
      }}
    />,
  );
  const projectNewWork = document.querySelector<HTMLButtonElement>(
    '[data-northwing-page="project"] [aria-label="New Work"]',
  );
  await act(async () => {
    projectNewWork?.click();
    await flush();
  });
  equal(
    document.querySelector("[data-northwing-page]")?.getAttribute("data-northwing-page"),
    "new-work",
    "Project New Work navigates to the New Work form",
  );
  const selectedProject = document.querySelector<HTMLInputElement>('[aria-label="Project folder"]');
  equal(
    selectedProject?.value,
    "/workspace/project-a",
    "Project New Work preserves the selected workspace",
  );
  ok(selectedProject?.disabled, "Project New Work locks the selected workspace");
  await act(async () => {
    projectRoot.unmount();
    await flush();
  });

  (window as typeof window & { go?: { main?: { App?: unknown } } }).go = {
    main: {
      App: {
        CoworkProjectState: async () => ({
          exists: true,
          project: {
            version: 1,
            id: "medical-strategy",
            name: "Medical strategy",
            createdAt: "2026-08-09T00:00:00Z",
            updatedAt: "2026-08-09T00:00:00Z",
            works: [{ id: "work-123", title: "Draft report", profile: "delivery" }],
          },
        }),
        ListTabs: async () => [{
          id: "tab-work-123",
          scope: "project",
          workspaceRoot: "/workspace/medical-strategy",
          workspaceName: "Medical strategy",
          topicId: "topic-work-123",
          topicTitle: "Draft report",
          sessionKind: "work",
          workId: "work-123",
          label: "Draft report",
          ready: true,
          running: false,
          pendingPrompt: false,
          mode: "normal",
          active: true,
          cwd: "/workspace/medical-strategy",
        }],
        MetaForTab: async () => ({
          label: "Draft report",
          ready: true,
          eventChannel: "desktop-events",
          cwd: "/workspace/medical-strategy",
          goalStatus: "running",
          canonicalTodos: [],
        }),
        ActiveWorkForTab: async () => ({
          running: false,
          pendingPrompt: false,
          cancellable: false,
          jobs: [],
        }),
        UpdateCoworkWorkProjection: async () => ({}),
      },
    },
  };
  const workRoot = await render(
    <NorthwingShell
      initialDestination={{ kind: "work", workspaceRoot: "/workspace/medical-strategy", workId: "work-123" }}
      gateway={createGateway()}
    />,
  );
  const workPage = document.querySelector('[data-northwing-page="work"]');
  ok(workPage, "work destination renders the Northwing Work page");
  equal(document.querySelector(".nw-work-header h1")?.textContent, "Draft report", "work destination renders the Work header");
  ok(document.querySelector('[aria-label="Work plan"]'), "work destination renders the Work plan");
  ok(document.querySelector('[aria-label="Work activity"]'), "work destination renders the Work activity");
  ok(document.querySelector('[aria-label="Materials and artifacts"]'), "work destination renders materials and artifacts");
  equal(
    document.querySelector('[data-testid="session-workspace"]')?.getAttribute("data-destination-kind"),
    "work",
    "work page passes the work destination to its session adapter",
  );

  const workBack = document.querySelector<HTMLButtonElement>('[aria-label="Back to Work list"]');
  await act(async () => {
    workBack?.click();
    await flush();
  });
  equal(
    document.querySelector("[data-northwing-page]")?.getAttribute("data-northwing-page"),
    "work-list",
    "Work Back navigates to the Work list",
  );

  await act(async () => {
    workRoot.unmount();
    await flush();
  });

  const quickChatRoot = await render(
    <NorthwingShell
      initialDestination={{ kind: "quick-chat", tabId: "chat-tab-42" }}
      gateway={createGateway()}
    />,
  );
  equal(
    document.querySelector('[data-testid="session-workspace"]')?.getAttribute("data-tab-id"),
    "chat-tab-42",
    "Quick Chat route preserves its existing tab id",
  );
  await act(async () => {
    quickChatRoot.unmount();
    await flush();
  });

  if (failed) process.exit(1);
  console.log("Northwing Shell tests passed");
}

void run();
