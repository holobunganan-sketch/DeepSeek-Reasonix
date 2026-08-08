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

function SessionWorkspaceMock({ destination }: { destination: NorthwingDestination }) {
  return (
    <main data-testid="session-workspace" data-destination-kind={destination.kind}>
      <h1>Session Workspace</h1>
    </main>
  );
}

function createGateway(): NorthwingShellGateway {
  return {
    workspaceRoots: [],
    SessionWorkspace: SessionWorkspaceMock,
    onNewWork: () => {},
    onOpenQuickChat: () => {},
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

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

async function render(element: React.ReactElement) {
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("missing root");
  const root = createRoot(rootElement);
  await act(async () => {
    root.render(element);
    await flush();
  });
  return root;
}

console.log("\nNorthwing Shell");

async function run() {
  await render(<NorthwingShell initialDestination={{ kind: "home" }} gateway={createGateway()} />);
  const main = document.querySelector('[role="main"]');
  equal(main?.getAttribute("data-northwing-page"), "home", "default route renders Home page");
  ok(document.querySelector('[aria-label="New Work"]'), "New Work button is visible");
  for (const name of ["Home", "Projects", "Work", "Artifacts"]) {
    const link = Array.from(document.querySelectorAll("a")).find((a) => a.textContent?.includes(name));
    ok(link, `navigation contains ${name} link`);
  }

  const advanced = Array.from(document.querySelectorAll("a, button")).find((el) => el.textContent?.includes("Advanced"));
  ok(advanced, "Advanced tools entry exists");

  const quickChat = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Quick Chat"));
  ok(quickChat, "Quick Chat secondary entry exists");

  if (failed) process.exit(1);
  console.log("Northwing Shell tests passed");
}

void run();
