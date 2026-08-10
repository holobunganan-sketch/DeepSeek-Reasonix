// Run: tsx src/__tests__/northwing-home.test.tsx
import { JSDOM } from "jsdom";
import { createRoot } from "react-dom/client";
import { act } from "react";
import React from "react";
import { NorthwingHome } from "../northwing/Home/NorthwingHome";
import type { NorthwingCatalog } from "../northwing/domain/catalog";

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

const catalogFixture: NorthwingCatalog = {
  projects: [
    {
      workspace: "/workspace/medical-strategy",
      exists: true,
      id: "proj-1",
      name: "Medical strategy",
      updatedAt: "2026-08-03T12:00:00Z",
      workCount: 2,
      artifactCount: 1,
    },
  ],
  works: [],
  activeWorks: [
    {
      workId: "work-123",
      projectId: "proj-1",
      projectName: "Medical strategy",
      workspace: "/workspace/medical-strategy",
      title: "Draft report",
      stage: "planning",
      quality: "standard",
      sourcePolicy: "project_plus_web",
      completedCriteria: 1,
      totalCriteria: 4,
      sessionKind: "work",
      bindingStatus: "native",
      updatedAt: "2026-08-03T12:02:00Z",
    },
  ],
  waitingForUser: [
    {
      workId: "work-456",
      projectId: "proj-1",
      projectName: "Medical strategy",
      workspace: "/workspace/medical-strategy",
      title: "Build slides",
      stage: "waiting_user",
      quality: "deep",
      sourcePolicy: "verified_web",
      completedCriteria: 2,
      totalCriteria: 5,
      sessionKind: "work",
      bindingStatus: "native",
      updatedAt: "2026-08-03T12:03:00Z",
    },
  ],
  recentArtifacts: [
    {
      id: "art-1",
      path: "deliverables/work-456/slides.pptx",
      kind: "pptx",
      workId: "work-456",
      version: 2,
      final: true,
      projectId: "proj-1",
      projectName: "Medical strategy",
      workspace: "/workspace/medical-strategy",
      createdAt: "2026-08-03T12:04:00Z",
    },
  ],
};

console.log("\nNorthwing Home");

async function run() {
  const events: string[] = [];
  await render(
    <NorthwingHome
      catalog={catalogFixture}
      onNewWork={() => events.push("new-work")}
      onOpenWork={(work) => events.push(`open-work:${work.workId}`)}
      onOpenProject={(project) => events.push(`open-project:${project.id}`)}
      onOpenArtifact={(artifact) => events.push(`open-artifact:${artifact.id}`)}
      onQuickChat={() => events.push("quick-chat")}
    />,
  );

  const headings = Array.from(document.querySelectorAll("h2")).map((h) => h.textContent);
  ok(headings.includes("Continue working"), "shows Continue working section");
  ok(headings.includes("Waiting for you"), "shows Waiting for you section");
  ok(headings.includes("Recent artifacts"), "shows Recent artifacts section");
  ok(headings.includes("Recent projects"), "shows Recent projects section");

  const newWorkButton = document.querySelector('[aria-label="New Work"]');
  ok(newWorkButton, "New Work button exists");

  const quickChatButton = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Quick Chat"));
  ok(quickChatButton, "Quick Chat button exists");

  ok(document.body.textContent?.includes("Draft report"), "shows active work title");
  ok(document.body.textContent?.includes("Build slides"), "shows waiting work title");
  ok(document.body.textContent?.includes("slides.pptx"), "shows recent artifact path");
  ok(document.body.textContent?.includes("Medical strategy"), "shows recent project name");

  await act(async () => {
    (newWorkButton as HTMLButtonElement)?.click();
    await flush();
  });
  ok(events.includes("new-work"), "New Work click emits event");

  await act(async () => {
    (quickChatButton as HTMLButtonElement)?.click();
    await flush();
  });
  ok(events.includes("quick-chat"), "Quick Chat click emits event");

  const h1 = document.querySelector("h1");
  equal(h1?.textContent, "Home", "page has one H1 with Home label");

  if (failed) process.exit(1);
  console.log("Northwing Home tests passed");
}

void run();
