// Run: node --import tsx --import ./scripts/register-css-test-loader.mjs src/__tests__/northwing-artifact-production.test.tsx
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import React from "react";
import { NorthwingShell } from "../northwing/Shell/NorthwingShell";
import type { NorthwingCatalog } from "../northwing/domain/catalog";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
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
globalThis.MouseEvent = dom.window.MouseEvent;

let failed = 0;
function ok(value: unknown, label: string) {
  if (value) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}\n`);
  }
}
function equal(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) process.stdout.write(`  PASS  ${label}\n`);
  else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}\n`);
  }
}
function flush() { return new Promise((resolve) => setTimeout(resolve, 40)); }
function actionButton(label: string) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(".nw-artifact-panel__actions button"))
    .find((candidate) => candidate.textContent?.trim() === label);
}
async function click(button: HTMLButtonElement | undefined) {
  await act(async () => {
    button?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await flush();
  });
}

const bridgeCalls: string[] = [];
let final = false;
(window as typeof window & { go?: { main?: { App?: Record<string, unknown> } } }).go = {
  main: {
    App: {
      ListTabs: async () => [{
        id: "tab-project",
        scope: "project",
        workspaceRoot: "/workspace/project-1",
        workspaceName: "Project One",
        topicId: "topic-project",
        topicTitle: "Project One",
        sessionKind: "chat",
        label: "Project One",
        ready: true,
        running: false,
        mode: "normal",
        active: true,
        cwd: "/workspace/project-1",
      }],
      ReadFileForTab: async (_tabId: string, path: string) => {
        bridgeCalls.push(`preview:${path}`);
        return { path, body: "Release preview", size: 15, truncated: false, binary: false };
      },
      OpenWorkspacePathForTab: async (_tabId: string, path: string) => { bridgeCalls.push(`open:${path}`); },
      RevealWorkspacePathForTab: async (_tabId: string, path: string) => { bridgeCalls.push(`reveal:${path}`); },
      SetCoworkArtifactFinal: async (_workspaceRoot: string, artifactId: string) => {
        bridgeCalls.push(`final:${artifactId}`);
        final = true;
        return { exists: true };
      },
    },
  },
};

function catalog(): NorthwingCatalog {
  return {
    projects: [],
    works: [],
    activeWorks: [],
    waitingForUser: [],
    recentArtifacts: [{
      id: "artifact-1",
      path: "deliverables/work-1/report.docx",
      kind: "docx",
      workId: "work-1",
      version: 1,
      final,
      projectId: "project-1",
      projectName: "Project One",
      workspace: "/workspace/project-1",
      createdAt: "2026-08-10T00:00:00Z",
    }],
  };
}

console.log("\nNorthwing production Artifact bridge");
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("missing root");
const root = createRoot(rootElement);
await act(async () => {
  root.render(<NorthwingShell initialDestination={{ kind: "artifacts" }} gateway={{ readCatalog: async () => catalog() }} />);
  await flush();
});

await click(actionButton("Preview"));
await click(actionButton("Open"));
await click(actionButton("Reveal"));
await click(actionButton("Set final"));
equal(bridgeCalls, [
  "preview:deliverables/work-1/report.docx",
  "open:deliverables/work-1/report.docx",
  "reveal:deliverables/work-1/report.docx",
  "final:artifact-1",
], "production Shell actions call the owning Project bridge methods");
ok(document.body.textContent?.includes("Release preview"), "Preview displays the production bridge result");
ok(document.body.textContent?.includes("Final"), "Set final refreshes and displays final state");
ok(!actionButton("Set final"), "final Artifact no longer offers Set final");
ok(actionButton("Open Work"), "Open Work remains a separate action");

await act(async () => {
  root.unmount();
  await flush();
});
if (failed) process.exit(1);
console.log("Northwing production Artifact bridge tests passed");
